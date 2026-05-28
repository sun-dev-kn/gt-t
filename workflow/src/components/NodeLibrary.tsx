import React from 'react';

interface NodeTypeEntry {
  type: string;
  label: string;
  category: string;
  color: string;
}

const NODE_TYPES: NodeTypeEntry[] = [
  { type: 'schedule',          label: 'Schedule',           category: 'Trigger',  color: '#10b981' },
  { type: 'manual',            label: 'Manual',             category: 'Trigger',  color: '#10b981' },
  { type: 'navigate',          label: 'Navigate',           category: 'Browser',  color: '#3b82f6' },
  { type: 'click',             label: 'Click',              category: 'Browser',  color: '#3b82f6' },
  { type: 'fill',              label: 'Fill',               category: 'Browser',  color: '#3b82f6' },
  { type: 'scroll',            label: 'Scroll',             category: 'Browser',  color: '#3b82f6' },
  { type: 'hover',             label: 'Hover',              category: 'Browser',  color: '#3b82f6' },
  { type: 'waitForSelector',   label: 'Wait for selector',  category: 'Wait',     color: '#f59e0b' },
  { type: 'delay',             label: 'Delay',              category: 'Wait',     color: '#f59e0b' },
  { type: 'networkIdle',       label: 'Network idle',       category: 'Wait',     color: '#f59e0b' },
  { type: 'extract',           label: 'Extract',            category: 'Data',     color: '#8b5cf6' },
  { type: 'extractTable',      label: 'Extract table',      category: 'Data',     color: '#8b5cf6' },
  { type: 'condition',         label: 'Condition',          category: 'Control',  color: '#94a3b8' },
  { type: 'loop',              label: 'Loop',               category: 'Control',  color: '#94a3b8' },
  { type: 'merge',             label: 'Merge',              category: 'Control',  color: '#94a3b8' },
  { type: 'injectCredentials', label: 'Inject credentials', category: 'Account',  color: '#ec4899' },
  { type: 'switchAccount',     label: 'Switch account',     category: 'Account',  color: '#ec4899' },
  { type: 'sendToBackend',     label: 'Send to backend',    category: 'Output',   color: '#e94560' },
  { type: 'saveLocally',       label: 'Save locally',       category: 'Output',   color: '#e94560' },
];

// Group entries by category, preserving insertion order
const CATEGORIES: Array<{ name: string; color: string; entries: NodeTypeEntry[] }> = [];
const seen = new Map<string, number>();
for (const entry of NODE_TYPES) {
  if (!seen.has(entry.category)) {
    seen.set(entry.category, CATEGORIES.length);
    CATEGORIES.push({ name: entry.category, color: entry.color, entries: [] });
  }
  CATEGORIES[seen.get(entry.category)!].entries.push(entry);
}

function handleDragStart(e: React.DragEvent<HTMLDivElement>, nodeType: string) {
  e.dataTransfer.setData('application/reactflow-nodetype', nodeType);
  e.dataTransfer.effectAllowed = 'move';
}

export function NodeLibrary() {
  return (
    <aside
      style={{
        width: 200,
        minWidth: 200,
        background: '#1e293b',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #334155',
      }}
    >
      {CATEGORIES.map((cat) => (
        <div key={cat.name} style={{ marginBottom: 4 }}>
          <div
            style={{
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: cat.color,
              borderTop: `2px solid ${cat.color}`,
              background: '#0f172a',
            }}
          >
            {cat.name}
          </div>
          {cat.entries.map((entry) => (
            <div
              key={entry.type}
              draggable
              data-testid={`node-type-${entry.type}`}
              onDragStart={(e) => handleDragStart(e, entry.type)}
              style={{
                padding: '5px 14px',
                fontSize: 13,
                color: '#cbd5e1',
                cursor: 'grab',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = '#1e3a5f';
                (e.currentTarget as HTMLDivElement).style.color = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                (e.currentTarget as HTMLDivElement).style.color = '#cbd5e1';
              }}
            >
              {entry.label}
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}
