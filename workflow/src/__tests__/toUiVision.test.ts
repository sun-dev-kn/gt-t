import { describe, it, expect } from 'vitest';
import { toUiVision } from '../export/toUiVision';
import type { WorkflowNode } from '../types';

function node(type: string, data: Record<string, unknown>): WorkflowNode {
  return { id: '1', type, position: { x: 0, y: 0 }, data: { subtype: type, ...data } } as WorkflowNode;
}

function cmd(type: string, data: Record<string, unknown>) {
  return toUiVision('t', [node(type, data)], []).Commands[0];
}

describe('toUiVision new browser subtypes', () => {
  it('doubleClick', () => {
    const c = cmd('doubleClick', { selector: '#btn' });
    expect(c.Command).toBe('doubleClick');
    expect(c.Target).toBe('#btn');
  });
  it('rightClick', () => {
    expect(cmd('rightClick', { selector: '#el' }).Command).toBe('rightClickAt');
  });
  it('selectOption', () => {
    const c = cmd('selectOption', { selector: 'select', value: 'opt1' });
    expect(c.Command).toBe('select');
    expect(c.Value).toBe('opt1');
  });
  it('check (checked=true)', () => {
    expect(cmd('check', { selector: '#cb', checked: true }).Command).toBe('check');
  });
  it('check (checked=false)', () => {
    expect(cmd('check', { selector: '#cb', checked: false }).Command).toBe('uncheck');
  });
  it('pressKey', () => {
    const c = cmd('pressKey', { key: 'Enter' });
    expect(c.Command).toBe('sendKeys');
    expect(c.Value).toBe('Enter');
  });
  it('dragDrop', () => {
    const c = cmd('dragDrop', { sourceSelector: '#src', targetSelector: '#tgt' });
    expect(c.Command).toBe('dragAndDropToObject');
    expect(c.Value).toBe('#tgt');
  });
  it('uploadFile', () => {
    const c = cmd('uploadFile', { selector: 'input[type=file]', fileName: 'test.pdf' });
    expect(c.Command).toBe('type');
    expect(c.Value).toBe('test.pdf');
  });
  it('paste', () => {
    const c = cmd('paste', { selector: '#el', text: 'hello' });
    expect(c.Command).toBe('type');
    expect(c.Value).toBe('hello');
  });
});

describe('toUiVision wait subtypes', () => {
  it('waitForUrl', () => {
    const c = cmd('waitForUrl', { pattern: '*/dashboard', timeoutMs: 5000 });
    expect(c.Command).toBe('waitForCondition');
    expect(c.Target).toBe('*/dashboard');
    expect(c.Value).toBe('5000');
  });
  it('waitForVisible (visible)', () => {
    expect(cmd('waitForVisible', { selector: '#el', visible: true, timeoutMs: 3000 }).Command)
      .toBe('waitForElementVisible');
  });
  it('waitForVisible (hidden)', () => {
    expect(cmd('waitForVisible', { selector: '#el', visible: false, timeoutMs: 3000 }).Command)
      .toBe('waitForElementNotPresent');
  });
});

describe('toUiVision data subtypes', () => {
  it('getCurrentUrl', () => {
    expect(cmd('getCurrentUrl', { varName: 'myUrl' }).Command).toBe('storeLocation');
  });
  it('getValue', () => {
    const c = cmd('getValue', { selector: '#inp', varName: 'v' });
    expect(c.Command).toBe('storeValue');
    expect(c.Target).toBe('#inp');
  });
  it('screenshot', () => {
    expect(cmd('screenshot', { varName: 'img' }).Command).toBe('captureScreenshot');
  });
  it('countElements', () => {
    const c = cmd('countElements', { selector: '.item', varName: 'n' });
    expect(c.Command).toBe('storeXpathCount');
  });
});

describe('toUiVision control subtypes', () => {
  it('forEach', () => {
    const c = cmd('forEach', { listVar: 'items', itemVar: 'item' });
    expect(c.Command).toBe('forEach');
    expect(c.Target).toBe('items');
    expect(c.Value).toBe('item');
  });
  it('tryCatch', () => {
    expect(cmd('tryCatch', {}).Command).toBe('comment');
  });
});

describe('toUiVision variable subtypes', () => {
  it('setVariable', () => {
    const c = cmd('setVariable', { varName: 'x', value: 'hello' });
    expect(c.Command).toBe('store');
    expect(c.Value).toBe('x');
  });
  it('setArray serialises to JSON', () => {
    const c = cmd('setArray', { varName: 'arr', items: ['a', 'b'] });
    expect(c.Command).toBe('store');
    expect(c.Target).toBe(JSON.stringify(['a', 'b']));
  });
  it('setObject serialises to JSON', () => {
    const c = cmd('setObject', { varName: 'obj', pairs: [{ key: 'k', value: 'v' }] });
    expect(c.Command).toBe('store');
    expect(JSON.parse(c.Target)).toEqual({ k: 'v' });
  });
});

describe('toUiVision page subtypes', () => {
  it('goBack',    () => expect(cmd('goBack', {}).Command).toBe('goBack'));
  it('goForward', () => expect(cmd('goForward', {}).Command).toBe('goForward'));
  it('reload',    () => expect(cmd('reload', {}).Command).toBe('refresh'));
  it('openTab',   () => expect(cmd('openTab', { url: 'https://x.com' }).Command).toBe('open'));
  it('closeTab',  () => expect(cmd('closeTab', {}).Command).toBe('closeWindow'));
  it('switchTab', () => expect(cmd('switchTab', { urlPattern: '*/admin' }).Command).toBe('selectWindow'));
  it('runScript', () => {
    const c = cmd('runScript', { script: 'return 1', varName: 'r' });
    expect(c.Command).toBe('executeScript');
  });
});

describe('toUiVision human subtypes', () => {
  it('notifyUser', () => {
    const c = cmd('notifyUser', { title: 'T', message: 'M', waitForDismiss: false });
    expect(c.Command).toBe('comment');
    expect(c.Target).toContain('T');
  });
});
