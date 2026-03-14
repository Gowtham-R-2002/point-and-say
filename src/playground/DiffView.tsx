/**
 * DiffView — Shows line-by-line code diffs with green (added) / red (removed) highlighting.
 * Uses the `diff` package to compute changes between original and modified code.
 */
import { diffLines } from 'diff';

export interface DiffData {
  original: string;
  modified: string;
  filePath: string;
  timestamp: number;
}

interface DiffViewProps {
  diff: DiffData | null;
}

export function DiffView({ diff }: DiffViewProps) {
  if (!diff) {
    return (
      <div className="diff-view empty">
        <div className="diff-empty-state">
          <span className="diff-icon">📊</span>
          <p>Code diffs appear here when the AI makes changes</p>
        </div>
      </div>
    );
  }

  const changes = diffLines(diff.original, diff.modified);
  const timeAgo = getTimeAgo(diff.timestamp);

  return (
    <div className="diff-view">
      <div className="diff-header">
        <span className="diff-filename">{diff.filePath.split('/').pop()}</span>
        <span className="diff-time">{timeAgo}</span>
      </div>
      <div className="diff-content">
        {changes.map((change, i) => {
          const lines = change.value.split('\n');
          // Remove trailing empty line from split
          if (lines[lines.length - 1] === '') lines.pop();

          return lines.map((line, j) => (
            <div key={`${i}-${j}`}
              className={`diff-line ${change.added ? 'added' : change.removed ? 'removed' : ''}`}>
              <span className="diff-marker">
                {change.added ? '+' : change.removed ? '−' : ' '}
              </span>
              <span className="diff-text">{line || ' '}</span>
            </div>
          ));
        })}
      </div>
    </div>
  );
}

function getTimeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
