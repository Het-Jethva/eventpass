import { describe, expect, it } from "vitest";

import {
  getAuditEntries,
  getDashboardStats,
  getRecentScans,
  SAMPLE_EVENT,
} from "@/features/demo/demo-sample";

describe("demo sample story", () => {
  it("starts from the published sample counts", () => {
    const stats = getDashboardStats({
      registered: false,
      admitted: false,
    });
    expect(stats.registeredCount).toBe(SAMPLE_EVENT.baseRegistered);
    expect(stats.checkedInCount).toBe(SAMPLE_EVENT.baseCheckedIn);
    expect(stats.remaining).toBe(
      SAMPLE_EVENT.capacity - SAMPLE_EVENT.baseRegistered,
    );
  });

  it("moves counts locally when the visitor registers and scans", () => {
    const afterRegister = getDashboardStats({
      registered: true,
      admitted: false,
    });
    expect(afterRegister.registeredCount).toBe(
      SAMPLE_EVENT.baseRegistered + 1,
    );

    const afterScan = getDashboardStats({ registered: true, admitted: true });
    expect(afterScan.checkedInCount).toBe(SAMPLE_EVENT.baseCheckedIn + 1);
  });

  it("surfaces the simulated scan and audit rows first", () => {
    const scans = getRecentScans({
      registered: true,
      admitted: true,
      offlineShown: true,
    });
    expect(scans[0].variant).toBe("provisional");

    const audit = getAuditEntries({
      registered: true,
      admitted: true,
      offlineShown: false,
    });
    expect(audit[0].id).toBe("check-in");
  });
});
