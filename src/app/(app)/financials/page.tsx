
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FinancialsPage() {
  const router = useRouter();
  useEffect(() => {
    router.push('/financials/dashboard');
  }, [router]);
  return null;
}
