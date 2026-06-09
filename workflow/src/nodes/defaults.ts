import type { NodeData } from '../types';

export function getDefaultData(nodeType: string): NodeData | null {
  switch (nodeType) {
    case 'trigger':           return { subtype: 'manual' };
    case 'schedule':          return { subtype: 'schedule', intervalHours: 24 };
    case 'manual':            return { subtype: 'manual' };
    case 'navigate':          return { subtype: 'navigate', url: '' };
    case 'click':             return { subtype: 'click', selector: '' };
    case 'fill':              return { subtype: 'fill', selector: '', value: '' };
    case 'scroll':            return { subtype: 'scroll', selector: '', direction: 'down', amount: 300 };
    case 'hover':             return { subtype: 'hover', selector: '' };
    case 'doubleClick':       return { subtype: 'doubleClick', selector: '' };
    case 'rightClick':        return { subtype: 'rightClick', selector: '' };
    case 'selectOption':      return { subtype: 'selectOption', selector: '', value: '' };
    case 'check':             return { subtype: 'check', selector: '', checked: true };
    case 'pressKey':          return { subtype: 'pressKey', key: 'Enter' };
    case 'dragDrop':          return { subtype: 'dragDrop', sourceSelector: '', targetSelector: '' };
    case 'uploadFile':        return { subtype: 'uploadFile', selector: '', fileName: '' };
    case 'paste':             return { subtype: 'paste', selector: '', text: '' };
    case 'waitForSelector':   return { subtype: 'waitForSelector', selector: '', timeoutMs: 5000 };
    case 'delay':             return { subtype: 'delay', ms: 1000 };
    case 'networkIdle':       return { subtype: 'networkIdle' };
    case 'waitForUrl':        return { subtype: 'waitForUrl', pattern: '', timeoutMs: 5000 };
    case 'waitForVisible':    return { subtype: 'waitForVisible', selector: '', visible: true, timeoutMs: 5000 };
    case 'extract':           return { subtype: 'extract', fields: [], varName: '' };
    case 'extractTable':      return { subtype: 'extractTable', selector: '', varName: '' };
    case 'getCurrentUrl':     return { subtype: 'getCurrentUrl', varName: '' };
    case 'getValue':          return { subtype: 'getValue', selector: '', varName: '' };
    case 'screenshot':        return { subtype: 'screenshot', varName: '' };
    case 'countElements':     return { subtype: 'countElements', selector: '', varName: '' };
    case 'condition':         return { subtype: 'condition', variable: '', operator: '==', value: '' };
    case 'loop':              return { subtype: 'loop', maxIterations: 10, continueVariable: '' };
    case 'merge':             return { subtype: 'merge' };
    case 'forEach':           return { subtype: 'forEach', listVar: '', itemVar: 'item' };
    case 'tryCatch':          return { subtype: 'tryCatch' };
    case 'injectCredentials': return { subtype: 'injectCredentials' };
    case 'switchAccount':     return { subtype: 'switchAccount' };
    case 'sendToBackend':     return { subtype: 'sendToBackend' };
    case 'saveLocally':       return { subtype: 'saveLocally' };
    case 'setVariable':       return { subtype: 'setVariable', varName: '', value: '' };
    case 'setArray':          return { subtype: 'setArray', varName: '', items: [] };
    case 'setObject':         return { subtype: 'setObject', varName: '', pairs: [] };
    case 'goBack':            return { subtype: 'goBack' };
    case 'goForward':         return { subtype: 'goForward' };
    case 'reload':            return { subtype: 'reload' };
    case 'openTab':           return { subtype: 'openTab', url: '' };
    case 'closeTab':          return { subtype: 'closeTab' };
    case 'switchTab':         return { subtype: 'switchTab', urlPattern: '' };
    case 'runScript':         return { subtype: 'runScript', script: '' };
    case 'notifyUser':        return { subtype: 'notifyUser', title: '', message: '', waitForDismiss: false };
    default:                  return null;
  }
}
