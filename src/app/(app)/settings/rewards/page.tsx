'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsRewardsPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/loyalty?tab=rewards');
  }, [router]);

  return <div className="p-8 text-center animate-pulse">Redirecting to Loyalty & Rewards...</div>;
}
