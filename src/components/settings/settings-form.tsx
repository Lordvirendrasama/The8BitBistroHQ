
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2, Users } from 'lucide-react';
import { logUserAction } from '@/firebase/firestore/logs';
import { getSettings, updateSettings } from '@/firebase/firestore/settings';
import type { Settings } from '@/lib/types';

import { migrateMembersToBits } from '@/firebase/firestore/members';

export function SettingsForm() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSubmitting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    getSettings().then(data => {
      setSettings(data);
      setLoading(false);
    });
  }, []);

  const handleRunMigration = async () => {
    setIsMigrating(true);
    try {
      const res = await migrateMembersToBits();
      if (res.success) {
        toast({
          title: 'Bits Migration Complete!',
          description: `Successfully converted points to Bits 1:1 for ${res.count} members.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Migration Error',
          description: 'Failed to complete migration to Bits.',
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Migration Error',
        description: 'An unexpected error occurred.',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!settings) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    const updates: Partial<Settings> = {
        bitsPerRupeeRate: Number(formData.get('bitsPerRupeeRate')) || 0.1,
        bitsPerLevel: Number(formData.get('bitsPerLevel')) || 100,
        activeCycle: String(formData.get('activeCycle')),
        hourlySalaryRate: Number(formData.get('hourlySalaryRate')),
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

  if (loading) return <div className="p-12 text-center opacity-50 font-bold uppercase tracking-normal animate-pulse">Loading Configuration...</div>;

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="font-headline tracking-wide text-2xl">System Configuration</CardTitle>
              <CardDescription>Adjust core Bits loyalty mechanics and active data phase.</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleRunMigration}
              disabled={isMigrating}
              className="font-bold border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
            >
              {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Run Migration to Bits (1:1)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="activeCycle" className="text-primary font-bold uppercase text-sm tracking-normal">Active Data Cycle</Label>
                    <Input name="activeCycle" id="activeCycle" defaultValue={settings?.activeCycle} className="font-bold border-primary/30 bg-primary/5" />
                    <p className="text-sm text-muted-foreground uppercase font-bold">
                        All new transactions will be tagged under this name.
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="hourlySalaryRate" className="text-primary font-bold uppercase text-sm tracking-normal flex items-center gap-2">
                        <Users className="h-3 w-3" /> Staff Hourly Rate (₹)
                    </Label>
                    <Input name="hourlySalaryRate" id="hourlySalaryRate" type="number" defaultValue={settings?.hourlySalaryRate || 100} className="font-bold border-primary/30" />
                    <p className="text-sm text-muted-foreground uppercase font-bold">
                        Base earnings for staff members per hour worked.
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="bitsPerRupeeRate">Base Earning Rate (Bits per ₹10)</Label>
                    <Input name="bitsPerRupeeRate" id="bitsPerRupeeRate" type="number" step="0.01" defaultValue={settings?.bitsPerRupeeRate || 0.1} />
                    <p className="text-xs text-muted-foreground">Default: 0.1 (₹1,000 spent = 100 Bits at 1× RED Tier)</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="bitsPerLevel">Bits per Level Progression</Label>
                    <Input name="bitsPerLevel" id="bitsPerLevel" type="number" defaultValue={settings?.bitsPerLevel || 100} />
                    <p className="text-xs text-muted-foreground">Default: 100 cumulative Bits per level up (Unlimited levels)</p>
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
