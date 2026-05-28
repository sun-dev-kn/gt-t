import { saveWorkflow, loadWorkflow, listWorkflows, deleteWorkflow } from '../storage/workflows';
import type { WorkflowJSON } from '../types';

const sample: WorkflowJSON = {
  name: 'test-workflow',
  domain: 'example.com',
  nodes: [],
  edges: [],
};

test('saveWorkflow persists and loadWorkflow retrieves it', async () => {
  await saveWorkflow(sample);
  const loaded = await loadWorkflow('test-workflow');
  expect(loaded).not.toBeNull();
  expect(loaded!.name).toBe('test-workflow');
  expect(loaded!.domain).toBe('example.com');
});

test('listWorkflows returns saved workflow names', async () => {
  await saveWorkflow(sample);
  await saveWorkflow({ ...sample, name: 'second' });
  const names = await listWorkflows();
  expect(names).toContain('test-workflow');
  expect(names).toContain('second');
});

test('loadWorkflow returns null for unknown name', async () => {
  const result = await loadWorkflow('nonexistent');
  expect(result).toBeNull();
});

test('deleteWorkflow removes the entry', async () => {
  await saveWorkflow(sample);
  await deleteWorkflow('test-workflow');
  const result = await loadWorkflow('test-workflow');
  expect(result).toBeNull();
});

test('deleteWorkflow removes name from index', async () => {
  await saveWorkflow(sample);
  await deleteWorkflow('test-workflow');
  const names = await listWorkflows();
  expect(names).not.toContain('test-workflow');
});

test('saveWorkflow is idempotent — saving twice does not duplicate index entry', async () => {
  await saveWorkflow(sample);
  await saveWorkflow({ ...sample, domain: 'updated.com' });
  const names = await listWorkflows();
  const count = names.filter((n) => n === 'test-workflow').length;
  expect(count).toBe(1);
});
