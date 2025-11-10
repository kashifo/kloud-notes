project: kloud-notes (Cloud Notepad)
objective: Build a secure, cloud-based notepad web app using Next.js + TypeScript + Supabase. Users can create, read, and optionally password-protect notes without login.
stack:
  frontend: Next.js (App Router, TypeScript, TailwindCSS)
  backend: Supabase (PostgreSQL with RLS)
  orm: Drizzle ORM (optional)
  hosting: Vercel
  validation: Zod
  security: Supabase RLS + bcrypt + rate limiting
  analytics: Sentry + Vercel Analytics
deployment: Vercel
language: TypeScript
agents:
  - role: frontend
    description: Implement UI components, routing, and styling.
  - role: backend
    description: Set up Supabase schema, RLS, and API routes.
  - role: infra
    description: Configure deployment and environment variables.
  - role: qa
    description: Test functionality, performance, and security compliance.
tasks:
  - setup Next.js project with TypeScript and TailwindCSS
  - connect to Supabase backend
  - implement note CRUD (create + read only)
  - add optional password protection with bcrypt
  - implement unique short-code generator and validation
  - configure Supabase RLS and security policies
  - host final build on Vercel
evaluation_criteria:
  - must run fully on Vercel
  - Supabase RLS enabled and tested
  - passwords hashed, not stored as plain text
  - unique short codes enforced at DB level
  - fast, secure, and mobile-friendly UI
---

# 🧠 AI AGENT INSTRUCTIONS — CLOUD NOTEPAD PROJECT

## 1. GOAL
Develop a **production-ready**, **secure**, and **lightweight** cloud-based notepad application.

Users can:
- Create notes without logging in.
- Get a **short unique code** (e.g. `https://notepads.vercel.app/abcd123`).
- Optionally **lock a note with a password**.
- Share and view notes by short link.

---

## 2. TECHNOLOGY OVERVIEW

| Layer | Tech | Purpose |
|-------|------|----------|
| Frontend | Next.js (App Router) + TypeScript | UI, Routing, SSR |
| Backend | Supabase (PostgreSQL) | Data storage |
| ORM | Drizzle ORM | Type-safe SQL (optional) |
| Styling | TailwindCSS | Minimal design |
| Validation | Zod | Input validation |
| Hosting | Vercel | Deployment and edge functions |
| Security | RLS, bcrypt, Rate Limiting | Data & API protection |
| Analytics | Sentry, Vercel Analytics | Monitoring and logging |

---

## 3. FOLDER STRUCTURE

```

src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── [code]/page.tsx
│   ├── api/
│   │   ├── notes/route.ts
│   │   └── verify/route.ts
│   └── globals.css
├── components/
│   ├── NoteEditor.tsx
│   ├── PasswordDialog.tsx
│   └── Spinner.tsx
├── lib/
│   ├── supabase.ts
│   ├── utils.ts
│   ├── constants.ts
│   ├── validation.ts
│   └── security.ts
└── types/
└── note.ts

````

---

## 4. FUNCTIONAL REQUIREMENTS

### Note Creation
- Allow note creation with or without password.
- Generate a **random 6–8 char short code** (alphanumeric).
- Accept custom short code if unique.
- Return note URL (e.g., `https://notepads.vercel.app/abc123`).
- Save note to Supabase:  
  `{ id, short_code, content, password_hash, created_at, updated_at }`.

### Note Viewing
- Fetch note by `short_code`.
- If password-protected, prompt for password and verify hash server-side.

### Optional Editing
- Allow edits only if the same anonymous session is active (optional, local UUID).

---

## 5. DATABASE SCHEMA

**Table: `notes`**
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | primary key |
| short_code | text | unique, indexed |
| content | text | not null |
| password_hash | text | nullable |
| created_at | timestamp | default now() |
| updated_at | timestamp | default now() |

---

## 6. SECURITY CONFIGURATION

### Enable RLS
```sql
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
````

### Policies

```sql
CREATE POLICY "Allow public insert" ON notes
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select" ON notes
FOR SELECT USING (true);
```

### Password Handling

* Hash passwords with **bcryptjs** before saving.
* Never store plain text passwords.
* Verify password on backend route with safe compare.
* Apply rate limiting per IP to prevent brute-force attempts.

### Additional Measures

* Sanitize user inputs to avoid XSS.
* Restrict max note size (e.g., 10 KB).
* Apply `@upstash/ratelimit` middleware for rate limiting.
* Prevent HTML injection via proper encoding.
* Use HTTPS-only cookies (if any state stored).
* Do not expose service role key to client.

---

## 7. FRONTEND INSTRUCTIONS

### Pages

| Path                   | Description          |
| ---------------------- | -------------------- |
| `/`                    | Create a new note    |
| `/[code]`              | View a note          |
| `/[code]?password=...` | Access a locked note |

### Components

* **NoteEditor.tsx** → Textarea + Create Button.
* **PasswordDialog.tsx** → Password modal input.
* **Spinner.tsx** → Loading indicator.

### Styling

* Use **Tailwind CSS**.
* Keep design minimalist and responsive.
* Use **shadcn/ui** components if desired.

---

## 8. API ROUTES

### POST `/api/notes`

**Creates a new note.**

**Body:**

```json
{
  "content": "Example note content",
  "password": "1234",
  "customCode": "mynote"
}
```

**Response:**

```json
{
  "shortCode": "mynote",
  "url": "https://notepads.vercel.app/mynote"
}
```

### GET `/api/notes/[code]`

Fetch a note by short code.

### POST `/api/verify`

Verify password for locked notes.

---

## 9. ENVIRONMENT VARIABLES

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://notepads.vercel.app
```

---

## 10. CODE QUALITY RULES

