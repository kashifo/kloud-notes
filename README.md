# Kloud Notes - Secure Cloud Notepad

A secure, cloud-based notepad web application built with Next.js, TypeScript, and Firebase. Users can create, share, and optionally password-protect notes without requiring login.

## Features

- **No Login Required** - Create and share notes instantly
- **Password Protection** - Optionally secure notes with bcrypt-hashed passwords
- **Unique Short Codes** - Each note gets a unique, shareable short URL
- **Custom Short Codes** - Create custom memorable URLs for your notes
- **Secure by Default** - Security rules enabled in Firestore
- **Rate Limited** - Built-in protection against abuse
- **Mobile Friendly** - Responsive design works on all devices
- **Production Ready** - Optimized for deployment on Vercel

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, TailwindCSS
- **Backend**: Firebase Firestore, Firebase Admin SDK
- **Validation**: Zod
- **Security**: bcryptjs, Rate Limiting (Upstash)
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+ and pnpm (or corepack enable)
- Firebase Firestore for database and realtime cross-device sync.
- Firebase Admin SDK for secure, bypassed database access on the server.
- Optional Upstash Redis for production rate limiting.

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd kloud-notes
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Firebase Setup

1. Create a Firebase Project at [Firebase Console](https://console.firebase.google.com/).
2. Add a Web App and get the configuration.
3. Go to Firestore Database and create a database.
4. Copy the contents of `firestore.rules` and paste them into the **Rules** tab of your Firestore Database (or deploy via Firebase CLI).
5. Go to Project Settings > Service Accounts and generate a new private key.
6. Update `.env.local` with your Firebase client configuration and Admin SDK credentials.

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

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

# Optional: Upstash Redis (for production rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 5. Run the Development Server

```bash
pnpm dev
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
│   │   ├── NoteEditorClient.tsx   # Unified note creation/editing form
│   │   ├── PasswordDialog.tsx
│   │   └── Spinner.tsx
│   ├── lib/
│   │   ├── firebase-client.ts    # Firebase client initialization
│   │   ├── firebase-admin.ts     # Firebase Admin SDK initialization
│   │   ├── validation.ts    # Zod schemas
│   │   ├── security.ts      # Password hashing/verification
│   │   ├── utils.ts         # Utility functions
│   │   ├── constants.ts     # App configuration
│   │   └── ratelimit.ts     # Rate limiting
│   └── types/
│       └── note.ts          # TypeScript interfaces
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

- **Firestore Security Rules**: Database-level security policies
- **Password Hashing**: Bcrypt with 10 rounds
- **Rate Limiting**: Protects against brute-force attacks
- **Input Validation**: Zod schemas validate all inputs
- **XSS Prevention**: Input sanitization
- **No Exposed Secrets**: Firebase Admin SDK keys never sent to client
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
   - All Firebase Client and Admin variables
   - `NEXT_PUBLIC_APP_URL` (set to your Vercel URL)
   - Optional: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

4. Deploy!

### 3. Update App URL

After deployment, update `NEXT_PUBLIC_APP_URL` in Vercel settings to your production URL.

## Configuration

### Rate Limiting

Check:
* `src/lib/firebase-admin.ts`
* `src/lib/firebase-client.ts`
* `src/lib/security.ts`:

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
pnpm build
```

### Run Production Build

```bash
pnpm start
```

### Lint

```bash
pnpm lint
```

## TESTING
  1. Run pnpm build and pnpm lint.
  2. Test with a real Firebase project using the current rules.
  3. Enter custom codes and ensure duplicates are blocked gracefully (HTTP 409).
  4. Edit notes from multiple tabs to verify realtime sync and concurrency.
  5. Confirm Vercel env vars are set, especially FIREBASE_PRIVATE_KEY.
  6. Decide whether Upstash is required for production-grade rate limiting

## Future Enhancements

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
4. **Set up Firebase Auth** - For future user-specific features
5. **Enable database backups** - In Firebase console

## Troubleshooting

### Database Connection Issues

- Verify Firebase URL and keys are correct
- Check if Firestore security rules are deployed
- Ensure Firebase Admin SDK credentials are correct

### Rate Limiting Not Working

- If using Upstash, verify Redis credentials
- Check console for rate limit errors
- In-memory fallback is used when Redis is not configured

### Build Errors

- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`
- Check TypeScript errors: `pnpm build`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ using Next.js, TypeScript, and Firebase
