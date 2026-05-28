import type { WorkflowJSON } from '../types';

const PREFIX = 'workflow_v1_';
const INDEX_KEY = 'workflow_v1_index';

async function getIndex(): Promise<string[]> {
  const result = await browser.storage.local.get(INDEX_KEY);
  return (result[INDEX_KEY] as string[] | undefined) ?? [];
}

async function setIndex(names: string[]): Promise<void> {
  await browser.storage.local.set({ [INDEX_KEY]: names });
}

export async function saveWorkflow(wf: WorkflowJSON): Promise<void> {
  const key = PREFIX + wf.name;
  const index = await getIndex();
  const updatedIndex = index.includes(wf.name) ? index : [...index, wf.name];
  await browser.storage.local.set({ [key]: wf, [INDEX_KEY]: updatedIndex });
}

export async function loadWorkflow(name: string): Promise<WorkflowJSON | null> {
  const key = PREFIX + name;
  const result = await browser.storage.local.get(key);
  const raw = result[key];
  if (!raw || typeof raw !== 'object' || !('name' in (raw as object))) return null;
  return raw as WorkflowJSON;
}

export async function listWorkflows(): Promise<string[]> {
  return getIndex();
}

export async function deleteWorkflow(name: string): Promise<void> {
  const key = PREFIX + name;
  await browser.storage.local.remove(key);
  const index = await getIndex();
  await setIndex(index.filter((n) => n !== name));
}
