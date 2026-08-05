# Serialize capacity decisions on a per-Event row lock

EventPass counts an Event's capacity as confirmed Registrations plus unexpired Capacity Holds plus active Admission Offers, and serializes every operation that can change that count on a `select ... for update` against the Event row. A place reserved for an Attendee who is still verifying their email address, and a place held open for a Waitlist Entry deciding whether to claim an Admission Offer, both consume capacity while they are live. Optimistic checks were rejected because the oversell window they leave is exactly the window a registration link shared to a group chat exercises: many attendees submitting within the same second, each reading a count that no longer holds by the time it is written.

A single lock per Event was chosen over finer-grained locking because every capacity decision already needs the same Event row for its windows and status, because an Event is the natural contention boundary — two Events never compete — and because the alternative, reconstructing the count from a unique constraint, cannot express a limit across three tables.

## Consequences

Registration, email verification, waitlist reconciliation, Admission Offer claims, Registration Import, and capacity edits all queue behind one row per Event. That is deliberate: correctness at the capacity boundary is worth more than concurrency within one Event, and the ceiling is a few hundred attendees rather than a few hundred thousand.

Capacity increases promote the waitlist FIFO by email-verification time within the same transaction that raises the limit. Decreases are rejected outright when they would displace a confirmed Registration, an unexpired Capacity Hold, or an active Admission Offer, rather than revoking a place an Attendee already holds — a place, once claimed, is not taken back by an Organizer editing a number.

Expiry is evaluated during reads and mutations rather than by a scheduler, so a lapsed Capacity Hold or Admission Offer stops consuming capacity the next time the Event is touched. Nothing reclaims it in the background, which is acceptable only because the same traffic that would exhaust capacity is the traffic that reconciles it.

One active Registration per normalized email address per Event is enforced by a partial unique constraint, not by an application check, so it holds even against a request that never passes through the lock.
