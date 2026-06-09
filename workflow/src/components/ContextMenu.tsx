import React, { useState, useEffect, useRef } from 'react';
import { useWorkflowStore } from '../store';
import { NODE_TYPES } from './NodeLibrary';

// ─── Category groups (mirrors NodeLibrary's grouping) ─────────────────────────

interface CategoryGroup {
  name: string;
  color: string;
  entries: Array<{ subtype: string; label: string }>;
}

const CATEGORY_GROUPS: CategoryGroup[] = [];
const catIdx = new Map<string, number>();
for (const entry of NODE_TYPES) {
  if (!catIdx.has(entry.category)) {
    catIdx.set(entry.category, CATEGORY_GROUPS.length);
    CATEGORY_GROUPS.push({ name: entry.category, color: entry.color, entries: [] });
  }
  CATEGORY_GROUPS[catIdx.get(entry.category)!].entries.push({ subtype: entry.type, label: entry.label });
}

const SUBTYPE_META = new Map(NODE_TYPES.map((n) => [n.type, { label: n.label, color: n.color }]));

// ─── Shared hook: close on outside click or Escape ───────────────────────────

function useOutsideClose(containerRef: React.RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeRef.current();
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []); // stable — closeRef and containerRef don't change
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const MENU_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 6,
  boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
  overflow: 'hidden',
  fontSize: 13,
  color: '#cbd5e1',
};

// ─── Reusable menu item ───────────────────────────────────────────────────────

interface ItemProps {
  icon: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

function Item({ icon, label, danger, onClick }: ItemProps) {
  const [hov, setHov] = useState(false);
  return (
    <div
      role="menuitem"
      style={{
        padding: '7px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        userSelect: 'none',
        background: hov ? (danger ? '#3b0808' : '#1e293b') : 'transparent',
        color: danger ? (hov ? '#fca5a5' : '#f87171') : (hov ? '#f1f5f9' : '#cbd5e1'),
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      <span style={{ opacity: 0.55, minWidth: 14, textAlign: 'center', fontSize: 12 }}>{icon}</span>
      {label}
    </div>
  );
}

// ─── Node context menu ────────────────────────────────────────────────────────

export interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onClose: () => void;
}

export function NodeContextMenu({ x, y, nodeId, onClose }: NodeContextMenuProps) {
  const { nodes, duplicateNode, disconnectNode, deleteNode } = useWorkflowStore();
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, onClose);

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const meta = SUBTYPE_META.get(node.type ?? '');
  const label = meta?.label ?? node.type ?? 'Node';
  const color = meta?.color ?? '#64748b';

  // Clamp so menu never clips off screen
  const menuW = 210;
  const menuH = 136;
  const left = Math.min(x, window.innerWidth - menuW - 12);
  const top = Math.min(y, window.innerHeight - menuH - 12);

  return (
    <div ref={ref} role="menu" style={{ ...MENU_STYLE, left, top, width: menuW }}>
      {/* Header */}
      <div style={{
        padding: '7px 16px',
        borderBottom: '1px solid #1e3a5f',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
      }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{label}</span>
      </div>

      <Item icon="⎘" label="Duplicate" onClick={() => { duplicateNode(nodeId); onClose(); }} />
      <Item icon="✂" label="Disconnect edges" onClick={() => { disconnectNode(nodeId); onClose(); }} />
      <div style={{ height: 1, background: '#1e293b', margin: '2px 0' }} />
      <Item icon="✕" label="Delete" danger onClick={() => { deleteNode(nodeId); onClose(); }} />
    </div>
  );
}

// ─── Pane context menu ────────────────────────────────────────────────────────

export interface PaneContextMenuProps {
  x: number;
  y: number;
  onAddNode: (subtype: string) => void;
  onClose: () => void;
}

function PaneEntry({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      role="menuitem"
      style={{
        padding: '5px 16px 5px 26px',
        cursor: 'pointer',
        fontSize: 12,
        userSelect: 'none',
        background: hov ? '#1e293b' : 'transparent',
        color: hov ? '#f1f5f9' : '#cbd5e1',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      {label}
    </div>
  );
}

export function PaneContextMenu({ x, y, onAddNode, onClose }: PaneContextMenuProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, onClose);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = search.trim().toLowerCase();
  const groups = CATEGORY_GROUPS.map((g) => ({
    ...g,
    entries: g.entries.filter((e) =>
      !q ||
      e.label.toLowerCase().includes(q) ||
      g.name.toLowerCase().includes(q)
    ),
  })).filter((g) => g.entries.length > 0);

  const menuW = 220;
  const maxH = 400;
  const left = Math.min(x, window.innerWidth - menuW - 12);
  const top = Math.min(y, window.innerHeight - maxH - 12);

  return (
    <div ref={ref} role="menu" style={{ ...MENU_STYLE, left, top, width: menuW }}>
      {/* Search input */}
      <div style={{ padding: '7px 10px', borderBottom: '1px solid #1e3a5f' }}>
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#0a0f1a',
            border: '1px solid #334155',
            borderRadius: 4,
            padding: '5px 9px',
            color: '#f1f5f9',
            fontSize: 12,
            outline: 'none',
          }}
        />
      </div>

      {/* Node list */}
      <div style={{ maxHeight: maxH - 48, overflowY: 'auto' }}>
        {groups.length === 0 ? (
          <div style={{ padding: '10px 16px', color: '#475569', fontSize: 12 }}>No results</div>
        ) : (
          groups.map((g) => (
            <div key={g.name}>
              <div style={{
                padding: '7px 16px 3px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: g.color,
              }}>
                {g.name}
              </div>
              {g.entries.map((entry) => (
                <PaneEntry
                  key={entry.subtype}
                  label={entry.label}
                  onClick={() => { onAddNode(entry.subtype); onClose(); }}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
