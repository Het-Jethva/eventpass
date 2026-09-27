export function shouldDeferUpdate({
  pendingAttemptCount,
}: {
  pendingAttemptCount: number;
}): boolean {
  return pendingAttemptCount > 0;
}

export function shouldPurgeCachedEvent({
  checkInClosed,
  pendingAttemptCount,
}: {
  checkInClosed: boolean;
  pendingAttemptCount: number;
}): boolean {
  return checkInClosed && pendingAttemptCount === 0;
}
