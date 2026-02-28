
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2 } from 'lucide-react';
import { logUserAction } from '@/firebase/firestore/logs';
import { getSettings, updateSettings } from '@/firebase/firestore/settings';
import type { Settings } from '@/lib/types';

export function SettingsForm() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSubmitting] = useState(false);

  useEffect(() => {
    getSettings().then(data => {
      setSettings(data);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!settings) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    const updates: Partial<Settings> = {
        xpPerRupee: Number(formData.get('xpPerRupee')),
        xpPerLevel: Number(formData.get('xpPerLevel')),
        pointsPerLevelUp: Number(formData.get('pointsPerLevelUp')),
        maxLevels: Number(formData.get('maxLevels')),
        activeCycle: String(formData.get('activeCycle')),
    };

    const success = await updateSettings(updates);

    if (success) {
        logUserAction('Updated global loyalty settings.', { updates });
        toast({
            title: 'Settings Saved!',
            description: 'The system configuration has been updated.',
        });
        setSettings(prev => ({ ...prev!, ...updates }));
    } else {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to save settings to Firestore.',
        });
    }
    setIsSubmitting(false);
  };

  if (loading) return <div className="p-12 text-center opacity-50 font-bold uppercase tracking-widest animate-pulse">Loading Configuration...</div>;

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="font-headline tracking-wide text-2xl">System Configuration</CardTitle>
          <CardDescription>Adjust the core mechanics and set the current active data phase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="activeCycle" className="text-primary font-black uppercase text-[10px] tracking-widest">Active Data Cycle</Label>
                    <Input name="activeCycle" id="activeCycle" defaultValue={settings?.activeCycle} className="font-bold border-primary/30 bg-primary/5" />
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                        All new transactions will be tagged under this name.
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="xpPerRupee">XP per Rupee (₹)</Label>
                    <Input name="xpPerRupee" id="xpPerRupee" type="number" defaultValue={settings?.xpPerRupee} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="xpPerLevel">XP per Level</Label>
                    <Input name="xpPerLevel" id="xpPerLevel" type="number" defaultValue={settings?.xpPerLevel} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="pointsPerLevelUp">Points per Level Up</Label>
                    <Input name="pointsPerLevelUp" id="pointsPerLevelUp" type="number" defaultValue={settings?.pointsPerLevelUp} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="maxLevels">Maximum Levels</Label>
                    <Input name="maxLevels" id="maxLevels" type="number" defaultValue={settings?.maxLevels} />
                </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSaving} className="font-bold tracking-wider h-12 px-8">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Global Config
              </Button>
            </div>
        </CardContent>
      </form>
    </Card>
  );
}
