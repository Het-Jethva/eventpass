import { describe, expect, it } from "vitest";

import { runBoundedTasksIgnoringFailures } from "./run-bounded-tasks";

describe("runBoundedTasksIgnoringFailures", () => {
  it("finishes remaining work after a worker rejects", async () => {
    const seen: number[] = [];
    await runBoundedTasksIgnoringFailures(
      [1, 2, 3],
      async (item) => {
        if (item === 2) throw new Error("delivery failed");
        seen.push(item);
      },
      2,
    );
    expect(seen.sort((a, b) => a - b)).toEqual([1, 3]);
  });
});
