/**
 * DiffModal — Overlay modal showing code diffs with blur backdrop.
 * Opens when user clicks "View Changes" after the AI modifies code.
 */
import { useEffect, useRef } from 'react';
import { X, GitCommitHorizontal } from 'lucide-react';
import { diffLines } from 'diff';
import type { DiffData } from './DiffView';

interface DiffModalProps {
  diff: DiffData;
  onClose: () => void;
}

export function DiffModal({ diff, onClose }: DiffModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const changes = diffLines(diff.original, diff.modified);
  const additions = changes.filter(c => c.added).reduce((n, c) => n + c.value.split('\n').filter(Boolean).length, 0);
  const deletions = changes.filter(c => c.removed).reduce((n, c) => n + c.value.split('\n').filter(Boolean).length, 0);

  return (
    <div className="diff-modal-overlay" ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="diff-modal">
        {/* Header */}
        <div className="diff-modal-header">
          <div className="diff-modal-title">
            <GitCommitHorizontal size={16} />
            <span>{diff.filePath}</span>
          </div>
          <div className="diff-modal-meta">
            <span className="diff-stat additions">+{additions}</span>
            <span className="diff-stat deletions">−{deletions}</span>
            <button className="diff-modal-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Diff Content */}
        <div className="diff-modal-content">
          {changes.map((change, i) => {
            const lines = change.value.split('\n');
            if (lines[lines.length - 1] === '') lines.pop();

            return lines.map((line, j) => (
              <div key={`${i}-${j}`}
                className={`diff-modal-line ${change.added ? 'added' : change.removed ? 'removed' : ''}`}>
                <span className="diff-modal-marker">
                  {change.added ? '+' : change.removed ? '−' : ' '}
                </span>
                <span className="diff-modal-text">{line || ' '}</span>
              </div>
            ));
          })}
        </div>
      </div>
    </div>
  );
}
