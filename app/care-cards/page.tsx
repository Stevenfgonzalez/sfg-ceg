import { redirect } from 'next/navigation';

// Legacy route — middleware redirects to /fcc, this is a fallback
export default function CareCardsRedirect() {
  redirect('/fcc');
}
