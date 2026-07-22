# Sign Ticket payloads with ECDSA P-256

EventPass signs versioned Ticket payloads with asymmetric ECDSA P-256 and SHA-256 using a platform-wide, versioned signing-key ring. The active private key remains in deployment secrets while scanners receive only public verification keys, preventing a compromised scanner from minting Tickets; P-256 was chosen over HMAC, which would expose a forgery-capable secret to every device, and over Ed25519 for broader Web Crypto interoperability at v1 launch. A platform key ring was chosen over per-Event private keys because the simple deployment has no dedicated key-management service, and storing many decryptable private keys in PostgreSQL would add complexity without isolating them from the application server.

## Consequences

Tickets use JWS Compact Serialization with `ES256`. The protected header identifies the algorithm, signing key, and protocol type; the payload contains only its schema version, opaque Event ID, and opaque Ticket ID. It contains no attendee name, email address, or registration answers; scanners resolve the display name from the authorized Offline Event Snapshot. Version identifiers allow EventPass to verify previously issued Tickets during migrations and key rotation.

A valid JWS signature is necessary but never sufficient for admission. Offline scanners require a fresh Offline Event Snapshot to establish Event membership, revocation or replacement state, the Check-in Window, and prior Check-in state.
