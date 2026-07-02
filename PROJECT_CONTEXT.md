# Kloud Notes Project Context

This is the single source of truth for project context and implementation understanding.

Use this file before making changes. Keep `README.md` for setup and usage, `INITITAL_PLAN.md` as the archived initial plan, and `FINDINGS.md` for review notes.

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
- `created_at`
- `updated_at`

The Firebase Security Rules enforce strict access, but all API routes bypass it using the Firebase Admin SDK to securely mediate access.

## Main Flow

1. User opens `/`.
2. The user enters note content, optionally a password, and optionally a custom short code.
3. The note is saved to Firestore via API route using a server-generated code or the custom code.
4. The URL updates to `/<code>`.
5. Visiting `/<code>` loads the note server-side or client-side.
6. If password protected, the user must unlock it before reading. Anyone with the link (and the password, if set) can edit or change the password.
7. Active viewers subscribe to a Firestore snapshot listener (`kloudNoteSignals/{code}`). When edits are made, clients receive instant alerts to reload for changes.

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
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Notes For Contributors

- `PROJECT_CONTEXT.md` is the working reference and source of truth for project context and understanding.
- `AGENTS.md` points to this file for agent behavior.
- `INITITAL_PLAN.md` is the archived initial plan and should not be treated as the source of truth.
