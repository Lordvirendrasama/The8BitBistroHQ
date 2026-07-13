'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsCategoriesPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/menu?tab=categories');
  }, [router]);

  return <div className="p-8 text-center animate-pulse">Redirecting to Categories...</div>;
}
