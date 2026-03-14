/**
 * Nova 2 Sonic TTS Microservice — v5
 *
 * Based on the official AWS sample `nova_sonic_with_text.py`:
 *   - SilentAudioStreamer: Sends continuous silent audio to keep the stream alive
 *   - TextInputHandler: Sends USER text with `interactive: true` and unique content names
 *
 * Key findings from the sample:
 *   1. Audio stream MUST be open continuously (even for text-only mode)
 *   2. Silent audio is sent at ~10ms intervals to maintain the connection
 *   3. User TEXT is sent with `interactive: true` (not false!)
 *   4. Each text message gets a NEW content name
 *   5. Response processing runs concurrently as a separate async task
 */

import { createServer } from "http";
import {
  BedrockRuntimeClient,
  InvokeModelWithBidirectionalStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { NodeHttp2Handler } from "@smithy/node-http-handler";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const p = resolve(__dirname, "../../.env");
    for (const line of readFileSync(p, "utf-8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq > 0 && !process.env[t.slice(0, eq).trim()])
        process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  } catch {}
}
loadEnv();

const PORT = parseInt(process.env.SONIC_PORT || "8001", 10);
const REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID = "amazon.nova-2-sonic-v1:0";
const VOICE_ID = process.env.SONIC_VOICE_ID || "tiffany";
const SAMPLE_RATE = 24000;
const INPUT_SAMPLE_RATE = 16000;
const CHUNK_SIZE = 1024;

const bedrockClient = new BedrockRuntimeClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  requestHandler: new NodeHttp2Handler({
    requestTimeout: 120000,
    sessionTimeout: 120000,
    disableConcurrentStreams: false,
    maxConcurrentStreams: 10,
  }),
});

function pcmToWav(pcmBase64) {
  const pcm = Buffer.from(pcmBase64, "base64");
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24); h.writeUInt32LE(SAMPLE_RATE * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]).toString("base64");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Async event queue for the bidirectional stream input */
class EventQueue {
  constructor() {
    this._q = [];
    this._w = null;
    this._done = false;
  }
  push(evt) {
    this._q.push(evt);
    this._w?.();
    this._w = null;
  }
  close() {
    this._done = true;
    this._w?.();
    this._w = null;
  }
  [Symbol.asyncIterator]() {
    return {
      next: async () => {
        while (this._q.length === 0 && !this._done)
          await new Promise((r) => (this._w = r));
        if (this._q.length > 0) {
          const evt = this._q.shift();
          return {
            value: {
              chunk: {
                bytes: new TextEncoder().encode(JSON.stringify(evt)),
              },
            },
            done: false,
          };
        }
        return { value: undefined, done: true };
      },
    };
  }
}

/**
 * Sonic TTS — text-only mode pattern from nova_sonic_with_text.py
 *
 * Flow:
 *   1. sessionStart → promptStart → system prompt (TEXT, role=SYSTEM, interactive=false)
 *   2. Start audio content (AUDIO, role=USER, interactive=true)
 *   3. Continuously send silent audio at 10ms intervals
 *   4. Send user text (TEXT, role=USER, interactive=true, NEW content name)
 *   5. Collect audio output from model
 *   6. End audio content → promptEnd → sessionEnd → close
 */