* Use **TypeScript strict mode**.
* Validate all input with **Zod**.
* Use **async/await** properly.
* Add comments and types for every function.
* Use ESLint + Prettier.
* Avoid inline SQL unless using parameterized queries.

---

## 11. TESTING REQUIREMENTS

* Use **Vitest** for unit/integration tests.
* Test:

  * short-code uniqueness
  * password protection flow
  * RLS enforcement
* Mock Supabase in tests where possible.

---

## 12. PERFORMANCE TARGETS

* Optimize for fast page loads.
* Cache note reads with SWR or ISR.
* Use Supabase index on `short_code`.
* Limit payload size in API responses.

---

## 13. MONITORING & ANALYTICS

* Use **Sentry** for exception tracking.
* Enable **Vercel Analytics** for performance monitoring.
* Add request logging middleware for API routes.

---

## 14. DEPLOYMENT INSTRUCTIONS

1. Push repo to GitHub.
2. Link to **Vercel**.
3. Set environment variables in Vercel dashboard.
4. Deploy to production.
5. Test note creation and retrieval from live URL.

---

## 15. DELIVERABLES

* Deployed production app on Vercel.
* Secure Supabase backend with RLS.
* Type-safe, clean, and modular codebase.
* Working password-protected notes.
* Documentation and `.env.example` file included.

---

## 16. DEVELOPMENT RULES FOR AI AGENTS

1. Always use **Next.js App Router**.
2. Always write **TypeScript** (no JS files).
3. Validate API inputs with **Zod**.
4. Use RLS before writing data.
5. Enforce unique short codes in DB.
6. Never expose secret keys to frontend.
7. Use Edge API routes where possible.
8. Keep components modular.
9. Maintain accessibility (semantic HTML).
10. Optimize builds for production.

---

## 17. EXAMPLE NOTE CREATION FLOW

1. User visits `/`
2. Writes note: `"Hello world"`
3. Clicks “Create Note”
4. App generates short code `abc123`
5. Returns URL: `https://notepads.vercel.app/abc123`
6. Visiting link loads the note.
7. If password-protected, prompt password before showing.

---

## 18. FINAL OUTPUT EXPECTATION

A **fully working**, **secure**, and **minimal** notepad web app:

* Hosted on Vercel.
* Powered by Supabase with RLS.
* Password-protected notes supported.
* Shareable short links functional.
* Type-safe and production-optimized.

---

```

✅ Project Complete!

I've successfully built Kloud Notes - a secure, production-ready cloud notepad application! All changes have been committed and pushed to the branch claude/kloud-notes-setup-011CUyWGc6Lz5eikBfrz37jJ.
🎉 What Was Built

Complete Full-Stack Application:

    Frontend: Beautiful, responsive UI with Next.js 15 + TypeScript + TailwindCSS
    Backend: Secure Supabase PostgreSQL database with Row Level Security
    API: Three REST endpoints for creating, fetching, and verifying notes
    Components: NoteEditor, PasswordDialog, and Spinner components
    Security: Bcrypt password hashing, rate limiting, input validation

📁 Project Structure

kloud-notes/
├── src/
│   ├── app/
│   │   ├── [code]/page.tsx          # View notes by short code
│   │   ├── api/notes/route.ts       # Create notes
│   │   ├── api/notes/[code]/route.ts # Fetch note
│   │   ├── api/verify/route.ts      # Password verification
│   │   ├── layout.tsx & page.tsx    # Home page
│   ├── components/                   # React components
│   ├── lib/                          # Utilities & config
│   └── types/                        # TypeScript types
├── supabase/migrations/              # Database schema
├── .env.example                      # Environment variables template
└── README.md                         # Comprehensive documentation

🔐 Security Features Implemented

✅ Password Protection: Bcrypt hashing (10 rounds)
✅ Row Level Security (RLS): Database-level protection
✅ Rate Limiting: Protects against brute-force attacks
✅ Input Validation: Zod schemas on all API routes
✅ XSS Prevention: Input sanitization
✅ Constant-Time Comparison: Timing attack protection
🚀 Next Steps

1. Set Up Supabase:

    Create a project at supabase.com
    Run the SQL migration from supabase/migrations/00001_create_notes_table.sql
    Copy your API keys

2. Configure Environment Variables:

cp .env.example .env.local
# Edit .env.local with your Supabase credentials

3. Run Locally:

npm run dev

Visit http://localhost:3000

4. Deploy to Vercel:

    Connect your GitHub repository to Vercel
    Add environment variables in Vercel settings
    Deploy!

📝 Key Files Created

API Routes (src/app/api/):

    notes/route.ts:147 - POST endpoint for creating notes
    notes/[code]/route.ts:89 - GET endpoint for fetching notes
    verify/route.ts:109 - POST endpoint for password verification

Components (src/components/):

    NoteEditor.tsx:156 - Create notes with advanced options
    PasswordDialog.tsx:64 - Secure password entry modal
    Spinner.tsx:20 - Loading states

Library (src/lib/):

    supabase.ts:53 - Database client configuration
    security.ts:47 - Password hashing & verification
    validation.ts:58 - Zod input validation schemas
    utils.ts:65 - Helper functions
    constants.ts:51 - App configuration
    ratelimit.ts:101 - Rate limiting setup

✨ Features

✅ Create notes without login
✅ Password-protect sensitive notes
✅ Custom short codes (e.g., /my-note)
✅ Auto-generated unique codes
✅ Copy note content & share links
✅ Mobile-responsive design
✅ Production-ready build (TypeScript strict mode)
📚 Documentation

The README.md includes:

    Complete setup instructions
    Supabase configuration guide
    API documentation
    Security considerations
    Deployment guide for Vercel
    Troubleshooting tips
    Configuration options