/**
 * CodeViewer — Syntax-highlighted, read-only code display with line numbers.
 * Uses prism-react-renderer for highlighting. Highlights changed lines in green.
 */
import { Highlight, themes } from 'prism-react-renderer';

interface CodeViewerProps {
  code: string;
  language: string;
  fileName: string;
  changedLines?: Set<number>;
}

export function CodeViewer({ code, language, fileName, changedLines }: CodeViewerProps) {
  if (!code) {
    return (
      <div className="code-viewer empty">
        <div className="code-empty-state">
          <span className="code-empty-icon">📝</span>
          <p>Select a file to view its source</p>
        </div>
      </div>
    );
  }

  return (
    <div className="code-viewer">
      <div className="code-tab">
        <span className="code-tab-name">{fileName.split('/').pop()}</span>
      </div>
      <div className="code-scroll">
        <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre style={{ margin: 0, padding: '8px 0', background: 'transparent' }}>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}
                  className={`code-line ${changedLines?.has(i + 1) ? 'changed' : ''}`}>
                  <span className="line-number">{i + 1}</span>
                  <span className="line-content">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}
