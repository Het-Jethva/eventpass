import "server-only";

const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function parseLocalDateTime(value: string): LocalDateTimeParts | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const candidate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );

  if (
    candidate.getUTCFullYear() !== parts.year ||
    candidate.getUTCMonth() + 1 !== parts.month ||
    candidate.getUTCDate() !== parts.day ||
    candidate.getUTCHours() !== parts.hour ||
    candidate.getUTCMinutes() !== parts.minute
  ) {
    return null;
  }

  return parts;
}

function partsAtInstant(instant: Date, timeZone: string): LocalDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const formatted = formatter.formatToParts(instant);

  return {
    year: numericPart(formatted, "year"),
    month: numericPart(formatted, "month"),
    day: numericPart(formatted, "day"),
    hour: numericPart(formatted, "hour"),
    minute: numericPart(formatted, "minute"),
  };
}

function numericPart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  const part = parts.find((item) => item.type === type);
  if (!part) {
    throw new Error(`Formatted instant is missing ${type}.`);
  }
  return Number(part.value);
}

function partsAsUtcMilliseconds(parts: LocalDateTimeParts) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
}

export function isIanaTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function localDateTimeInTimeZoneToUtc(
  value: string,
  timeZone: string,
): Date | null {
  const targetParts = parseLocalDateTime(value);

  if (!targetParts || !isIanaTimeZone(timeZone)) {
    return null;
  }

  const targetWallTime = partsAsUtcMilliseconds(targetParts);
  let instant = new Date(targetWallTime);

  // Offsets can change near daylight-saving transitions, so converge twice.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const representedWallTime = partsAsUtcMilliseconds(
      partsAtInstant(instant, timeZone),
    );
    instant = new Date(instant.getTime() + targetWallTime - representedWallTime);
  }

  const roundTrip = partsAtInstant(instant, timeZone);

  return partsAsUtcMilliseconds(roundTrip) === targetWallTime ? instant : null;
}

export function eventScheduleInstants(input: {
  eventTimeZone: string;
  startsAtLocal: string;
  endsAtLocal: string;
  registrationOpensAtLocal: string;
  registrationClosesAtLocal: string;
  checkInOpensAtLocal: string;
  checkInClosesAtLocal: string;
}) {
  const startsAt = localDateTimeInTimeZoneToUtc(input.startsAtLocal, input.eventTimeZone);
  const endsAt = localDateTimeInTimeZoneToUtc(input.endsAtLocal, input.eventTimeZone);
  const registrationOpensAt = localDateTimeInTimeZoneToUtc(
    input.registrationOpensAtLocal,
    input.eventTimeZone,
  );
  const registrationClosesAt = localDateTimeInTimeZoneToUtc(
    input.registrationClosesAtLocal,
    input.eventTimeZone,
  );
  const checkInOpensAt = localDateTimeInTimeZoneToUtc(
    input.checkInOpensAtLocal,
    input.eventTimeZone,
  );
  const checkInClosesAt = localDateTimeInTimeZoneToUtc(
    input.checkInClosesAtLocal,
    input.eventTimeZone,
  );

  if (
    !startsAt ||
    !endsAt ||
    !registrationOpensAt ||
    !registrationClosesAt ||
    !checkInOpensAt ||
    !checkInClosesAt
  ) {
    throw new Error("A local time does not exist in the Event Time Zone.");
  }

  return {
    startsAt,
    endsAt,
    registrationOpensAt,
    registrationClosesAt,
    checkInOpensAt,
    checkInClosesAt,
  };
}

export function utcToLocalDateTimeInput(instant: Date, timeZone: string) {
  const validTimeZone = isIanaTimeZone(timeZone) ? timeZone : "UTC";
  const parts = partsAtInstant(instant, validTimeZone);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
