# Kloud Notes - Secure Cloud Notepad

A secure, cloud-based notepad web application built with Next.js, TypeScript, and Supabase. Users can create, share, and optionally password-protect notes without requiring login.

## Features

- **No Login Required** - Create and share notes instantly
- **Password Protection** - Optionally secure notes with bcrypt-hashed passwords
- **Unique Short Codes** - Each note gets a unique, shareable short URL
- **Custom Short Codes** - Create custom memorable URLs for your notes
- **Secure by Default** - Row Level Security (RLS) enabled in Supabase
- **Rate Limited** - Built-in protection against abuse
- **Mobile Friendly** - Responsive design works on all devices
- **Production Ready** - Optimized for deployment on Vercel

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, TailwindCSS
- **Backend**: Supabase (PostgreSQL with RLS)
- **Validation**: Zod
- **Security**: bcryptjs, Rate Limiting (Upstash)
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+ and npm
- A Supabase account ([sign up here](https://supabase.com))
- Optional: Upstash Redis account for production rate limiting

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd kloud-notes
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new project at [Supabase](https://app.supabase.com)
2. Go to **Project Settings** > **API** and copy:
   - Project URL
   - Anon (public) key
   - Service role key (keep this secret!)

3. Run the database migration:
   - Go to **SQL Editor** in your Supabase dashboard
   - Copy the contents of `supabase/migrations/00001_create_notes_table.sql`
   - Paste and run it

This will:
- Create the `notes` table
- Add necessary indexes
- Enable Row Level Security (RLS)
- Set up RLS policies for public read/write

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Upstash Redis (for production rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
kloud-notes/
├── src/
│   ├── app/
│   │   ├── [code]/          # Dynamic route for viewing notes
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   ├── notes/       # Create note endpoint
│   │   │   │   ├── route.ts
│   │   │   │   └── [code]/  # Fetch note endpoint
│   │   │   │       └── route.ts
│   │   │   └── verify/      # Password verification endpoint
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx         # Home page (create note)
│   │   └── globals.css
│   ├── components/
│   │   ├── NoteEditor.tsx   # Note creation form
│   │   ├── PasswordDialog.tsx
│   │   └── Spinner.tsx
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   ├── validation.ts    # Zod schemas
│   │   ├── security.ts      # Password hashing/verification
│   │   ├── utils.ts         # Utility functions
│   │   ├── constants.ts     # App configuration
│   │   └── ratelimit.ts     # Rate limiting
│   └── types/
│       └── note.ts          # TypeScript interfaces
├── supabase/
│   └── migrations/
│       └── 00001_create_notes_table.sql
├── .env.example
├── .env.local              # Your local environment variables (not committed)
└── README.md
```

## API Routes

### POST `/api/notes`

Create a new note.

**Request Body:**
```json
{
  "content": "Your note content",
  "password": "optional-password",
  "customCode": "optional-custom-code"
}
```

**Response:**
```json
{
  "shortCode": "abc123",
  "url": "https://your-domain.com/abc123"
}
```

### GET `/api/notes/[code]`

Fetch a note by short code. Returns content only if not password-protected.

### POST `/api/verify`

Verify password for a password-protected note.

**Request Body:**
```json
{
  "shortCode": "abc123",
  "password": "user-password"
}
```

## Security Features

- **Row Level Security (RLS)**: Database-level security policies
- **Password Hashing**: Bcrypt with 10 rounds
- **Rate Limiting**: Protects against brute-force attacks
- **Input Validation**: Zod schemas validate all inputs
- **XSS Prevention**: Input sanitization
- **No Exposed Secrets**: Service role key never sent to client
- **Constant-Time Comparison**: Password verification resistant to timing attacks

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy to Vercel

1. Go to [Vercel](https://vercel.com)
2. Import your repository
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (set to your Vercel URL)
   - Optional: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

4. Deploy!

### 3. Update App URL

After deployment, update `NEXT_PUBLIC_APP_URL` in Vercel settings to your production URL.

## Configuration

### Rate Limiting

Edit `src/lib/constants.ts` to adjust rate limits:

```typescript
export const RATE_LIMIT = {
  CREATE_NOTE: { requests: 5, window: '1m' },
  VERIFY_PASSWORD: { requests: 10, window: '1m' },
  FETCH_NOTE: { requests: 30, window: '1m' },
};
```

### Note Size Limits

```typescript
export const NOTE = {
  MAX_SIZE_BYTES: 10 * 1024, // 10 KB
  MAX_SIZE_CHARS: 10000,
};
```

### Short Code Settings

```typescript
export const SHORT_CODE = {
  MIN_LENGTH: 6,
  MAX_LENGTH: 8,
  CUSTOM_MAX_LENGTH: 50,
};
```

## Optional: Set Up Upstash Redis

For production-grade rate limiting across multiple instances:

1. Create account at [Upstash](https://console.upstash.com)
2. Create a new Redis database
3. Copy REST URL and token to environment variables
4. The app will automatically use Redis when configured

## Development

### Build for Production

```bash
npm run build
```

### Run Production Build

```bash
npm start
```

### Lint

```bash
npm run lint
```

## Future Enhancements

- [ ] Note editing (for creator only)
- [ ] Note expiration (auto-delete after X days)
- [ ] Note view analytics
- [ ] Rich text editor
- [ ] File attachments
- [ ] Custom themes
- [ ] API key authentication

## Security Considerations

1. **Never commit `.env.local`** - It contains sensitive keys
2. **Rotate keys regularly** - Especially if compromised
3. **Monitor rate limits** - Adjust based on your traffic
4. **Set up Supabase auth** - For future user-specific features
5. **Enable database backups** - In Supabase dashboard

## Troubleshooting

### Database Connection Issues

- Verify Supabase URL and keys are correct
- Check if RLS policies are properly set up
- Ensure database migration was run successfully

### Rate Limiting Not Working

- If using Upstash, verify Redis credentials
- Check console for rate limit errors
- In-memory fallback is used when Redis is not configured

### Build Errors

- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run build`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ using Next.js, TypeScript, and Supabase
