export async function runBoundedTasks<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  concurrency = 5,
) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new RangeError("Concurrency must be a positive safe integer.");
  }
  const workerCount = Math.min(concurrency, items.length);
  const iterator = items.values();

  const results = await Promise.allSettled(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const next = iterator.next();
        if (next.done) return;
        await worker(next.value);
      }
    }),
  );
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}

export async function runBoundedTasksIgnoringFailures<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  concurrency = 5,
) {
  await runBoundedTasks(
    items,
    async (item) => {
      try {
        await worker(item);
      } catch {
        return;
      }
    },
    concurrency,
  );
}
