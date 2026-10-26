import { redirect } from 'next/navigation';

// /notes checks the session and sends signed-out visitors to /sign-in.
export default function HomePage() {
  redirect('/notes');
}
