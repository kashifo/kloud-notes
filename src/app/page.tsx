import { NoteEditor } from '@/components/NoteEditor';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Kloud Notes
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Create and share secure notes instantly
          </p>
          <p className="text-sm text-gray-500">
            No login required • Password protection optional • Share via link
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <NoteEditor />
        </div>

        <footer className="mt-12 text-center text-sm text-gray-600">
          <p>
            Notes are stored securely with Supabase. Password-protected notes use bcrypt hashing.
          </p>
          <p className="mt-2">
            Built with Next.js, TypeScript, and TailwindCSS
          </p>
        </footer>
      </div>
    </div>
  );
}
