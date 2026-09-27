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

export type DemoScanVariant = "success" | "provisional" | "warning";

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
    text: "CSV import added 40 confirmed registrations in one atomic pass.",
  },
];

export function getDashboardStats(state: {
  registered: boolean;
  admitted: boolean;
}) {
  const registeredCount =
    SAMPLE_EVENT.baseRegistered + (state.registered ? 1 : 0);
  const checkedInCount =
    SAMPLE_EVENT.baseCheckedIn + (state.admitted ? 1 : 0);
  const remaining = SAMPLE_EVENT.capacity - registeredCount;
  const percent = Math.round(
    (checkedInCount / SAMPLE_EVENT.capacity) * 100,
  );
  return { registeredCount, checkedInCount, remaining, percent };
}

export function getRecentScans(state: {
  registered: boolean;
  admitted: boolean;
  offlineShown: boolean;
}): DemoScan[] {
  const rows = [...BASE_SCANS];
  if (state.admitted) {
    rows.unshift({
      id: "priya-accepted",
      name: SAMPLE_EVENT.attendeeName,
      code: "7QM4X–K3B9T",
      time: "19:42:18",
      label: "Checked in",
      variant: "success",
    });
  }
  if (state.offlineShown) {
    rows.unshift({
      id: "dev-offline",
      name: "Dev Patel",
      code: "2BN6D–T8W4R",
      time: "19:43:02",
      label: "Not confirmed",
      variant: "provisional",
    });
  }
  return rows.slice(0, 5);
}

export function getAuditEntries(state: {
  registered: boolean;
  admitted: boolean;
  offlineShown: boolean;
}): DemoAuditEntry[] {
  const rows = [...BASE_AUDIT];
  if (state.registered) {
    rows.unshift({
      id: "registration",
      time: "19:38:44",
      text: `${SAMPLE_EVENT.attendeeName} registered and verified by email (skipped in this demo).`,
    });
  }
  if (state.admitted) {
    rows.unshift({
      id: "check-in",
      time: "19:42:18",
      text: `${SAMPLE_EVENT.attendeeName} checked in at the north entrance.`,
    });
  }
  if (state.offlineShown) {
    rows.unshift({
      id: "provisional",
      time: "19:43:02",
      text: "Offline scan saved on one phone as provisional; reconciles on reconnect.",
    });
  }
  return rows.slice(0, 5);
}
