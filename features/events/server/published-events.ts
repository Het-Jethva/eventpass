import "server-only";

import { db } from "@/lib/db";
import { sendEventNotification } from "@/lib/email/send-event-notification";
import { sendAdmissionOffer } from "@/lib/email/send-admission-offer";

import { createPublishedEventApplicationService } from "./published-event-application";

const application = createPublishedEventApplicationService({
  database: db,
  deliverNotification: async (deliveryId) => {
    await sendEventNotification(deliveryId);
  },
  sendAdmissionOfferEmail: sendAdmissionOffer,
});

export const updatePublishedEvent = application.updatePublishedEvent;
export const cancelPublishedEvent = application.cancelPublishedEvent;
