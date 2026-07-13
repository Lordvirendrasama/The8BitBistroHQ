'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsExEmployeesPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/employees?tab=archived');
  }, [router]);

  return <div className="p-8 text-center animate-pulse">Redirecting to Archived Operators...</div>;
}
