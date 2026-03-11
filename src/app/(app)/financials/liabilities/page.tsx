
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect old liabilities route to the new Loan Protocol page.
 */
export default function LiabilitiesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/financials/loan');
  }, [router]);

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="font-headline text-[10px] tracking-widest text-muted-foreground animate-pulse uppercase">Relocating Liabilities Hub...</p>
      </div>
    </div>
  );
}
