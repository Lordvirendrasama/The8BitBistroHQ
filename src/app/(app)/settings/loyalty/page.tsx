'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { SettingsForm } from '@/components/settings/settings-form';
import { RewardsTable } from '@/components/rewards/rewards-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function LoyaltyConfigPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'config';

  const handleTabChange = (val: string) => {
    router.push(`/settings/loyalty?tab=${val}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="config" className="font-bold uppercase text-sm tracking-wider">
            Loyalty Config
          </TabsTrigger>
          <TabsTrigger value="rewards" className="font-bold uppercase text-sm tracking-wider">
            Rewards Catalog
          </TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-4">
          <SettingsForm />
        </TabsContent>
        <TabsContent value="rewards" className="mt-4">
          <RewardsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
