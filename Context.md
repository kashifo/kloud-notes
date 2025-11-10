Kloud Notes - Project Context
Tech Stack

    Next.js 15 (App Router) + TypeScript + TailwindCSS
    Supabase (PostgreSQL + RLS)
    Bcrypt for password hashing
    Zod for validation
    nanoid for code generation

Project Structure
/src/app - Pages & API Routes

/page.tsx                 → Home page (create/edit notes)
/[code]/page.tsx          → Server component (SSR, fetches note data)
/[code]/NotePageClient.tsx → Client component (handles interactivity)
/api/notes/route.ts       → POST: Create note
/api/notes/[code]/route.ts → GET: Fetch note, PATCH: Update note
/api/verify/route.ts      → POST: Verify password
/api/check/[code]/route.ts → GET: Check code availability

/src/components

    ThemeToggle.tsx - Dark/light mode toggle button
    PasswordDialog.tsx - Modal for set/verify/remove password (has ESC handler, close button)
    SuccessDialog.tsx - Shows success message after save with copy link
    Spinner.tsx - Loading indicator

/src/contexts

    ThemeContext.tsx - Global theme state (light/dark), localStorage persistence, overrides system preference

/src/lib

    supabase.ts - Supabase client (anon key + service role key)
    constants.ts - All config values (limits, URLs, bcrypt rounds)
    validation.ts - Zod schemas (customCode min: 3 chars, password optional)
    security.ts - bcrypt hash/verify functions
    utils.ts - generateShortCode, formatDate, toPublicNote

/src/types

    note.ts - TypeScript interfaces (Note, PublicNote)

Key Features & How They Work
1. Theme System

    ThemeContext wraps app in layout.tsx
    Checks localStorage first, then system preference
    Applies dark class to <html> element
    TailwindCSS uses dark: prefix for dark mode styles

2. Password Protection

    Optional per note
    bcrypt with 10 rounds (server-side only)
    Dialog modes: 'set' (with remove button if password exists) | 'verify'
    Has close button + ESC key handler (only in 'set' mode)

3. Short Codes

    Auto-generated on page load (8 chars via Math.random)
    Real-time duplicate checking with 500ms debounce
    Visual feedback: green ✓ available | red ✗ taken
    Min 3 chars, max 50 chars, alphanumeric + hyphens/underscores

4. Note Flow

Home (/) → User types note → Auto-gen code shown → Save
         → API creates note → URL changes to /[code] via history.pushState
         → Success dialog shows

/[code] → Server fetches data → Client component renders
        → If password protected, show dialog first
        → Can edit, update, copy link, remove password, create new note

5. Database (Supabase)

Table: notes
- id (UUID, primary key)
- short_code (TEXT, unique)
- content (TEXT)
- password_hash (TEXT, nullable)
- created_at, updated_at (TIMESTAMP)
- RLS enabled: public insert/select allowed

Configuration Files

    .env.local - Supabase URL/keys (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
    tailwind.config.ts - Dark mode: 'class' (uses .dark class)
    src/lib/constants.ts - All limits and config

Key Design Patterns

    Server/Client Split - /[code] uses SSR for speed, client for interactivity
    URL State Management - history.pushState updates URL without reload
    Theme Persistence - localStorage + explicit classList manipulation (no toggle)
    Password Security - Never sends plaintext, always hashed server-side
    Rate Limiting - Upstash Redis (optional) or in-memory fallback
    Responsive Design - Mobile-first, buttons hide/show via sm: breakpoints

Important Notes

    Custom codes min 3 chars (was 6, fixed for "tag", "test", etc.)
    Theme overrides system preference (localStorage takes precedence)
    "Protect with Password" button shows full text on desktop, icon on mobile
    Password dialog has remove option when password exists
    Footer stacks vertically on mobile
    All 4 custom link elements (label, prefix, input, button) in one row, right-aligned

