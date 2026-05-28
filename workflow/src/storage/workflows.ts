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
  await browser.storage.local.set({ [key]: wf });
  const index = await getIndex();
  if (!index.includes(wf.name)) {
    await setIndex([...index, wf.name]);
  }
}

export async function loadWorkflow(name: string): Promise<WorkflowJSON | null> {
  const key = PREFIX + name;
  const result = await browser.storage.local.get(key);
  return (result[key] as WorkflowJSON | undefined) ?? null;
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
