# Kloud Notes Project Context

This is the single source of truth for project context and implementation understanding.

Use this file before making changes. Keep `README.md` for setup and usage, `docs/INITITAL_PLAN.md` as the archived initial plan, and `docs/FINDINGS.md` for review notes.

## Product

Kloud Notes is a cloud notepad app built with Next.js, TypeScript, and Firebase. Users can create a note without login, share it by short code, and optionally protect it with a password.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Firebase Firestore
- Zod for validation
- bcryptjs for password hashing
- nanoid for code generation
- Upstash Redis for rate limiting when configured

## Repo Map

- `src/app/page.tsx` creates and edits notes from the home flow.
- `src/app/[code]/page.tsx` loads a note server-side and passes it to the client.
- `src/components/NoteEditorClient.tsx` handles viewing, creating, editing, password unlock, and copy actions for both routes in a unified manner.
- `src/app/api/notes/route.ts` creates notes.
- `src/app/api/notes/[code]/route.ts` fetches and updates notes.
- `src/app/api/verify/route.ts` verifies passwords.
- `src/app/api/check/[code]/route.ts` checks code availability.

## Core Libraries

- `src/lib/firebase-client.ts` wraps the public Firebase client for Realtime Document listeners.
- `src/lib/firebase-admin.ts` wraps the admin SDK for database access.
- `src/lib/validation.ts` owns request validation.
- `src/lib/security.ts` owns hashing, verification, sanitizing, and IP extraction.
- `src/lib/utils.ts` owns short-code generation, URLs, formatting, and public note shaping.
- `src/lib/constants.ts` stores limits, app URL, and table names.
- `src/lib/ratelimit.ts` uses Upstash when configured and falls back to an in-memory limiter.

## Data Model

`kloudNotes` contains:

- `id`
- `short_code`
- `content`
- `password_hash`
- `created_by_visitor_id`
- `created_by_tab_id`
- `created_at`
- `updated_at`

`kloudNoteSignals` contains:

- `updated_at`
- `updated_by`
- `updated_by_visitor_id`
- `updated_by_tab_id`

The Firebase Security Rules enforce strict access, but all API routes bypass it using the Firebase Admin SDK to securely mediate access.

## Main Flow

1. User opens `/`.
2. The server instantly generates a random short code and redirects the user to `/[code]`.
3. If the note doesn't exist in the database, `/[code]` renders a "Ghost Draft" editor in create mode.
4. If the user closes the tab without typing, the ghost draft is safely discarded.
5. If the user enters content, the 1.5-second auto-save fires a `POST` request to create the note at that URL. The client seamlessly upgrades to `edit` mode (attaching realtime listeners) without a page reload.
6. The user can optionally edit the URL via a dedicated UI or set a password.
7. If password protected, anyone visiting the link must unlock it before reading. Active viewers subscribe to a Firestore snapshot listener (`kloudNoteSignals/{code}`). Save requests include a browser-scoped `clientId`, persistent anonymous `visitorId`, and tab-scoped `tabId`; signal docs store these values so clients can classify saves as same tab, same browser in another tab, or another browser/device.

## Analytics

- Analytics is optional and enabled only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured.
- `src/lib/analytics.ts` owns Google Analytics loading constants, browser identity helpers, safe event names, and GA dispatch wrappers.
- `src/app/api/notes/[code]/relation/route.ts` classifies the current anonymous browser as creator, other browser/device, or unknown without exposing creator IDs to the client.
- Note creation stores anonymous creator browser metadata (`created_by_visitor_id`, `created_by_tab_id`) so analytics can classify future views as creator browser, other browser/device, or unknown for legacy notes through the relation API. Raw creator IDs are not included in public note payloads.
- Google Analytics tracks readable product events such as note views, creator/other-device view classifications, creates, edits, copy-link shares, password outcomes, custom-link checks, remote-update classifications, theme changes, and rate-limit failures.
- Analytics includes short codes for per-note reporting but must never include note content, passwords, password hashes, raw creator IDs, or raw request/response bodies.

## Working Conventions

- Keep the server/client split intact.
- Never expose the Firebase private key or Admin SDK to the browser.
- Store password hashes, not plaintext passwords.
- Validate all request bodies with Zod.
- Keep the UI responsive and mobile-first.
- Keep this file current when behavior or file ownership changes.

## Environment Variables

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Notes For Contributors

- `PROJECT_CONTEXT.md` is the working reference and source of truth for project context and understanding.
- `AGENTS.md` points to this file for agent behavior.
- `docs/INITITAL_PLAN.md` is the archived initial plan and should not be treated as the source of truth.
