# Use Better Auth for staff identity

EventPass uses Better Auth with its Drizzle adapter, database sessions, and hashed magic-link tokens. Better Auth was chosen over the originally proposed Auth.js because this is a new Next.js 16 application and Better Auth provides current framework integration plus actively developed passwordless and session features; EventPass still owns Event staffing, invitations, suspensions, ownership, and authorization rather than adopting generic organization-role plugins.
