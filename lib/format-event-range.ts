/**
 * Every instant shown to a person is formatted in the Event Time Zone, never
 * the server's or UTC. The Intl construction lives here alone: components
 * are spelled out because `dateStyle`/`timeStyle` cannot be combined with
 * `timeZoneName` — the mix throws "Invalid option : option" before the
 * email is even sent.
 */
export function formatEventInstant(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(instant);
}

export function formatEventRange(startsAt: Date, endsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).formatRange(startsAt, endsAt);
}
