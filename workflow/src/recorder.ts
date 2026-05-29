// Content script: captures DOM interactions, relays to background via port.
// Compiled as IIFE to ../recorder.js via vite.recorder.config.ts.
// Activated by RECORDER_ACTIVATE message from background.

declare const chrome: {
  runtime: {
    connect: (opts: { name: string }) => {
      postMessage: (msg: unknown) => void;
      onMessage: { addListener: (cb: (msg: unknown) => void) => void };
      onDisconnect: { addListener: (cb: () => void) => void };
      disconnect: () => void;
    };
    onMessage: {
      addListener: (cb: (msg: { type: string }) => void) => void;
    };
  };
};

type SelectorStrategy = 'id' | 'aria' | 'name' | 'css' | 'xpath';

interface RecordedEvent {
  type: string;
  selector: string;
  selectorStrategy: SelectorStrategy;
  value?: string;
  checked?: boolean;
  key?: string;
  targetSelector?: string;
  position?: { x: number; y: number };
  timestamp: number;
  url: string;
  frameId: number;
}

// ─── Selector generation ──────────────────────────────────────────────────────

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}/i;
const NUMERIC_ONLY = /^\d+$/;

function getSelector(el: Element): { selector: string; strategy: SelectorStrategy } {
  if (el.id && !UUID_PATTERN.test(el.id) && !NUMERIC_ONLY.test(el.id)) {
    return { selector: `#${CSS.escape(el.id)}`, strategy: 'id' };
  }
  for (const attr of ['data-testid', 'data-cy', 'data-qa']) {
    const val = el.getAttribute(attr);
    if (val) return { selector: `[${attr}="${CSS.escape(val)}"]`, strategy: 'css' };
  }
  const aria = el.getAttribute('aria-label');
  if (aria) return { selector: `[aria-label="${CSS.escape(aria)}"]`, strategy: 'aria' };
  const name = el.getAttribute('name');
  if (name) return { selector: `[name="${CSS.escape(name)}"]`, strategy: 'name' };
  const css = buildCssPath(el, 3);
  if (css) return { selector: css, strategy: 'css' };
  return { selector: buildXPath(el), strategy: 'xpath' };
}

function buildCssPath(el: Element, maxHops: number): string | null {
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let i = 0; i < maxHops && cur && cur !== document.documentElement; i++) {
    const tag = cur.tagName.toLowerCase();
    const cls = Array.from(cur.classList)
      .filter((c) => !UUID_PATTERN.test(c)).slice(0, 2)
      .map((c) => `.${CSS.escape(c)}`).join('');
    const type = cur.getAttribute('type');
    parts.unshift(`${tag}${cls}${type ? `[type="${type}"]` : ''}`);
    const candidate = parts.join(' > ');
    if (document.querySelectorAll(candidate).length === 1) return candidate;
    cur = cur.parentElement;
  }
  return null;
}

function buildXPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.documentElement) {
    const tag = cur.tagName.toLowerCase();
    const parent = cur.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
      const idx = siblings.indexOf(cur) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}[${idx}]` : tag);
    } else {
      parts.unshift(tag);
    }
    cur = cur.parentElement;
  }
  return `//${parts.join('/')}`;
}

// ─── Port and state ───────────────────────────────────────────────────────────

let port: ReturnType<typeof chrome.runtime.connect> | null = null;
let active = false;

function send(event: RecordedEvent) {
  port?.postMessage({ type: 'RECORDED_EVENT', event });
}

function base(el: Element): Omit<RecordedEvent, 'type'> {
  const { selector, strategy } = getSelector(el);
  return { selector, selectorStrategy: strategy, timestamp: Date.now(), url: location.href, frameId: 0 };
}

// ─── Debounce helpers ─────────────────────────────────────────────────────────

const fillTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let hoverEl: Element | null = null;
let dragSrc: Element | null = null;

// ─── DOM handlers ─────────────────────────────────────────────────────────────

function onClick(e: MouseEvent) {
  if (!active || e.detail === 2) return;
  send({ ...base(e.target as Element), type: 'click' });
}

function onDblclick(e: MouseEvent) {
  if (!active) return;
  send({ ...base(e.target as Element), type: 'dblclick' });
}

