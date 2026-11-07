// Browser-local prototype store for Griv AI conversations.
// This stands in for the future Griv backend: threads and messages persist in
// localStorage so the prototype demonstrates the full interaction model
// (history, rename, pin, delete, scoped environments) without accounts.
export interface LocalAIThread {
  id: string;
  title: string;
  pinned: boolean;
  environment: 'test' | 'live';
  currency: string;
  period: string;
  created_at: string;
  updated_at: string;
}

export interface LocalAIMessage {
  sdk_id: string;
  role: 'user' | 'assistant';
  parts: unknown[];
  created_at: string;
}

const THREADS_KEY = 'griv-ai-threads';
const messagesKey = (threadId: string) => `griv-ai-messages-${threadId}`;

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable; the prototype continues without persistence.
  }
};

const readAll = () => read<LocalAIThread[]>(THREADS_KEY, []);

export const listLocalThreads = (environment: 'test' | 'live'): LocalAIThread[] =>
  readAll()
    .filter((t) => t.environment === environment)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));

export const createLocalThread = (input: {
  title: string;
  environment: 'test' | 'live';
  currency: string;
  period: string;
}): LocalAIThread => {
  const now = new Date().toISOString();
  const thread: LocalAIThread = { id: crypto.randomUUID(), pinned: false, created_at: now, updated_at: now, ...input };
  write(THREADS_KEY, [thread, ...readAll()]);
  return thread;
};

export const getLocalThread = (threadId: string, environment: 'test' | 'live'): LocalAIThread | null =>
  listLocalThreads(environment).find((t) => t.id === threadId) ?? null;

export const updateLocalThread = (
  threadId: string,
  environment: 'test' | 'live',
  patch: { title?: string; pinned?: boolean },
) => {
  write(
    THREADS_KEY,
    readAll().map((t) =>
      t.id === threadId && t.environment === environment
        ? { ...t, ...patch, updated_at: new Date().toISOString() }
        : t,
    ),
  );
};

export const touchLocalThread = (threadId: string, title?: string) => {
  write(
    THREADS_KEY,
    readAll().map((t) =>
      t.id === threadId
        ? { ...t, updated_at: new Date().toISOString(), ...(title && t.title === 'New conversation' ? { title } : {}) }
        : t,
    ),
  );
};

export const deleteLocalThread = (threadId: string, environment: 'test' | 'live') => {
  write(
    THREADS_KEY,
    readAll().filter((t) => !(t.id === threadId && t.environment === environment)),
  );
  try {
    localStorage.removeItem(messagesKey(threadId));
  } catch {
    // ignore
  }
};

export const listLocalMessages = (threadId: string): LocalAIMessage[] => read<LocalAIMessage[]>(messagesKey(threadId), []);

export const upsertLocalMessage = (
  threadId: string,
  message: { id: string; role: 'user' | 'assistant'; parts: unknown[] },
) => {
  const messages = listLocalMessages(threadId).filter((m) => m.sdk_id !== message.id);
  messages.push({ sdk_id: message.id, role: message.role, parts: message.parts, created_at: new Date().toISOString() });
  write(messagesKey(threadId), messages);
};
