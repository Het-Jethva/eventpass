export function formatEventRange(startsAt: Date, endsAt: Date, timeZone: string) {
  // Components spelled out because `dateStyle`/`timeStyle` cannot be combined
  // with `timeZoneName`; the mix throws "Invalid option : option".
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
