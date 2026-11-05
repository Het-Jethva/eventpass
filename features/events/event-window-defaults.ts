function subtractLocalMinutes(value: string, minutes: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]) - minutes,
    ),
  );
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

export function getDefaultEventWindows(values: {
  startsAtLocal: string;
  endsAtLocal: string;
  registrationClosesAtLocal: string;
  checkInOpensAtLocal: string;
  checkInClosesAtLocal: string;
}) {
  return {
    registrationClosesAtLocal:
      values.registrationClosesAtLocal || values.startsAtLocal,
    checkInOpensAtLocal:
      values.checkInOpensAtLocal ||
      subtractLocalMinutes(values.startsAtLocal, 60),
    checkInClosesAtLocal: values.checkInClosesAtLocal || values.endsAtLocal,
  };
}
