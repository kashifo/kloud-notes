import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Home() {
  const randomCode = Math.random().toString(36).substring(2, 10);
  redirect(`/${randomCode}`);
}
