
'use client';
import { OwnerTaskList } from '@/components/owner/owner-task-list';
import { ExpenseDashboard } from '@/components/owner/expense-dashboard';
import { useAuth } from '@/firebase/auth/use-user';
import { ShieldAlert, ShieldCheck, Wallet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function OwnerTasksPage() {
  const { user } = useAuth();

  // ONLY Viren can see this page
  if (user?.username !== 'Viren') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-4xl font-headline">Access Denied</h1>
        <p className="text-muted-foreground max-w-md font-medium">
          This area is restricted to the Owner (Viren) only. 
          Standard staff and guests do not have permission to view owner-level strategic data and tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-4xl sm:text-5xl tracking-wider text-foreground flex items-center gap-4">
          <ShieldCheck className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
          OWNER CONTROL CENTER
        </h1>
        <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs sm:text-sm pl-1">
          WELCOME BACK, VIREN. MANAGE STRATEGIC TASKS AND UNIFIED FINANCIALS.
        </p>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="flex w-full sm:w-fit gap-4 bg-transparent h-auto p-0 mb-8 overflow-x-auto no-scrollbar">
          <TabsTrigger 
            value="tasks" 
            className="flex-1 sm:flex-initial h-14 px-8 rounded-xl font-black uppercase tracking-tight text-sm gap-3 border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all"
          >
            <ShieldCheck className="h-5 w-5" />
            Checklist & Alerts
          </TabsTrigger>
          <TabsTrigger 
            value="expenses" 
            className="flex-1 sm:flex-initial h-14 px-8 rounded-xl font-black uppercase tracking-tight text-sm gap-3 border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all"
          >
            <Wallet className="h-5 w-5" />
            Financial Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <OwnerTaskList />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <ExpenseDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
