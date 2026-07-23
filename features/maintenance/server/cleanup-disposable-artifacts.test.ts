import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { cleanupDisposableArtifacts } from "./cleanup-disposable-artifacts";

describe("Cleanup Disposable Artifacts Service", () => {
  it("executes deletion queries for expired sessions, verifications, capacity holds, and registration verifications", async () => {
    const mockDelete = vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "1" }, { id: "2" }]),
      })),
    }));

    const mockDb = {
      delete: mockDelete,
    } as unknown as Parameters<typeof cleanupDisposableArtifacts>[1];

    const now = new Date("2026-07-23T12:00:00Z");
    const summary = await cleanupDisposableArtifacts(now, mockDb);

    expect(summary).toEqual({
      deletedSessions: 2,
      deletedVerifications: 2,
      deletedCapacityHolds: 2,
      deletedRegistrationVerifications: 2,
      runAt: "2026-07-23T12:00:00.000Z",
    });
    expect(mockDelete).toHaveBeenCalledTimes(4);
  });
});
