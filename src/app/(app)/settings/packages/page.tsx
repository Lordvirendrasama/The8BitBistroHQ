'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPackagesPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/menu?tab=packages');
  }, [router]);

  return <div className="p-8 text-center animate-pulse">Redirecting to Gaming Packages...</div>;
}
