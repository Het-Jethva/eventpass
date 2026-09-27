import { decodeTicketSignature, parseTicketJws } from "./parse-ticket-jws";

type DecodedTicket = {
  eventId: string;
  ticketId: string;
};

export async function verifyOfflineTicket(
  compactJws: string,
  keys: Record<string, JsonWebKey>,
): Promise<DecodedTicket | null> {
  try {
    const parsed = parseTicketJws(compactJws);
    const jwk = keys[parsed.header.kid];
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const signatureBytes = decodeTicketSignature(parsed.signatureSegment);
    // verify() accepts an ArrayBuffer. The decoded signature's buffer type is wider than that.
    const signature = new ArrayBuffer(signatureBytes.byteLength);
    new Uint8Array(signature).set(signatureBytes);
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signature,
      new TextEncoder().encode(parsed.signingInput),
    );
    return valid
      ? { eventId: parsed.payload.eventId, ticketId: parsed.payload.ticketId }
      : null;
  } catch {
    return null;
  }
}
