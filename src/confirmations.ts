interface Pending {
  resolve: (approved: boolean) => void;
}

const pending = new Map<number, Pending>();

export function waitForConfirmation(chatId: number): Promise<boolean> {
  return new Promise((resolve) => {
    pending.set(chatId, { resolve });
  });
}

export function resolvePendingConfirmation(chatId: number, approved: boolean): boolean {
  const entry = pending.get(chatId);
  if (!entry) return false;
  pending.delete(chatId);
  entry.resolve(approved);
  return true;
}

export function hasPendingConfirmation(chatId: number): boolean {
  return pending.has(chatId);
}
