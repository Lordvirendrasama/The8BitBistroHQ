'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, History, Download, Upload, Trash2, Calendar, Filter, Clock, Tag, Zap, ArrowRight, CheckCircle2, UserPlus, Info, ChevronDown, ChevronUp, ReceiptIndianRupee } from 'lucide-react';
import { logDataAction } from '@/firebase/firestore/logs';
import { exportAllData, getCsvTemplate, deleteAllData, importDataFromCsv, retroactivelyTagData, getAvailableCycles, sealAndStartNewCycle, exportGoogleContacts, exportAccountingLedger, type CycleMetadata } from '@/firebase/firestore/data-management';
import { getSettings } from '@/firebase/firestore/settings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function DataManagement() {
  const { toast } = useToast();
  const [currentActiveName, setCurrentActiveName] = useState('');
  const [newPhaseName, setNewPhaseName] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState('');
  const [lastCycleStartDate, setLastCycleStartDate] = useState('');
  const [availableCycles, setAvailableCycles] = useState<CycleMetadata[]>([]);
  const [isSavingCycle, setIsSavingCycle] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingContacts, setIsExportingContacts] = useState(false);
  const [isExportingLedger, setIsExportingLedger] = useState(false);
  const [isTagging, setIsTagging] = useState(false);
  
  // Advanced Export State
  const [exportCycle, setExportCycle] = useState('all_cycles');
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [showOverrides, setShowOverrides] = useState(false);

  // Retroactive Tool State
  const [retroCycle, setRetroCycle] = useState('');
  const [retroStart, setRetroStart] = useState('');
  const [retroEnd, setRetroEnd] = useState('');

  const loadSettings = async () => {
    const s = await getSettings();
    setCurrentActiveName(s.activeCycle);
    if (s.cycleStartDate) setCycleStartDate(s.cycleStartDate);
    if (s.lastCycleStartDate) setLastCycleStartDate(s.lastCycleStartDate);
    
    const cycleData = await getAvailableCycles();
    setAvailableCycles(cycleData);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const selectedCycleMetadata = useMemo(() => {
    return availableCycles.find(c => c.name === exportCycle);
  }, [availableCycles, exportCycle]);

  const handleStartNewPhase = async () => {
    if (!newPhaseName.trim()) {
        toast({ variant: 'destructive', title: "New Phase Name Required" });
        return;
    }
    setIsSavingCycle(true);
    try {
        await sealAndStartNewCycle(currentActiveName, newPhaseName.trim());
        logDataAction(`Sealed phase "${currentActiveName}" and started "${newPhaseName.trim()}"`);
        toast({ title: 'Phase Transition Complete', description: `Data up to now is sealed under "${currentActiveName}".` });
        setNewPhaseName('');
        await loadSettings();
    } catch (e) {
        toast({ variant: 'destructive', title: 'Transition Failed' });
    } finally {
        setIsSavingCycle(false);
    }
  };

  const handleRetroTag = async () => {
    if (!retroCycle) {
        toast({ variant: 'destructive', title: "Tag Label Required" });
        return;
    }
    setIsTagging(true);
    try {
        const count = await retroactivelyTagData(retroCycle, retroStart || undefined, retroEnd || undefined);
        toast({ title: 'Tagging Success', description: `Labeled ${count} records as "${retroCycle}".` });
        await loadSettings();
    } catch (e) {
        toast({ variant: 'destructive', title: 'Process Error' });
    } finally {
        setIsTagging(false);
    }
  };

  const handleLoadLastCycleRange = () => {
    if (!lastCycleStartDate) {
        toast({ variant: 'destructive', title: "No Previous Transition" });
        return;
    }
    setRetroStart(new Date(lastCycleStartDate).toISOString().slice(0, 16));
    setRetroEnd(new Date().toISOString().slice(0, 16));
    toast({ title: "Timeline Loaded" });
  };

  const handleExport = async (mode: 'everything' | 'filtered' | 'ledger') => {
    const filters = mode === 'filtered' || mode === 'ledger' ? {
        cycle: exportCycle === 'all_cycles' ? undefined : exportCycle,
        startDate: exportStart || undefined,
        endDate: exportEnd || undefined,
    } : undefined;

    if (mode === 'ledger') setIsExportingLedger(true);
    else setIsExporting(true);

    try {
        const csv = mode === 'ledger' ? await exportAccountingLedger(filters) : await exportAllData(filters);
        const fileName = mode === 'ledger' ? `bistro-ledger-${exportCycle}.csv` : mode === 'everything' ? 'bistro-full-backup.csv' : `bistro-export-${exportCycle}.csv`;
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        
        toast({ title: mode === 'ledger' ? 'Financial Ledger Exported' : 'Export Generated' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Export Failed' });
    } finally {
        setIsExporting(false);
        setIsExportingLedger(false);
    }
  };

  const handleExportGoogleContacts = async () => {
    setIsExportingContacts(true);
    try {
        const csv = await exportGoogleContacts();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bistro-google-contacts.csv`;
        link.click();
        toast({ title: 'Contacts Exported' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Export Failed' });
    } finally {
        setIsExportingContacts(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
        {/* CYCLE TRANSITION CARD */}
        <Card className="border-2 border-primary/30 bg-background shadow-2xl relative overflow-hidden">
            <CardHeader className="bg-primary/5 border-b py-6">
                <div className="flex items-center gap-4">
                    <div className="bg-primary p-3 rounded-xl shadow-lg">
                        <CheckCircle2 className="text-white h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="font-headline text-2xl tracking-tight">Phase Management</CardTitle>
                        <CardDescription className="font-bold text-xs uppercase tracking-widest text-primary/60">Seal current testing history and start live operations.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <Label className="text-[10px] uppercase font-black tracking-[0.3em] opacity-50 block">Currently Sealing Under</Label>
                        <div className="p-6 rounded-2xl bg-muted/20 border-2 border-dashed flex flex-col justify-center h-32">
                            <p className="text-3xl font-black uppercase text-foreground truncate">{currentActiveName || 'Unlabeled'}</p>
                            <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-muted-foreground uppercase">
                                <Clock className="h-3 w-3" />
                                <span>Phase Active Since: {cycleStartDate ? format(new Date(cycleStartDate), 'PPP p') : 'Beginning of Time'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 flex flex-col justify-end">
                        <Label className="text-[10px] uppercase font-black tracking-[0.3em] text-primary block">Start New Phase Name</Label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input 
                                value={newPhaseName} 
                                onChange={e => setNewPhaseName(e.target.value)} 
                                placeholder="e.g. CAFE LIVE"
                                className="font-black uppercase h-14 text-xl border-2 focus-visible:ring-primary flex-1"
                            />
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button disabled={isSavingCycle || !newPhaseName} size="lg" className="h-14 px-8 font-black uppercase tracking-tight shadow-xl bg-primary hover:bg-primary/90">
                                        <ArrowRight className="mr-2 h-5 w-5" />
                                        Transition
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="border-4 border-primary">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-2xl font-black uppercase">Seal This Period?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-lg font-medium text-foreground">
                                            Everything from the start until NOW will be permanently labeled as <strong>"{currentActiveName}"</strong>. Future data will start fresh as <strong>"{newPhaseName}"</strong>.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleStartNewPhase} className="bg-primary hover:bg-primary/90 font-black uppercase px-8">Seal & Start New</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* DATA EXPORT TOOL */}
        <Card className="border-2 shadow-xl bg-card overflow-hidden">
            <CardHeader className="border-b bg-muted/10 py-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Download className="text-primary h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="font-headline text-xl">Surgical Data Export</CardTitle>
                        <CardDescription>Download organized records by their operational cycle phase.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
                <div className="max-w-2xl space-y-6">
                    <div className="space-y-3">
                        <Label className="text-[10px] uppercase font-black tracking-widest flex items-center gap-2"><Filter className="h-3 w-3 text-primary"/> Choose Phase to Download</Label>
                        <Select value={exportCycle} onValueChange={setExportCycle}>
                            <SelectTrigger className="h-14 text-sm font-black uppercase bg-muted/5 border-2">
                                <SelectValue placeholder="Select phase..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all_cycles" className="font-bold uppercase text-[10px]">Everything (Entire History)</SelectItem>
                                {availableCycles.map(c => (
                                    <SelectItem key={c.name} value={c.name} className="font-bold uppercase text-[10px]">
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* DYNAMIC DATE RANGE PREVIEW */}
                    {exportCycle !== 'all_cycles' && selectedCycleMetadata && (
                        <div className="p-4 rounded-xl bg-primary/5 border-2 border-primary/20 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-primary" />
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Detected Cycle Range</p>
                                    <p className="font-black text-sm uppercase">
                                        {selectedCycleMetadata.start ? format(new Date(selectedCycleMetadata.start), 'MMM d, p') : 'Unknown'} 
                                        <ArrowRight className="inline mx-2 h-3 w-3 opacity-50" /> 
                                        {selectedCycleMetadata.end ? format(new Date(selectedCycleMetadata.end), 'MMM d, p') : 'Now'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ADVANCED OVERRIDES */}
                    <div className="pt-2">
                        <button 
                            onClick={() => setShowOverrides(!showOverrides)}
                            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        >
                            {showOverrides ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>}
                            {showOverrides ? 'Hide Surgical Overrides' : 'Set custom sub-window (Optional)'}
                        </button>
                        
                        {showOverrides && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 animate-in fade-in zoom-in-95 duration-200">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground pl-1">Start Within Phase</Label>
                                    <Input type="datetime-local" value={exportStart} onChange={e => setExportStart(e.target.value)} className="h-12 text-xs font-mono border-2" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground pl-1">End Within Phase</Label>
                                    <Input type="datetime-local" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="h-12 text-xs font-mono border-2" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-4 pt-6 border-t border-dashed">
                    <Button onClick={() => handleExport('ledger')} disabled={isExportingLedger} className="bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-tight h-16 px-12 shadow-2xl text-lg flex-1 sm:flex-none">
                        <ReceiptIndianRupee className="mr-3 h-6 w-6" />
                        Accounting Ledger
                    </Button>
                    <Button onClick={() => handleExport('filtered')} disabled={isExporting} className="bg-primary font-black uppercase tracking-tight h-16 px-12 shadow-2xl text-lg flex-1 sm:flex-none">
                        <Download className="mr-3 h-6 w-6" />
                        Full Cycle Backup
                    </Button>
                    <Button onClick={handleExportGoogleContacts} disabled={isExportingContacts} variant="secondary" className="font-black uppercase tracking-tight h-16 px-12 shadow-xl text-lg border-2 border-primary/20 hover:border-primary/50 flex-1 sm:flex-none">
                        <UserPlus className="mr-3 h-6 w-6 text-primary" />
                        Google Contacts
                    </Button>
                </div>
            </CardContent>
        </Card>

        {/* RETROACTIVE TOOLS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-2 border-dashed bg-muted/5">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Tag className="text-amber-500 h-6 w-6" />
                        <CardTitle className="font-headline text-lg">Retro-Labeler</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleLoadLastCycleRange} className="font-black uppercase text-[9px] tracking-widest h-8 px-3 border-2 hover:bg-amber-500/10">
                        <Zap className="mr-1.5 h-3 w-3 text-amber-500" />
                        Previous Phase Window
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black tracking-widest">Apply Label</Label>
                            <Input value={retroCycle} onChange={e => setRetroCycle(e.target.value)} placeholder="e.g. TESTING 1" className="font-bold h-10 uppercase" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black tracking-widest">From</Label>
                            <Input type="datetime-local" value={retroStart} onChange={e => setRetroStart(e.target.value)} className="h-10 text-xs font-mono border-2" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black tracking-widest">To</Label>
                            <Input type="datetime-local" value={retroEnd} onChange={e => setRetroEnd(e.target.value)} className="h-10 text-xs font-mono border-2" />
                        </div>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" disabled={isTagging || !retroCycle} className="w-full border-2 border-amber-500/50 hover:bg-amber-500/10 font-black uppercase text-[10px] h-12 shadow-md">
                                {isTagging ? 'Tagging...' : 'Run Retroactive Tagging'}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Bulk Tag Records?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will update the cycle name for records between <strong>{retroStart || 'Beginning'}</strong> and <strong>{retroEnd || 'Now'}</strong>.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleRetroTag} className="bg-amber-500 font-bold">Apply</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

            <Card className="bg-destructive/5 border-2 border-destructive/20">
                <CardHeader>
                    <CardTitle className="text-lg font-black uppercase text-destructive">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full font-black uppercase h-16 shadow-lg">
                                <Trash2 className="mr-2 h-5 w-5" />
                                Wipe All History
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-4 border-destructive">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-2xl font-black text-destructive">PERMANENT WIPEOUT?</AlertDialogTitle>
                                <AlertDialogDescription className="text-lg font-bold">
                                    Deletes EVERY document across ALL cycles. Irreversible.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => { await deleteAllData(); window.location.reload(); }} className="bg-destructive hover:bg-destructive/90 font-black uppercase">Destroy Everything</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
