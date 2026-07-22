# Offline cross-device duplicate detection is best-effort

EventPass guarantees global duplicate prevention when scanners can reach the server and device-local duplicate prevention while offline. Because isolated scanners cannot exchange state, an offline acceptance is provisional until synchronization; the server retains every Scan Attempt and flags cross-device conflicts instead of claiming that cryptographic verification can prevent them.

## Consequences

Volunteers may unknowingly admit the same bearer Ticket at different offline entrances. When conflicting attempts synchronize, the earliest high-confidence device-recorded attempt becomes the authoritative Check-in regardless of synchronization order; all raw device timestamps, server-time anchors, confidence states, and server receipt times remain available for review. Low-confidence collisions require Organizer review. Event operations must accept this residual risk, and product and resume claims must distinguish prevention from later conflict detection.

Offline validity is snapshot-relative: a device cannot observe a Ticket cancellation or replacement, Material Event Change, staff revocation, or Check-in recorded after its last refresh. Every Scan Attempt identifies the snapshot and generation time used for its decision. A scanner must refresh within two hours before check-in opens, displays snapshot age, refreshes whenever connectivity returns, and flags reconciled outcomes changed by newer server state.
