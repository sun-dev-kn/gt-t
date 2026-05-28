import type { WorkflowNode, WorkflowEdge, NodeData, UiVisionMacro, UiVisionCommand } from '../types';

// ─── Subtype → node type map ──────────────────────────────────────────────────

const subtypeToNodeType: Record<string, string> = {
  manual: 'trigger',
  schedule: 'trigger',
  navigate: 'navigate',
  click: 'click',
  fill: 'fill',
  scroll: 'scroll',
  hover: 'hover',
  waitForSelector: 'waitForSelector',
  delay: 'delay',
  networkIdle: 'networkIdle',
  extract: 'extract',
  extractTable: 'extractTable',
  condition: 'condition',
  loop: 'loop',
  merge: 'merge',
  injectCredentials: 'injectCredentials',
  switchAccount: 'switchAccount',
  sendToBackend: 'sendToBackend',
  saveLocally: 'saveLocally',
};

// ─── Command → NodeData ───────────────────────────────────────────────────────

function commandToNodeData(cmd: UiVisionCommand): NodeData | null {
  const { Command, Target, Value } = cmd;

  switch (Command) {
    case 'open':
      return { subtype: 'navigate', url: Target };

    case 'click':
      return { subtype: 'click', selector: Target };

    case 'type':
      return { subtype: 'fill', selector: Target, value: Value };

    case 'scrollTo': {
      const parts = Value.split(',');
      const direction = (parts[0] as 'down' | 'up') || 'down';
      const amount = parseInt(parts[1], 10) || 0;
      return { subtype: 'scroll', selector: Target, direction, amount };
    }

    case 'mouseOver':
      return { subtype: 'hover', selector: Target };

    case 'waitForElementPresent':
      return { subtype: 'waitForSelector', selector: Target, timeoutMs: parseInt(Value, 10) || 5000 };

    case 'pause':
      return { subtype: 'delay', ms: parseInt(Target, 10) || 1000 };

    case 'waitForPageToLoad':
      return { subtype: 'networkIdle' };

    case 'storeText':
      return {
        subtype: 'extract',
        fields: [{ selector: Target, name: Value }],
        varName: Value,
      };

    case 'if_v2': {
      const parts = cmd.Target.split('|');
      if (parts.length < 3) return null; // skip malformed
      const [variable, opRaw, value] = parts;
      const VALID_OPS = ['==', '!=', '>', '<', 'contains'] as const;
      type CondOp = typeof VALID_OPS[number];
      const operator: CondOp = (VALID_OPS as readonly string[]).includes(opRaw) ? opRaw as CondOp : '==';
      return { subtype: 'condition', variable: variable ?? '', operator, value: value ?? '' };
    }

    case 'times':
      return {
        subtype: 'loop',
        maxIterations: parseInt(Target, 10) || 1,
        continueVariable: Value,
      };

    case 'comment':
      if (Target === 'Manual trigger') {
        return { subtype: 'manual' };
      }
      if (Target.startsWith('Scheduled every')) {
        const match = Target.match(/\d+/);
        const intervalHours = parseInt(match?.[0] ?? '24', 10);
        return { subtype: 'schedule', intervalHours };
      }
      if (Target === 'merge') {
        return { subtype: 'merge' };
      }
      if (Target === 'injectCredentials') {
        return { subtype: 'injectCredentials' };
      }
      if (Target === 'switchAccount') {
        return { subtype: 'switchAccount' };
      }
      if (Target === 'sendToBackend') {
        return { subtype: 'sendToBackend' };
      }
      if (Target === 'saveLocally') {
        return { subtype: 'saveLocally' };
      }
      return null;

    default:
      return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function fromUiVision(macro: UiVisionMacro): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const nodes: WorkflowNode[] = [];

  macro.Commands.forEach((cmd, index) => {
    const data = commandToNodeData(cmd);
    if (!data) return;
    const nodeType = subtypeToNodeType[data.subtype];
    if (!nodeType) return;
    const id = typeof cmd.Description === 'string' && cmd.Description ? cmd.Description : crypto.randomUUID();
    nodes.push({
      id,
      type: nodeType,
      position: { x: 100, y: index * 120 },
      data,
    });
  });

  const edges: WorkflowEdge[] = nodes.slice(1).map((node, i) => ({
    id: `imported-e-${i}`,
    source: nodes[i].id,
    target: node.id,
    type: 'typed',
  }));

  return { nodes, edges };
}
