"use server";

import { redirect } from "next/navigation";

import { verifyRegistration } from "@/features/tickets/server/tickets";

export async function confirmRegistrationVerificationAction(
  slug: string,
  token: string,
) {
  const result = await verifyRegistration(slug, token);

  if (result.outcome === "confirmed") {
    const ticketPath = `/tickets/${encodeURIComponent(result.managementToken)}`;
    redirect(
      result.deliveryStatus === "failed"
        ? `${ticketPath}?delivery=failed`
        : ticketPath,
    );
  }

  if (result.outcome === "offered") {
    redirect(`/offers/${encodeURIComponent(result.offerToken)}`);
  }

  redirect(
    `/e/${encodeURIComponent(slug)}/verification-result?outcome=${result.outcome}`,
  );
}
