import { redirect } from 'next/navigation';

/** Root URL is protected by Clerk middleware; send signed-in users to the app. */
export default function Home() {
  redirect('/dashboard');
}
