# EventPass

EventPass manages registration, ticket admission, and attendance for in-person events.

## Language

**Event**:
A single in-person occurrence with one venue, start/end interval, capacity, and check-in window. Separately ticketed dates or sessions are separate Events.
_Avoid_: Session, conference series

**Event Time Zone**:
The IANA time zone in which an Event's schedule and deadlines are communicated, regardless of the viewer's device time zone.
_Avoid_: Organizer time zone, browser time zone

**Venue**:
An Event's Organizer-supplied place name, formatted address, and optional map link.
_Avoid_: Location resource, room

**Event Slug**:
A platform-unique readable identifier used in an Event's public URL. It may change in Draft and becomes immutable when published.
_Avoid_: Event ID, title

**Draft Event**:
An Event still editable by its Organizers and invisible to Attendees.
_Avoid_: Unpublished Event

**Published Event**:
A link-accessible but unlisted Event made visible to Attendees. Once it has a Registration, it cannot return to Draft.
_Avoid_: Live Event, active Event

**Canceled Event**:
A reasoned, irreversibly withdrawn Published Event whose Tickets are invalid and whose Registration and audit history remain preserved.
_Avoid_: Deleted Event, closed Event

**Material Event Change**:
A post-publication change to an Event's venue, schedule, time zone, capacity, or registration/check-in windows that is audited and communicated to affected attendees. After check-in opens, only the Event Owner may extend the Event end or Check-in Window.
_Avoid_: Event edit, update

**Attendee**:
A person registered for an event. An Attendee does not need a user account.
_Avoid_: Guest, customer, attendee account

**Registration**:
An Attendee's request to participate in an Event. A Registration remains unconfirmed until the Attendee verifies their email address, and each normalized email address may have at most one active Registration per Event.
_Avoid_: Signup, account

**Expired Registration**:
A terminal Registration whose Capacity Hold or Admission Offer was not claimed before its deadline. Its Attendee may register again and receives no retained waitlist priority.
_Avoid_: Canceled Registration, missed offer

**Capacity Hold**:
A place temporarily reserved for an unverified Registration for 15 minutes after submission. Active Capacity Holds and confirmed Registrations both consume Event capacity.
_Avoid_: Reservation, pending ticket

**Event Capacity**:
The maximum combined count of confirmed Registrations, active Capacity Holds, and active Admission Offers. Increases promote the waitlist FIFO; decreases cannot displace an existing claim.
_Avoid_: Ticket limit, seat count

**Registration Window**:
The scheduled interval in which a Published Event accepts Registrations, defaulting from publication through Event start. Organizers may pause and resume it without unpublishing the Event.
_Avoid_: Signup period, Event availability

**Waitlist Entry**:
A verified request queued for admission after an Event reaches capacity. Waitlist Entries are ordered first-in-first-out by successful email verification time.
_Avoid_: Pending Registration, standby ticket

**Admission Offer**:
A place reserved for the earliest Waitlist Entry while its Attendee decides whether to claim it. It expires at the earlier of 12 hours after issuance or Registration Window closure, consumes Event capacity while active, and is not a Ticket.
_Avoid_: Ticket, promotion

**Registration Management Link**:
A bearer capability that lets an Attendee view one Registration, edit its name and answers until registration closes, resend or replace its Ticket, or cancel before check-in opens. Resending rotates the link and invalidates the previous one, so an exposed link can be superseded; the verified email address cannot be changed.
_Avoid_: Login link, attendee session

**Registration Field**:
A stable Event-specific question that collects a short-text, long-text, single-choice, multiple-choice, or acknowledgment answer as part of Registration. After responses exist, its identity and answer type remain fixed; it may be relabeled, archived, or joined by new optional fields.
_Avoid_: Form input, custom column

**Imported Registration**:
An Organizer-attested Registration created from a CSV import and confirmed without attendee email verification.
_Avoid_: Manual attendee, uploaded ticket

**Registration Import**:
An Organizer's previewed, audited, all-or-nothing creation of Imported Registrations from a CSV file within the Event's remaining capacity.
_Avoid_: Upload, bulk signup

**Email Delivery**:
A tracked record of sending a login link, invitation, verification link, Admission Offer, or Ticket. Transient failure is retryable, permanent failure suppresses automatic retries, and neither reverses an already committed Registration or Ticket.
_Avoid_: Email job, notification

## Admission

**Check-in Window**:
The interval in which an Event accepts Tickets, defaulting to 60 minutes before its start through its end. Only an Organizer may admit outside this interval, and the override requires an audit reason.
_Avoid_: Event hours, scanning time

**Scan Attempt**:
An auditable attempt by a Check-in Volunteer to validate presented QR or Ticket Code input, whether accepted or rejected. Known Tickets retain their identifier; unknown input retains only a digest and rejection reason, never its raw contents.
_Avoid_: Scan, check-in

