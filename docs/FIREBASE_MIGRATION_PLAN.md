# Firebase Migration Plan

Goal: migrate Kloud Notes from Supabase to Firebase while preserving the current app behavior:

- users create notes without login
- anyone with the link can view/edit
- password-protected notes require the password before content is shown or edited
- create mode lives at `/`
- edit/view mode lives at `/[code]`
- `NoteEditorClient` remains the shared client component for both routes

This plan is based on the current codebase shape:

- `src/components/NoteEditorClient.tsx`
- `src/app/page.tsx`
- `src/app/[code]/page.tsx`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[code]/route.ts`
- `src/app/api/verify/route.ts`
- `src/app/api/check/[code]/route.ts`
- `src/lib/supabase.ts`
- `src/lib/ratelimit.ts`
- `src/lib/validation.ts`
- `src/lib/utils.ts`
- `src/types/note.ts`

## Target Firebase Services

- Firestore for note storage.
- Firebase Admin SDK in Next.js API routes and server components.
- Firebase Web SDK in `NoteEditorClient` only for realtime metadata/listener behavior.
- Keep Vercel deployment unless there is a separate decision to move hosting to Firebase Hosting.
- Keep Upstash rate limiting as-is unless separately migrated.

## Firestore Data Model

Use the short code as the document id:

```text
notes/{shortCode}
```

Document fields:

```ts
{
  short_code: string,
  content: string,
  password_hash: string | null,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

Optional metadata-only realtime document:

```text
noteSignals/{shortCode}
```

Fields:

```ts
{
  updated_at: Timestamp
}
```

Use `noteSignals` if direct client listeners on `notes` would expose protected note content. Do not let browser clients read full note documents directly.

## Security Rules

Preferred rule posture:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /notes/{code} {
      allow read, write: if false;
    }

    match /noteSignals/{code} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

All note content access should remain mediated by Next.js API routes using Firebase Admin SDK.

## Dependency Changes

Add:

```bash
pnpm add firebase firebase-admin
```

Remove after migration is complete:

```bash
pnpm remove @supabase/supabase-js
```

Keep:

- `bcryptjs`
- `nanoid`
- `zod`
- `@upstash/ratelimit`
- `@upstash/redis`

## Environment Variables

Replace Supabase env vars with Firebase env vars.

`.env.example` should become:

```env
# Firebase client configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Upstash Redis for production rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

For Vercel, normalize `FIREBASE_PRIVATE_KEY` in code because it is usually stored with escaped newlines.

## New Firebase Libraries

Create:

- `src/lib/firebase-admin.ts`
- `src/lib/firebase-client.ts`

### `firebase-admin.ts`

Responsibilities:

- initialize Firebase Admin once
- export Firestore Admin DB
- normalize private key
- provide server-only helpers

Expected API:

```ts
export function getAdminDb() { ... }
```

### `firebase-client.ts`

Responsibilities:

- initialize Firebase Web SDK once
- export Firestore client for metadata/realtime only

Expected API:

```ts
export const firestore = getFirestore(app);
```

Do not use client Firestore to read or write note content.

## File-by-File Migration

### `src/lib/supabase.ts`

Replace with Firebase equivalents, then delete this file after all imports are gone.

Current responsibilities:

- public Supabase client for realtime
- service-role Supabase client for API/server database access

Firebase replacements:

- `src/lib/firebase-client.ts` for realtime metadata listener
- `src/lib/firebase-admin.ts` for server/database access

### `src/app/api/notes/route.ts`

Current behavior:

- validates create request
- rate limits
- generates short code if no custom code
- checks uniqueness
- hashes password
- inserts note
- returns `{ shortCode, url }`

Firebase implementation:

- use `getAdminDb()`
- document id is `shortCode`
- use a transaction for custom code creation and generated-code creation
- reject duplicate custom code with `409`
- set `created_at` and `updated_at` using server timestamp
- return ISO date-compatible response only if needed by client

Important: do not use a separate pre-check and insert without a transaction for custom code, or duplicate races can still happen.

### `src/app/api/check/[code]/route.ts`

Current behavior:

- validates code length/format
- rate limits
- checks if note exists
- returns `{ available: boolean }`

Firebase implementation:

- use `getAdminDb()`
- read `notes/{code}`
- return available based on document existence

### `src/app/api/notes/[code]/route.ts`

Current GET behavior:

- rate limits
- loads note
- if password protected, returns empty content
- otherwise returns public note

Firebase GET implementation:

- read `notes/{code}` with Admin SDK
- convert Firestore timestamps to ISO strings
- preserve hidden content behavior for protected notes

Current PATCH behavior:

- rate limits
- validates `content`, `password`, `newPassword`, `removePassword`
- loads existing note
- verifies password if protected
- updates content and password hash
- returns public note

Firebase PATCH implementation:

- use a transaction
- verify current password when `password_hash` exists
- support:
  - setting first password through `password`
  - changing existing password through `password` + `newPassword`
  - removing password through `password` + `removePassword`
- set `updated_at` with server timestamp
- update `noteSignals/{code}.updated_at` in the same API request after successful update
- return public note with ISO timestamps

### `src/app/api/verify/route.ts`

Current behavior:

- rate limits
- validates `shortCode` and `password`
- loads note
- verifies bcrypt hash
- returns full content on success

Firebase implementation:

- read `notes/{shortCode}` with Admin SDK
- preserve exact response contract:

```ts
{
  valid: true,
  note: PublicNote
}
```

### `src/app/[code]/page.tsx`

Current behavior:

- server-loads note by code using service client
- hides protected content
- renders `NoteEditorClient mode="edit"`

Firebase implementation:

- use Admin SDK to read `notes/{code}`
- convert timestamps to ISO strings
- preserve protected content hiding
- keep:

```tsx
<NoteEditorClient mode="edit" code={code} initialNote={publicNote} />
```

### `src/components/NoteEditorClient.tsx`

Current Supabase dependency:

- imports `supabase`
- uses `supabase.channel("note_<code>")`
- sends `broadcast` event after successful update

Firebase implementation:

- remove Supabase import
- import Firestore client helpers
- in edit mode, listen to metadata-only document:

```text
noteSignals/{code}
```

- when `updated_at` is newer than local `note.updated_at`, show the existing reload banner
- after update, the API should update `noteSignals`; the client does not need to broadcast manually

This keeps protected content out of client-side realtime payloads.

### `src/types/note.ts`

Keep the public interfaces stable if possible.

Firestore internal timestamps should not leak into these types. Convert them at API/server boundaries so `created_at` and `updated_at` remain strings.

### `src/lib/utils.ts`

Keep:

- `generateShortCode`
- `generateNoteUrl`
- `formatDate`

Update `toPublicNote` or create a Firebase-specific mapper:

```ts
toPublicNoteFromFirestore(...)
```

It must convert Firestore timestamps to strings.

### `src/lib/validation.ts`

No Firebase-specific change required unless the API payloads change.

Keep schemas for:

- create note
- update note
- verify password
- fetch/check code validation

### `src/lib/ratelimit.ts`

No migration required. This is Upstash-based and independent from Supabase/Firebase.

Consider later whether the in-memory fallback is acceptable for production.

## Files To Remove After Migration

Remove:

- `src/lib/supabase.ts`
- `supabase/migrations/00001_create_notes_table.sql`
- `supabase/` directory if empty
- `@supabase/supabase-js` from `package.json`
- Supabase env vars from `.env.example`, README, Vercel config/docs
- old unused `src/app/[code]/NotePageClient.tsx` if it remains unreferenced

## Documentation Updates

Update:

- `PROJECT_CONTEXT.md`
- `README.md`
- `.env.example`
- `EXPLANATION.md`
- `FINDINGS.md`

Key doc changes:

- replace Supabase setup with Firebase project setup
- replace SQL migration instructions with Firestore rules instructions
- document Firestore collections
- document Firebase Admin env vars
- document realtime metadata listener
- remove references to Supabase RLS and service-role key

## Migration Order

1. Add Firebase dependencies.
2. Add `firebase-admin.ts` and `firebase-client.ts`.
3. Implement Firestore note mappers and timestamp conversion helpers.
4. Migrate `POST /api/notes`.
5. Migrate `GET /api/check/[code]`.
6. Migrate `GET/PATCH /api/notes/[code]`.
7. Migrate `POST /api/verify`.
8. Migrate `src/app/[code]/page.tsx`.
9. Replace Supabase Broadcast in `NoteEditorClient` with Firestore metadata listener.
10. Remove Supabase imports.
11. Remove Supabase dependency and migration folder.
12. Update docs and env template.
13. Run verification.

## Verification Checklist

Run these against a real Firebase project:

- `pnpm install`
- `pnpm lint`
- `pnpm build`
- create note without password
- create note with custom code
- reject duplicate custom code
- open note by link
- edit unprotected note
- open same note in another browser and verify reload banner
- create protected note
- unlock protected note
- edit protected note after unlock
- reject protected note edit without password
- change protected note password
- remove protected note password
- confirm protected content is not readable from client Firestore rules
- deploy to Vercel with Firebase env vars
- repeat create/open/edit/protected-note flows on production

## Main Risks

- Firestore timestamp conversion can break `formatDate` if API responses stop returning strings.
- Direct client listeners on `notes/{code}` would leak protected content; use metadata-only `noteSignals`.
- Firestore rules must deny direct note reads/writes, otherwise password protection becomes cosmetic.
- Firebase private key formatting in Vercel is easy to misconfigure.
- Transactions are required for reliable custom-code uniqueness.
