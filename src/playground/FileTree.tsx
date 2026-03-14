/**
 * FileTree — Collapsible file explorer with Lucide icons.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, FileCode } from 'lucide-react';

interface FileNode {
  name: string;
  path: string;
  children?: FileNode[];
}

export interface FileTreeProps {
  selectedFile: string | null;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
}

const PROJECT_FILES: FileNode[] = [
  {
    name: 'src', path: 'src', children: [
      { name: 'App.tsx', path: 'src/App.tsx' },
      { name: 'App.css', path: 'src/App.css' },
      {
        name: 'app', path: 'src/app', children: [
          {
            name: 'components', path: 'src/app/components', children: [
              { name: 'ActionButton.tsx', path: 'src/app/components/ActionButton.tsx' },
              { name: 'AnalyticsChart.tsx', path: 'src/app/components/AnalyticsChart.tsx' },
              { name: 'DataTable.tsx', path: 'src/app/components/DataTable.tsx' },
              { name: 'HeroSection.tsx', path: 'src/app/components/HeroSection.tsx' },
              { name: 'ProfileCard.tsx', path: 'src/app/components/ProfileCard.tsx' },
              { name: 'Sidebar.tsx', path: 'src/app/components/Sidebar.tsx' },
              { name: 'StatsCards.tsx', path: 'src/app/components/StatsCards.tsx' },
            ],
          },
        ],
      },
    ],
  },
];

function TreeNode({ node, depth, selectedFile, activeFile, onSelectFile }: {
  node: FileNode; depth: number;
  selectedFile: string | null; activeFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isFolder = !!node.children;
  const isSelected = node.path === selectedFile;
  const isActive = node.path === activeFile;

  return (
    <>
      <div
        className={`file-tree-node ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => isFolder ? setIsOpen(!isOpen) : onSelectFile(node.path)}
      >
        {isFolder ? (
          isOpen ? <ChevronDown size={12} className="tree-chevron" /> : <ChevronRight size={12} className="tree-chevron" />
        ) : <span style={{ width: 12 }} />}
        {isFolder
          ? (isOpen ? <FolderOpen size={14} className="tree-folder" /> : <Folder size={14} className="tree-folder" />)
          : <FileCode size={14} className="tree-file" />
        }
        <span className="tree-label">{node.name}</span>
        {isActive && <span className="tree-badge">modified</span>}
      </div>
      {isFolder && isOpen && node.children?.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1}
          selectedFile={selectedFile} activeFile={activeFile} onSelectFile={onSelectFile} />
      ))}
    </>
  );
}

export function FileTree({ selectedFile, activeFile, onSelectFile }: FileTreeProps) {
  return (
    <div className="file-tree">
      {PROJECT_FILES.map((node) => (
        <TreeNode key={node.path} node={node} depth={0}
          selectedFile={selectedFile} activeFile={activeFile} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}
