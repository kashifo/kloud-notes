# Findings & Code Review

All critical findings from previous code reviews have been resolved:

1. **Ownership Model Reverted**: The `owner_token` logic has been entirely removed, returning the app to its intended "anyone with a link can edit" design.
2. **Database Updates Fixed**: Updates via the `/api/notes/[code]` PATCH route now securely utilize the service-role client, bypassing restrictive RLS policies while properly validating note passwords.
3. **Cross-Device Sync (Realtime)**: Implemented Supabase Realtime Broadcasts to alert active viewers instantly when a note is updated, without leaking protected content over WebSockets.
4. **Password Changes on `/[code]`**: Properly implemented the UI logic to allow users to change or remove passwords from the live note viewer client (`NotePageClient.tsx`).
5. **Rate Limiting Fallback**: Production environments without Upstash Redis now safely fall back to in-memory rate limiting instead of hard-failing all API requests.
