const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const VALUE_BY_CHAR = new Map<string, number>(
  [...ALPHABET].map((character, index) => [character, index]),
);

function byteAt(bytes: Uint8Array, index: number) {
  const byte = bytes[index];
  if (byte === undefined) throw new Error("Malformed base64url.");
  return byte;
}

function alphabetAt(index: number) {
  const character = ALPHABET[index];
  if (character === undefined) throw new Error("Malformed base64url.");
  return character;
}

/**
 * Unpadded base64url, matching Node's Buffer base64url encoding.
 * Ticket and scanner-authorization signing share it with both verifiers,
 * so a segment cannot be canonical in Node and lenient in the browser.
 */
export function encodeBase64Url(bytes: Uint8Array) {
  let output = "";
  let index = 0;
  while (index + 3 <= bytes.length) {
    const chunk =
      (byteAt(bytes, index) << 16) |
      (byteAt(bytes, index + 1) << 8) |
      byteAt(bytes, index + 2);
    output +=
      alphabetAt((chunk >>> 18) & 63) +
      alphabetAt((chunk >>> 12) & 63) +
      alphabetAt((chunk >>> 6) & 63) +
      alphabetAt(chunk & 63);
    index += 3;
  }
  const remaining = bytes.length - index;
  if (remaining === 1) {
    const first = byteAt(bytes, index);
    output += alphabetAt(first >>> 2) + alphabetAt((first & 3) << 4);
  } else if (remaining === 2) {
    const first = byteAt(bytes, index);
    const second = byteAt(bytes, index + 1);
    output +=
      alphabetAt(first >>> 2) +
      alphabetAt(((first & 3) << 4) | (second >>> 4)) +
      alphabetAt((second & 15) << 2);
  }
  return output;
}

function decodeBase64Url(segment: string) {
  const storage = new ArrayBuffer(Math.floor((segment.length * 3) / 4));
  const output = new Uint8Array(storage);
  let outputIndex = 0;
  let accumulator = 0;
  let bits = 0;
  for (const character of segment) {
    const value = VALUE_BY_CHAR.get(character);
    if (value === undefined) throw new Error("Malformed base64url.");
    accumulator = (accumulator << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[outputIndex] = (accumulator >> bits) & 255;
      outputIndex += 1;
    }
  }
  return output;
}

export function decodeCanonicalBase64Url(segment: string) {
  if (segment.length === 0) return new Uint8Array();
  if (segment.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new Error("Malformed base64url.");
  }
  const decoded = decodeBase64Url(segment);
  if (encodeBase64Url(decoded) !== segment) {
    throw new Error("Non-canonical base64url.");
  }
  return decoded;
}
