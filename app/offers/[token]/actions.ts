"use server";

import { redirect } from "next/navigation";

import { claimAdmissionOffer } from "@/features/tickets/server/tickets";

export async function claimAdmissionOfferAction(token: string) {
  const result = await claimAdmissionOffer(token);
  if (result.outcome === "confirmed") {
    const suffix = result.deliveryStatus === "failed" ? "?delivery=failed" : "";
    redirect(`/tickets/${encodeURIComponent(result.managementToken)}${suffix}`);
  }
  redirect(`/offers/${encodeURIComponent(token)}?outcome=${result.outcome}`);
}