async function sonicTTS(text) {
  const promptName = randomUUID();
  const systemContentId = randomUUID();
  const audioContentId = randomUUID();
  const textContentId = randomUUID();

  const queue = new EventQueue();
  const audioChunks = [];
  let textResponse = "";
  let responseComplete = false;
  let gotAudioEnd = false;

  // ─── 1. SESSION START ───
  queue.push({
    event: {
      sessionStart: {
        inferenceConfiguration: { maxTokens: 1024, topP: 0.9, temperature: 0.7 },
      },
    },
  });

  // ─── 2. PROMPT START ───
  queue.push({
    event: {
      promptStart: {
        promptName,
        textOutputConfiguration: { mediaType: "text/plain" },
        audioOutputConfiguration: {
          mediaType: "audio/lpcm",
          sampleRateHertz: SAMPLE_RATE,
          sampleSizeBits: 16,
          channelCount: 1,
          voiceId: VOICE_ID,
          encoding: "base64",
          audioType: "SPEECH",
        },
      },
    },
  });

  // ─── 3. SYSTEM PROMPT (TEXT, non-interactive) ───
  queue.push({
    event: {
      contentStart: {
        promptName,
        contentName: systemContentId,
        type: "TEXT",
        interactive: false,
        role: "SYSTEM",
        textInputConfiguration: { mediaType: "text/plain" },
      },
    },
  });
  queue.push({
    event: {
      textInput: {
        promptName,
        contentName: systemContentId,
        content: "You are a text-to-speech assistant. Your ONLY job is to repeat EXACTLY what the user says, word for word. Do not add any commentary, greetings, or extra words. Just say exactly what the user tells you to say.",
      },
    },
  });
  queue.push({
    event: { contentEnd: { promptName, contentName: systemContentId } },
  });

  // ─── 4. AUDIO CONTENT START (continuous silent stream) ───
  queue.push({
    event: {
      contentStart: {
        promptName,
        contentName: audioContentId,
        type: "AUDIO",
        interactive: true,
        role: "USER",
        audioInputConfiguration: {
          mediaType: "audio/lpcm",
          sampleRateHertz: INPUT_SAMPLE_RATE,
          sampleSizeBits: 16,
          channelCount: 1,
          audioType: "SPEECH",
          encoding: "base64",
        },
      },
    },
  });

  console.log(`🚀 [Sonic] Starting stream for: "${text.slice(0, 50)}"`);
  const startTime = Date.now();

  // ─── 5. START THE BIDIRECTIONAL STREAM ───
  const command = new InvokeModelWithBidirectionalStreamCommand({
    modelId: MODEL_ID,
    body: queue,
  });

  const response = await bedrockClient.send(command);

  // ─── 6. PROCESS RESPONSES CONCURRENTLY ───
  const responsePromise = (async () => {
    let eventCount = 0;
    try {
      for await (const event of response.body) {
        if (event.chunk?.bytes) {
          eventCount++;
          try {
            const parsed = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
            const evt = parsed.event || parsed;

            if (evt.audioOutput?.content) {
              audioChunks.push(evt.audioOutput.content);
              if (audioChunks.length === 1)
                console.log(`   [Sonic] ▶ First audio at ${Date.now() - startTime}ms`);
            } else if (evt.textOutput?.content) {
              textResponse += evt.textOutput.content;
              console.log(`   [Sonic] Text: "${evt.textOutput.content.slice(0, 60)}"`);
            } else if (evt.contentStart) {
              console.log(`   [Sonic] contentStart: type=${evt.contentStart.type} role=${evt.contentStart.role || "?"}`);
            } else if (evt.contentEnd) {
              if (evt.contentEnd.type === "AUDIO" && evt.contentEnd.stopReason === "END_TURN") {
                console.log(`   [Sonic] Audio END_TURN received`);
                gotAudioEnd = true;
              }
            } else if (evt.completionEnd) {
              console.log(`   [Sonic] completionEnd received`);
              responseComplete = true;
            } else if (evt.usageEvent) {
              // Only log when output starts appearing
              if (evt.usageEvent.totalOutputTokens > 0 && audioChunks.length === 0)
                console.log(`   [Sonic] Model generating (out=${evt.usageEvent.totalOutputTokens} tokens)`);
            } else {
              const keys = Object.keys(evt).filter(k => !["promptEnd", "promptStart"].includes(k));
              if (keys.length > 0) console.log(`   [Sonic] Event: ${keys.join(", ")}`);
            }
          } catch {}
        } else if (event.modelStreamErrorException) {
          console.error("❌ Model error:", JSON.stringify(event.modelStreamErrorException));
        }
      }
    } catch (err) {
      console.error("❌ Response error:", err.message);
    }
    responseComplete = true;
    console.log(`   [Sonic] Stream ended. ${eventCount} events, ${audioChunks.length} audio chunks.`);
  })();

  // ─── 7. CONTINUOUS SILENT AUDIO (like SilentAudioStreamer) ───
  // Silent chunk: 1024 samples × 2 bytes = 2048 bytes of silence
  const silentChunk = Buffer.alloc(CHUNK_SIZE * 2).toString("base64");

  // Start sending silence immediately (concurrent with response processing)
  const silencePromise = (async () => {
    // Send silence for a while to establish the stream
    for (let i = 0; i < 15 && !responseComplete; i++) {
      queue.push({
        event: {
          audioInput: { promptName, contentName: audioContentId, content: silentChunk },
        },
      });
      await sleep(10); // 10ms intervals like the Python sample
    }

    // ─── 8. SEND USER TEXT (interactive: true, new content name!) ───
    console.log(`   [Sonic] Sending user text (interactive=true)...`);
    queue.push({
      event: {
        contentStart: {
          promptName,
          contentName: textContentId,
          role: "USER",
          type: "TEXT",
          interactive: true,  // KEY: must be true for user text!
          textInputConfiguration: { mediaType: "text/plain" },
        },
      },
    });
    queue.push({
      event: {
        textInput: {
          promptName,
          contentName: textContentId,
          content: text,
        },
      },
    });
    queue.push({
      event: { contentEnd: { promptName, contentName: textContentId } },
    });

    // Continue sending silence while waiting for response
    for (let i = 0; i < 500 && !gotAudioEnd && !responseComplete; i++) {
      queue.push({
        event: {
          audioInput: { promptName, contentName: audioContentId, content: silentChunk },
        },
      });
      await sleep(10);
    }

    // ─── 9. CLEANUP ───
    console.log(`   [Sonic] Closing stream...`);
    queue.push({ event: { contentEnd: { promptName, contentName: audioContentId } } });
    await sleep(50);
    queue.push({ event: { promptEnd: { promptName } } });
    await sleep(50);
    queue.push({ event: { sessionEnd: {} } });
    await sleep(50);
    queue.close();
  })();

  // Wait for both to complete
  await Promise.all([responsePromise, silencePromise]);

  const elapsed = Date.now() - startTime;
  console.log(`✅ [Sonic] ${audioChunks.length} audio chunks, ${elapsed}ms`);
  if (textResponse) console.log(`   [Sonic] Full text: "${textResponse.slice(0, 150)}"`);

  if (audioChunks.length === 0) return null;

  const merged = Buffer.concat(
    audioChunks.map((c) => Buffer.from(c, "base64"))
  ).toString("base64");

  return {
    audioBase64: merged,
    textResponse,
    chunks: audioChunks.length,
    elapsedMs: elapsed,
  };
}

// ─── HTTP Server ───
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(200); return res.end(); }
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", service: "sonic-tts", model: MODEL_ID, voice: VOICE_ID }));
  }

  if (req.url === "/tts" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const { text } = JSON.parse(body);
        if (!text?.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "text required" }));
        }

        const result = await sonicTTS(text.trim());
        if (result) {
          const wavB64 = pcmToWav(result.audioBase64);
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({
            status: "ok", audioBase64: wavB64, format: "audio/wav",
            engine: "nova-sonic", model: MODEL_ID, voice: VOICE_ID,
            textResponse: result.textResponse, chunks: result.chunks,
            elapsedMs: result.elapsedMs, mock: false,
          }));
        }

        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "No audio from Sonic", mock: true }));
      } catch (err) {
        console.error("❌ [Sonic] Error:", err.message || err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message || "Sonic TTS failed", mock: true }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`\n🔊 Nova 2 Sonic TTS Server (v5 — text-only mode)`);
  console.log(`   Model:  ${MODEL_ID}  Voice: ${VOICE_ID}`);
  console.log(`   Port:   http://localhost:${PORT}`);
  console.log(`   Region: ${REGION}\n`);
});
