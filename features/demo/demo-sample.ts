// Sample story for the public /demo route. Frontend only: no database rows,
// no service, no auth. The landing showcases already render real components
// with invented props; this file is the same idea carried across three steps
// so a recruiter sees the full loop in one place.

export const SAMPLE_EVENT = {
  name: "Robotics Society Winter Showcase",
  venue: "Whitcombe Hall, Building C",
  schedule: "Fri, Dec 5, 6:30 – 9:30 PM",
  entrance: "North entrance",
  capacity: 240,
  baseRegistered: 183,
  baseCheckedIn: 121,
  attendeeName: "Priya Raman",
  attendeeEmail: "priya@example.com",
  ticketCode: "7QM4X-K3B9T",
} as const;

type DemoScanVariant = "success" | "provisional" | "warning";

export type DemoScan = {
  id: string;
  name: string;
  code: string;
  time: string;
  label: string;
  variant: DemoScanVariant;
};

export type DemoAuditEntry = {
  id: string;
  time: string;
  text: string;
};

export type DemoScanState =
  | { kind: "ready" }
  | { kind: "online" | "offline" | "synced"; repeated: boolean };

const BASE_SCANS: DemoScan[] = [
  {
    id: "amara",
    name: "Amara Okafor",
    code: "3JD8M–P2K7C",
    time: "19:42:06",
    label: "Checked in",
    variant: "success",
  },
  {
    id: "leo",
    name: "Leo Martinez",
    code: "8RW2F–N6Q4A",
    time: "19:41:51",
    label: "Not confirmed",
    variant: "provisional",
  },
  {
    id: "maya",
    name: "Maya Singh",
    code: "5TC9B–H7X3E",
    time: "19:41:28",
    label: "Repeat scan",
    variant: "warning",
  },
];

const BASE_AUDIT: DemoAuditEntry[] = [
  {
    id: "doors",
    time: "19:30:00",
    text: "Organizer opened 2 doors for the north entrance.",
  },
  {
    id: "import",
    time: "18:05:12",
    text: "Organizer imported 40 confirmed registrations.",
  },
];

export function getDashboardStats(state: {
  registered: boolean;
  admitted: boolean;
}) {
  const registeredCount =
    SAMPLE_EVENT.baseRegistered + (state.registered ? 1 : 0);
  const checkedInCount = SAMPLE_EVENT.baseCheckedIn + (state.admitted ? 1 : 0);
  const remaining = SAMPLE_EVENT.capacity - registeredCount;
  const percent = Math.round((checkedInCount / SAMPLE_EVENT.capacity) * 100);
  return { registeredCount, checkedInCount, remaining, percent };
}

export function getRecentScans(state: {
  guestName: string;
  scan: DemoScanState;
}): DemoScan[] {
  const rows = [...BASE_SCANS];
  if (state.scan.kind !== "ready") {
    rows.unshift({
      id: "guest-scan",
      name: state.guestName,
      code: "7QM4X–K3B9T",
      time: "19:42:18",
      label: state.scan.kind === "offline" ? "Not confirmed" : "Checked in",
      variant: state.scan.kind === "offline" ? "provisional" : "success",
    });
    if (state.scan.repeated) {
      rows.unshift({
        id: "guest-repeat",
        name: state.guestName,
        code: "7QM4X–K3B9T",
        time: "19:43:05",
        label: "Repeat scan",
        variant: "warning",
      });
    }
  }
  return rows.slice(0, 5);
}

export function getAuditEntries(state: {
  guestName: string;
  registered: boolean;
  scan: DemoScanState;
}): DemoAuditEntry[] {
  const rows = [...BASE_AUDIT];
  if (state.registered) {
    rows.unshift({
      id: "registration",
      time: "19:38:44",
      text: `${state.guestName} registered. Email verification is skipped in this demo.`,
    });
  }
  if (state.scan.kind !== "ready") {
    rows.unshift({
      id: "check-in",
      time: "19:42:18",
      text:
        state.scan.kind === "offline" || state.scan.kind === "synced"
          ? `${state.guestName}'s check-in saved on this phone while offline.`
          : `${state.guestName} checked in at the north entrance.`,
    });
  }
  if (state.scan.kind === "synced") {
    rows.unshift({
      id: "provisional",
      time: "19:43:02",
      text: `${state.guestName}'s offline check-in synced. No conflict found; arrival confirmed.`,
    });
  }
  if (state.scan.kind !== "ready" && state.scan.repeated) {
    rows.unshift({
      id: "repeat",
      time: "19:43:05",
      text: "Repeat scan blocked. No additional arrival counted.",
    });
  }
  return rows.slice(0, 5);
}
