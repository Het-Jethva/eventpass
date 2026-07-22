import { NextResponse } from "next/server";

import { verifyRegistration } from "@/features/tickets/server/tickets";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await verifyRegistration(slug, token);

  if (result.outcome === "confirmed") {
    const ticketUrl = new URL(
      `/tickets/${encodeURIComponent(result.managementToken)}`,
      request.url,
    );
    if (result.deliveryStatus === "failed") ticketUrl.searchParams.set("delivery", "failed");
    return NextResponse.redirect(ticketUrl, 303);
  }

  const resultUrl = new URL(`/e/${encodeURIComponent(slug)}/verification-result`, request.url);
  resultUrl.searchParams.set("outcome", result.outcome);
  return NextResponse.redirect(resultUrl, 303);
}