function onContextmenu(e: MouseEvent) {
  if (!active) return;
  send({ ...base(e.target as Element), type: 'rightClick' });
}

function onInput(e: Event) {
  if (!active) return;
  const el = e.target as HTMLInputElement;
  if (!('value' in el)) return;
  const t = fillTimers.get(el);
  if (t) clearTimeout(t);
  fillTimers.set(el, setTimeout(() => {
    fillTimers.delete(el);
    send({ ...base(el), type: 'fill', value: el.value });
  }, 800));
}

function onChange(e: Event) {
  if (!active) return;
  const el = e.target as HTMLSelectElement | HTMLInputElement;
  if (el.tagName === 'SELECT') {
    send({ ...base(el), type: 'selectOption', value: (el as HTMLSelectElement).value });
  } else if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    send({ ...base(el), type: 'check', checked: el.checked });
  }
}

function onScroll(e: Event) {
  if (!active) return;
  const el = e.target as Element;
  if (!el || (el as Node) === document) return;
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    scrollTimer = null;
    send({ ...base(el), type: 'scroll' });
  }, 300);
}

function onMouseover(e: Event) {
  if (!active) return;
  const el = e.target as Element;
  if (el === hoverEl) return;
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverEl = el;
  hoverTimer = setTimeout(() => {
    send({ ...base(el), type: 'hover' });
    hoverEl = null;
    hoverTimer = null;
  }, 500);
}

function onMouseout() {
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  hoverEl = null;
}

const SPECIAL_KEYS = new Set([
  'Enter', 'Tab', 'Escape', 'Backspace', 'Delete',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown',
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
]);

function onKeydown(e: KeyboardEvent) {
  if (!active) return;
  const modified = e.ctrlKey || e.altKey || e.metaKey;
  if (!modified && !SPECIAL_KEYS.has(e.key)) return;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Control');
  if (e.altKey) parts.push('Alt');
  if (e.metaKey) parts.push('Meta');
  if (e.shiftKey && modified) parts.push('Shift');
  parts.push(e.key);
  send({ ...base(e.target as Element), type: 'pressKey', key: parts.join('+') });
}

function onDragstart(e: DragEvent) {
  if (!active) return;
  dragSrc = e.target as Element;
}

function onDragend(e: DragEvent) {
  if (!active || !dragSrc) return;
  const tgt = document.elementFromPoint(e.clientX, e.clientY);
  if (tgt && tgt !== dragSrc) {
    const { selector: tgtSel } = getSelector(tgt);
    send({ ...base(dragSrc), type: 'dragDrop', targetSelector: tgtSel, position: { x: e.clientX, y: e.clientY } });
  }
  dragSrc = null;
}

function onPaste(e: ClipboardEvent) {
  if (!active) return;
  send({ ...base(e.target as Element), type: 'paste', value: e.clipboardData?.getData('text') ?? '' });
}

// ─── Activation ───────────────────────────────────────────────────────────────

function startCapture() {
  active = true;
  port = chrome.runtime.connect({ name: 'recorder' });
  port.onDisconnect.addListener(() => { port = null; active = false; });

  const o = { capture: true };
  document.addEventListener('click', onClick, o);
  document.addEventListener('dblclick', onDblclick, o);
  document.addEventListener('contextmenu', onContextmenu, o);
  document.addEventListener('input', onInput, o);
  document.addEventListener('change', onChange, o);
  document.addEventListener('scroll', onScroll, { ...o, passive: true });
  document.addEventListener('mouseover', onMouseover, o);
  document.addEventListener('mouseout', onMouseout, o);
  document.addEventListener('keydown', onKeydown, o);
  document.addEventListener('dragstart', onDragstart, o);
  document.addEventListener('dragend', onDragend, o);
  document.addEventListener('paste', onPaste, o);

  // Announce current page
  send({ type: 'navigate', selector: '', selectorStrategy: 'css', timestamp: Date.now(), url: location.href, frameId: 0 });
}

chrome.runtime.onMessage.addListener((msg: { type: string }) => {
  if (msg.type === 'RECORDER_ACTIVATE' && !active) {
    startCapture();
  }
});
