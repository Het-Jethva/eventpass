export async function runBoundedTasks<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  concurrency = 5,
) {
  const workerCount = Math.min(concurrency, items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const itemIndex = nextIndex;
        nextIndex += 1;
        const item = items[itemIndex];
        if (item === undefined) return;
        await worker(item);
      }
    }),
  );
}
