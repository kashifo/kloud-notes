# Kloud Notes - Comprehensive Explanation Guide

This document is designed to give you a complete, top-to-bottom understanding of how Kloud Notes works. Whether you are adding a new feature or debugging an issue, this guide explains the "why" and "how" behind the application's architecture.

---

## 1. High-Level Concept
Kloud Notes is a secure, cloud-based notepad where **anyone with the link can view and collaborate** on a note. 
* It requires no login or user accounts. 
* URLs function as the access permission.
* Users can optionally lock a note behind a password.

## 2. Technology Stack & Architecture
The app is built using the **Next.js 15 App Router** paradigm, which enforces a strict separation between what runs on the server (backend) and what runs in the browser (frontend client).

* **Frontend:** React 19, Tailwind CSS 4 for styling.
* **Backend:** Next.js Route Handlers (`/api/*`).
* **Database:** Firebase Firestore.
* **Validation:** Zod (ensures data coming from the client is correctly formatted).
* **Security:** `bcryptjs` for password hashing, Firestore Security Rules.

---

## 3. Database & Security Model (The "Security Rule Bypass" Pattern)

### The Database Schema
We use Firebase Firestore with a `kloudNotes` collection. Each document uses the short code as its ID (`kloudNotes/{shortCode}`) and contains:
* `short_code` (String, Unique)
* `content` (String): The actual text of the note.
* `password_hash` (String, Nullable): The bcrypt hash of the password, if one is set.
* `created_at` (Timestamp)
* `updated_at` (Timestamp)

### How Security Works
The database has **Firestore Security Rules enabled to strictly deny all reads and writes** to the `kloudNotes` collection. This means if someone tries to query the database directly from their browser, the database will strictly deny the request. 

We do this because if we allowed public read access, hackers could steal the `content` of password-protected notes without ever guessing the password.

Instead, the frontend must always talk to our **Next.js API Routes**. Inside these API routes, we use the **Firebase Admin SDK** which bypasses all security rules. 
**Flow:** Client -> Next.js API (Validates logic & passwords) -> Admin Database Access.

---

## 4. How Core Features Work

### A. Creating a Note (`/`)
1. The user visits the home page (`src/app/page.tsx`).
2. They type their note, optionally set a custom URL code, and optionally set a password.
3. Upon clicking "Save", the client sends a `POST` request to `/api/notes`.
4. **Backend (`src/app/api/notes/route.ts`):** 
   * If a custom code wasn't provided, the server generates a random string using `nanoid`.
   * If a password was provided, it is securely hashed using `bcrypt` (10 rounds).
   * The note is inserted into the database using a Firestore Transaction to ensure the code is unique and not already taken. If taken, it returns a `409 Conflict`.
5. The frontend redirects the user to the newly created note's URL using `window.location.href`. This triggers a full page transition to the `/[code]` route, ensuring the client mounts in "Edit" mode and correctly subscribes to the Firestore snapshot listener.

### B. Viewing a Note (`/[code]`)
1. When a user visits `https://yourapp.com/abc123`, the request hits `src/app/[code]/page.tsx`. This is a **Server Component**.
2. The server securely fetches the note from the database before the page even loads.
3. **Password Protection Check:** 
   * If the note has no password, the server passes the full `content` to the client.
   * If the note *has* a password, the server scrubs the `content` (setting it to an empty string) before sending the HTML to the browser. 
4. **Unlocking (`POST /api/verify`):** If the note is protected, the frontend (`NoteEditorClient.tsx`) prompts the user for the password. The password is sent to the verify API, which uses `bcrypt.compare` against the stored hash. If it matches, the API returns the real `content`.

### C. Collaborative Editing & Password Updates
1. Any user looking at the note can type in the textarea and click "Update".
2. This sends a `PATCH` request to `/api/notes/[code]`.
3. **Validation:** 
   * If the note is unprotected, the API accepts the new content and saves it.
   * If the note is protected, the user *must* provide the current password alongside their edits. The API verifies the password again before updating the database.
4. **Changing/Removing Passwords:** Users can pass `newPassword` or `removePassword` flags in the `PATCH` request. The API handles swapping the hash or setting it to `null`.

### D. Live Cross-Device Sync (Firestore Listeners)
Because anyone with the link can edit the note, multiple people might have it open at once. To prevent them from silently overwriting each other, we use **Firestore snapshot listeners** on a metadata-only collection.

