# Changelog

## Routing & Architecture Updates
- **Ghost Drafts Flow:** Re-architected note creation flow. Visiting `/` instantly generates a random code and redirects to `/[code]` without throwing a 404 for empty notes.
- **Seamless State Transition:** Fixed critical race conditions in `NoteEditorClient` by removing client-side URL generation. Completely upgraded a draft seamlessly from `create` to `edit` mode via auto-save without reloading the page.

## Backend & Validation
- **TypeScript Fixes:** Fixed critical TypeScript typecheck failures (TS18047, TS2352) across API routes and ensured robust document validations.
- **Custom URL & Client Identification:** Upgraded Zod schemas and the `PATCH` route (`src/app/api/notes/[code]/route.ts`) to securely handle custom URL renaming (`newCode`) and track `clientId` signals to prevent clients from endlessly reloading from their own updates.
- **Granular Rate Limiting:** Split the generic rate limiter into dedicated buckets in `src/lib/constants.ts` and `src/lib/ratelimit.ts`. Added a 60 req/min `UPDATE_NOTE` bucket (essential to prevent auto-save from hitting a 429 wall) and a 60 req/min `CHECK_CODE` bucket for custom URL availability checkers.

## UI / UX Enhancements
- **Tailwind CSS v4 Dark Mode:** Overrode Tailwind CSS v4's default `prefers-color-scheme` logic by implementing a manual `@custom-variant dark` in `globals.css`, restoring full functionality to manual theme toggling.
- **Editor Polish:** 
  - Hid the manual Save button during note drafting since auto-save natively handles it.
  - Reorganized header buttons so "Recents" is structurally placed to the right of "New Note".
  - Implemented click-outside-to-close behavior on the Recents popup.
  - Added a clean vertical divider to the URL actions box for a more polished look.
- **Assets:** Updated site `favicon.ico` and `kloudnotes-logo-trans.png` to reflect recent branding improvements.

## Code Refactoring & Security
- **Data Hardening:** Hardened local storage parsing to gracefully prevent corrupt JSON arrays from crashing the application render loop.
- **Documentation Restructuring:** Moved planning and review files into a dedicated `docs/` directory (`EXPLANATION.md`, `FIREBASE_MIGRATION_PLAN.md`, `INITITAL_PLAN.md`, `MERGE_PLAN.md`, `FINDINGS.md`). Updated internal references inside `PROJECT_CONTEXT.md` and `AGENTS.md` to reflect the new ghost drafts flow.