**Timestamp Confidence**:
An assessment of whether a Scan Attempt's device time remains consistent with the server-time anchor captured during snapshot refresh. Low-confidence time requires Organizer review for conflicts or Check-in Window boundaries.
_Avoid_: Trusted clock, server time

**Check-in**:
The authoritative record that a Ticket was accepted for admission to its Event. A Ticket may have at most one active Check-in.
_Avoid_: Scan, attendance

**Check-in Reversal**:
A reasoned invalidation of an active Check-in, making its Ticket admissible again without deleting admission history. Organizers may reverse any Check-in; volunteers are limited to a Quick Reversal.
_Avoid_: Delete Check-in, undo scan

**Quick Reversal**:
A Check-in Volunteer's reasoned reversal of only their own most recent Check-in within 30 seconds.
_Avoid_: Delete scan, volunteer override

**Provisional Check-in**:
An offline device's local acceptance of a Ticket before synchronization establishes whether it conflicts with another device.
_Avoid_: Check-in, offline scan

**Check-in Conflict**:
Two or more Provisional Check-ins for the same Ticket from different offline devices. The earliest high-confidence attempt becomes the Check-in automatically; low-confidence conflicts require a reasoned Organizer selection, and every attempt remains in the audit history.
_Avoid_: Duplicate Check-in, sync error

**Attendance Rate**:
The number of active Check-ins divided by confirmed, non-canceled Registrations for an Event. Waitlist Entries and unclaimed Admission Offers are excluded.
_Avoid_: Check-in rate, turnout

**Offline Event Snapshot**:
An identified, timestamped download of the minimum Event data needed for offline admission: opaque Ticket identifiers, attendee display names, validity state, and existing Check-in state. It excludes email addresses and registration-form responses, must be refreshed within two hours before check-in opens, and only one Event may be cached per browser profile; after check-in closes, it is purged only after all pending Scan Attempts synchronize.
_Avoid_: Attendee export, ticket database

**Scanner Authorization**:
A signed, Event-scoped capability allowing one authenticated volunteer's device to validate Tickets and later synchronize Scan Attempts through that Event's check-in window. It grants no Event-management access.
_Avoid_: Staff session, offline login

**Scanner Device**:
A browser profile identified by a random UUID and volunteer-supplied label for binding Scanner Authorization and Scan Attempts without browser fingerprinting.
_Avoid_: Fingerprint, phone

**Audit Entry**:
An immutable record of a Scan Attempt or security-relevant change, identifying its actor, time, device, target, and reason when applicable. Audit Entries never contain registration-form answers.
_Avoid_: Activity log, editable history

**Ticket**:
A single-entry bearer admission credential issued for a confirmed Registration and valid only for its Event. A QR code represents the Ticket but is not itself the Ticket; possession of a valid, unused Ticket is sufficient for admission, and later scans are duplicates.
_Avoid_: QR code, pass

**Ticket Replacement**:
The permanent invalidation of an unused Ticket followed by issuance of a newly signed Ticket for the same Registration. Attendees may replace their Ticket through the Registration Management Link before check-in opens.
_Avoid_: Resend, edit Ticket

**Ticket Code**:
A random, Event-scoped 10-character fallback representation of a Ticket for manual entry when QR scanning is unavailable. It follows the same validity and duplicate rules as the QR representation.
_Avoid_: PIN, confirmation number

## Access

**Event Staff**:
An authenticated person assigned permissions for one specific Event. Access to one Event grants no access to any other Event.
_Avoid_: Staff account, global role

**Organizer**:
Event Staff permitted to configure an Event, manage its Registrations and Tickets, and add or remove Check-in Volunteers.
_Avoid_: Event admin, host

**Event Owner**:
The single Organizer ultimately accountable for an Event. A verified staff user becomes Event Owner when creating an Event; only the current Event Owner may add or remove Organizers, transfer ownership, delete an empty Draft Event, or cancel the Event.
_Avoid_: Primary admin, creator

**Ownership Transfer**:
A 24-hour proposal from the current Event Owner to an existing Organizer. Ownership changes atomically only when the proposed Owner accepts.
_Avoid_: Role change, owner assignment

**Staff Invitation**:
A single-use, revocable, Event-scoped invitation bound for 24 hours to one normalized email address and intended role. Staff access cannot be self-assigned.
_Avoid_: Team invite, role grant

**Check-in Volunteer**:
Event Staff permitted to validate Tickets and record admission for one Event, without access to Event configuration or the full attendee export.
_Avoid_: Scanner, volunteer account

**Platform Administrator**:
A trusted operator permitted to manage platform metadata, accounts, Event status, and audit records for support and abuse handling. Attendee data requires explicit Support Access.
_Avoid_: Admin, super organizer

**Support Access**:
A reasoned, time-limited, audited elevation allowing a Platform Administrator to inspect one Event's attendee data.
_Avoid_: Impersonation, admin override

**Suspension**:
A reversible Platform Administrator action that blocks a staff account or Event from further online activity without editing or deleting its domain data.
_Avoid_: Cancellation, ban, deletion
