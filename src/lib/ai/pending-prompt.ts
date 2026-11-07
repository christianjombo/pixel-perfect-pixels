// Handoff for a prompt chosen on the AI home screen (suggestion cards) that
// must survive the navigation remount into the new conversation screen.
let pending: string | null = null;

export const setPendingPrompt = (prompt: string) => {
  pending = prompt;
};

export const takePendingPrompt = (): string => {
  const prompt = pending;
  pending = null;
  return prompt ?? '';
};
