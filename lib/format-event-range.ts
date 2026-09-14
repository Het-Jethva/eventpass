/**
 * Every instant shown to a person is formatted in the Event Time Zone, never
 * the server's or UTC. The Intl construction lives here alone: components
 * are spelled out because `dateStyle`/`timeStyle` cannot be combined with
 * `timeZoneName` — the mix throws "Invalid option : option" before the
 * email is even sent.
 */
const EVENT_FORMAT_OPTIONS = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
} as const;

export function formatEventInstant(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", { ...EVENT_FORMAT_OPTIONS, timeZone }).format(instant);
}

export function formatEventRange(startsAt: Date, endsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", { ...EVENT_FORMAT_OPTIONS, timeZone }).formatRange(
    startsAt,
    endsAt,
  );
}
