'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { FoodMenuManager } from '@/components/settings/food-menu-manager';
import { CategoryManager } from '@/components/settings/category-manager';
import { GamingPackagesManager } from '@/components/settings/gaming-packages-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function CombinedMenuPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'menu';

  const handleTabChange = (val: string) => {
    router.push(`/settings/menu?tab=${val}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-[600px] grid-cols-3">
          <TabsTrigger value="menu" className="font-bold uppercase text-[10px] tracking-wider">
            Food Menu
          </TabsTrigger>
          <TabsTrigger value="categories" className="font-bold uppercase text-[10px] tracking-wider">
            Categories
          </TabsTrigger>
          <TabsTrigger value="packages" className="font-bold uppercase text-[10px] tracking-wider">
            Gaming Packages
          </TabsTrigger>
        </TabsList>
        <TabsContent value="menu" className="mt-4">
          <FoodMenuManager />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoryManager />
        </TabsContent>
        <TabsContent value="packages" className="mt-4">
          <GamingPackagesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
