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
  { type: 'doubleClick',      label: 'Double click',       category: 'Browser',  color: '#3b82f6' },
  { type: 'rightClick',       label: 'Right click',        category: 'Browser',  color: '#3b82f6' },
  { type: 'selectOption',     label: 'Select option',      category: 'Browser',  color: '#3b82f6' },
  { type: 'check',            label: 'Check',              category: 'Browser',  color: '#3b82f6' },
  { type: 'pressKey',         label: 'Press key',          category: 'Browser',  color: '#3b82f6' },
  { type: 'dragDrop',         label: 'Drag & drop',        category: 'Browser',  color: '#3b82f6' },
  { type: 'uploadFile',       label: 'Upload file',        category: 'Browser',  color: '#3b82f6' },
  { type: 'paste',            label: 'Paste',              category: 'Browser',  color: '#3b82f6' },
  { type: 'waitForSelector',   label: 'Wait for selector',  category: 'Wait',     color: '#f59e0b' },
  { type: 'delay',             label: 'Delay',              category: 'Wait',     color: '#f59e0b' },
  { type: 'networkIdle',       label: 'Network idle',       category: 'Wait',     color: '#f59e0b' },
  { type: 'waitForUrl',        label: 'Wait for URL',       category: 'Wait',     color: '#f59e0b' },
  { type: 'waitForVisible',    label: 'Wait visible',       category: 'Wait',     color: '#f59e0b' },
  { type: 'extract',           label: 'Extract',            category: 'Data',     color: '#8b5cf6' },
  { type: 'extractTable',      label: 'Extract table',      category: 'Data',     color: '#8b5cf6' },
  { type: 'getCurrentUrl',     label: 'Get current URL',    category: 'Data',     color: '#8b5cf6' },
  { type: 'getValue',          label: 'Get value',          category: 'Data',     color: '#8b5cf6' },
  { type: 'screenshot',        label: 'Screenshot',         category: 'Data',     color: '#8b5cf6' },
  { type: 'countElements',     label: 'Count elements',     category: 'Data',     color: '#8b5cf6' },
  { type: 'condition',         label: 'Condition',          category: 'Control',  color: '#94a3b8' },
  { type: 'loop',              label: 'Loop',               category: 'Control',  color: '#94a3b8' },
  { type: 'merge',             label: 'Merge',              category: 'Control',  color: '#94a3b8' },
  { type: 'forEach',           label: 'For each',           category: 'Control',  color: '#94a3b8' },
  { type: 'tryCatch',          label: 'Try/Catch',          category: 'Control',  color: '#94a3b8' },
  { type: 'injectCredentials', label: 'Inject credentials', category: 'Account',  color: '#ec4899' },
  { type: 'switchAccount',     label: 'Switch account',     category: 'Account',  color: '#ec4899' },
  { type: 'sendToBackend',     label: 'Send to backend',    category: 'Output',   color: '#e94560' },
  { type: 'saveLocally',       label: 'Save locally',       category: 'Output',   color: '#e94560' },
  { type: 'setVariable',       label: 'Set variable',       category: 'Variables', color: '#06b6d4' },
  { type: 'setArray',          label: 'Set array',          category: 'Variables', color: '#06b6d4' },
  { type: 'setObject',         label: 'Set object',         category: 'Variables', color: '#06b6d4' },
  { type: 'goBack',            label: 'Go back',            category: 'Page',      color: '#ec4899' },
  { type: 'goForward',         label: 'Go forward',         category: 'Page',      color: '#ec4899' },
  { type: 'reload',            label: 'Reload',             category: 'Page',      color: '#ec4899' },
  { type: 'openTab',           label: 'Open tab',           category: 'Page',      color: '#ec4899' },
  { type: 'closeTab',          label: 'Close tab',          category: 'Page',      color: '#ec4899' },
  { type: 'switchTab',         label: 'Switch tab',         category: 'Page',      color: '#ec4899' },
  { type: 'runScript',         label: 'Run script',         category: 'Page',      color: '#ec4899' },
  { type: 'notifyUser',        label: 'Notify user',        category: 'Human',     color: '#f97316' },
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
