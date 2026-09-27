import "server-only";

import { db } from "@/lib/db";

import { getEventRoster } from "./get-event-roster";

export const queryEventRoster = (
  options: Omit<Parameters<typeof getEventRoster>[0], "db">,
) => getEventRoster({ db, ...options });