1. When a user opens a note, their browser opens a lightweight snapshot listener subscribing to a specific document: `kloudNoteSignals/{code}`.
2. When User A clicks "Update", the `PATCH` request goes to the server and saves the data to the `kloudNotes` collection. It also updates the `kloudNoteSignals` document with a new timestamp.
3. User B receives the snapshot update instantly. Since the ping proves the database was updated, User B's screen displays a yellow banner: *"This note has been updated remotely. Reload to view changes."*
4. **Security Note:** We use the `kloudNoteSignals` collection instead of listening directly to the `kloudNotes` collection. Listening directly to `kloudNotes` would expose the text of password-protected notes to anyone listening. The security rules allow public read access to `kloudNoteSignals` but completely block access to `kloudNotes`.

---

## 5. Folder & File Structure Breakdown

### Pages & Routes (`src/app/`)
* **`page.tsx`**: The home page UI. It simply renders the `NoteEditorClient` in 'create' mode.
* **`[code]/page.tsx`**: The server-side dynamic route for viewing notes. Fetches data and passes it to the client.
* **`src/components/NoteEditorClient.tsx`**: The unified interactive React component where users actually read, type, unlock, and save notes, handling both 'create' and 'edit' modes.
* **`api/notes/route.ts`**: The `POST` endpoint for creating notes.
* **`api/notes/[code]/route.ts`**: The `GET` and `PATCH` endpoints for fetching and updating a specific note.
* **`api/verify/route.ts`**: The endpoint for validating passwords.
* **`api/check/[code]/route.ts`**: The endpoint used to check if a custom short code is already taken.

### Libraries & Utilities (`src/lib/`)
* **`firebase-admin.ts`**: Initializes and exports the Firebase Admin SDK used for database read/writes in the backend.
* **`firebase-client.ts`**: Initializes and exports the Firebase Web SDK used for snapshot listeners in the frontend.
* **`security.ts`**: Houses the `bcrypt` hashing/verifying logic, and IP extraction logic.
* **`validation.ts`**: Contains all the `zod` schemas. This guarantees that APIs fail safely if a user sends bad data (e.g., a short code that is too short).
* **`ratelimit.ts`**: Contains the logic to prevent spam (e.g., creating 100 notes a second).
* **`constants.ts`**: The central place for magic numbers (min password length, max note size, table names).

### Components (`src/components/`)
* **`PasswordDialog.tsx`**: The modal UI for entering, changing, or removing passwords.
* **`SuccessDialog.tsx`**: The modal that pops up with a shareable link after a successful save.
* **`Spinner.tsx` & `ThemeToggle.tsx`**: Reusable UI elements for loading states and dark mode.

---

## 6. Rate Limiting Explained
To prevent abuse (like brute-forcing passwords or spamming note creation), the app uses a rate limiter found in `src/lib/ratelimit.ts`.
* **Production:** It expects an **Upstash Redis** database to track IP addresses globally across all your Vercel serverless functions.
* **Development/Fallback:** If Upstash isn't configured, it gracefully falls back to a simple JavaScript `Map` in memory, ensuring that the app remains functional even in production without Redis. While fine for basic usage, keep in mind that in a serverless environment, memory is wiped constantly, meaning the fallback isn't a robust safeguard against heavy distributed attacks.

---

## 7. Previous Implementation (Supabase)
Before migrating to Firebase, Kloud Notes was built on top of **Supabase (PostgreSQL)**. 

### Database & RLS
The app used a PostgreSQL `notes` table with **Row Level Security (RLS)** strictly configured to deny all public reads and writes. To perform CRUD operations, the Next.js API routes instantiated a Supabase client using a secret `SUPABASE_SERVICE_ROLE_KEY`. This service role bypassed RLS policies, allowing the backend to read notes, verify passwords, and securely scrub content before sending the data to the browser client. 

### Realtime Sync (Supabase Broadcast)
Instead of listening to database changes (which would have leaked protected content via WebSockets), the frontend used **Supabase Realtime Broadcast**. 
When a user updated a note, the API successfully saved it to PostgreSQL. Then, the user's frontend `NoteEditorClient` manually emitted a `broadcast` event to `supabase.channel('note_{code}')`. Any other browser viewing the same note was subscribed to this channel. Upon receiving the ping, they would display the yellow reload banner. 
This approach was secure because the ping only contained a timestamp, not the note's text, completely isolating the realtime channel from the database contents.
