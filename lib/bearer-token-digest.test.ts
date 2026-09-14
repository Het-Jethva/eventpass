import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  digestBearerToken,
  digestTokenBase64Url,
} from "./bearer-token-digest";

describe("bearer token digests", () => {
  it("hashes hex capabilities as SHA-256 hex and base64url tokens as SHA-256 base64url", () => {
    const token = "ticket-management-token";

    expect(digestBearerToken(token)).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(digestTokenBase64Url(token)).toBe(
      createHash("sha256").update(token).digest("base64url"),
    );
    expect(digestBearerToken(token)).not.toBe(digestTokenBase64Url(token));
  });
});
