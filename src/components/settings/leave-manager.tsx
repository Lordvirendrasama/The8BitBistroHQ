
'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarRange, ArrowRight } from 'lucide-react';
import Link from 'next/link';

/**
 * Functional Placeholder: Management has moved to the Leaves Tracker page.
 */
export function LeaveManager() {
  return (
    <Card className="border-2 border-dashed bg-muted/5">
      <CardHeader className="text-center py-12 flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-primary/5 border-2 border-primary/10">
          <CalendarRange className="h-12 w-12 text-primary opacity-20" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl font-headline tracking-tighter uppercase">Registry Relocated</CardTitle>
          <CardDescription className="text-[10px] text-muted-foreground uppercase font-black tracking-widest max-w-sm mx-auto">
            Staff leave management and absence recording has been unified within the <strong>Leaves Tracker</strong> for better operational visibility.
          </CardDescription>
        </div>
        <Button asChild className="mt-4 font-black uppercase tracking-widest h-12 px-8 shadow-lg">
          <Link href="/leaves">
            Open Leaves Tracker
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
    </Card>
  );
}
