'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { EmployeeManager } from '@/components/settings/employee-manager';
import { ArchivedOperators } from '@/components/settings/ex-employees';
import { useAuth } from '@/firebase/auth/use-user';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function EmployeeSettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const isViren = user?.username === 'Viren';
  const activeTab = searchParams.get('tab') || 'active';

  const handleTabChange = (val: string) => {
    router.push(`/settings/employees?tab=${val}`);
  };

  if (!isViren) {
    return <EmployeeManager />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="active" className="font-bold uppercase text-[10px] tracking-wider">
            Active Registry
          </TabsTrigger>
          <TabsTrigger value="archived" className="font-bold uppercase text-[10px] tracking-wider">
            Archived Operators
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <EmployeeManager />
        </TabsContent>
        <TabsContent value="archived" className="mt-4">
          <ArchivedOperators />
        </TabsContent>
      </Tabs>
    </div>
  );
}
