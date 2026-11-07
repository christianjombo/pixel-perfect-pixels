// Prototype conversation API backed by the browser-local store.
// Keeps the same call shape ({ data: ... }) as the future backend endpoints so
// the UI is wired the way the real Griv backend will be.
import {
  listLocalThreads,
  createLocalThread,
  getLocalThread,
  updateLocalThread,
  deleteLocalThread,
  listLocalMessages,
  upsertLocalMessage,
  touchLocalThread,
} from './local-store';

export const getAIWorkspace = async () => ({
  workspace: { id: 'demo-workspace', name: 'Nova Retail Ltd', timezone: 'Africa/Lagos' },
  profile: { display_name: 'Ada' },
});

export const listAIThreads = async ({ data }: { data: { environment: 'test' | 'live' } }) =>
  listLocalThreads(data.environment);

export const createAIThread = async ({
  data,
}: {
  data: { title: string; environment: 'test' | 'live'; currency: string; period: string };
}) => createLocalThread(data);

export const getAIThread = async ({ data }: { data: { threadId: string; environment: 'test' | 'live' } }) => {
  const thread = getLocalThread(data.threadId, data.environment);
  if (!thread) throw new Error('This conversation is unavailable in the selected environment.');
  return { thread, messages: listLocalMessages(data.threadId) };
};

export const updateAIThread = async ({
  data,
}: {
  data: { threadId: string; environment: 'test' | 'live'; title: string; pinned: boolean };
}) => {
  updateLocalThread(data.threadId, data.environment, { title: data.title, pinned: data.pinned });
  return { ok: true };
};

export const deleteAIThread = async ({ data }: { data: { threadId: string; environment: 'test' | 'live' } }) => {
  deleteLocalThread(data.threadId, data.environment);
  return { ok: true };
};

export const saveAIMessage = async ({
  data,
}: {
  data: { threadId: string; environment: 'test' | 'live'; message: { id: string; role: 'user' | 'assistant'; parts: unknown[] } };
}) => {
  upsertLocalMessage(data.threadId, data.message);
  const firstText = data.message.parts
    .filter((p): p is { type: string; text: string } => typeof p === 'object' && p !== null && (p as { type?: string }).type === 'text')
    .map((p) => p.text)
    .join('\n');
  touchLocalThread(data.threadId, data.message.role === 'user' ? firstText.slice(0, 70) : undefined);
  return { ok: true };
};
