export function refuseOfflineCredential(values: {
  eventId: string;
  ticketCode: string | null;
  payloadEventId: string | null;
  ticketFound: boolean;
}): "unknown" | "invalid" | null {
  if (values.ticketCode && !values.ticketFound) return "unknown";
  if (!values.ticketCode && values.payloadEventId === null) return "invalid";
  if (values.payloadEventId !== null && values.payloadEventId !== values.eventId) {
    return "invalid";
  }
  if (!values.ticketFound) return "unknown";
  return null;
}
