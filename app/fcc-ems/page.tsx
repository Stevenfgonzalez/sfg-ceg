import { redirect } from 'next/navigation';

// Legacy route — middleware redirects to /fcc/[householdId], this is a fallback
export default function FccEmsRedirect() {
  redirect('/fcc');
}
