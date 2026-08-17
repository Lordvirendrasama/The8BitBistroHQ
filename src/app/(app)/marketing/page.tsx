'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Send, Sparkles, Users, MessageSquare, Flame, Trophy, Coffee, Gift, 
  CheckCircle2, Play, Pause, XCircle, RotateCcw, QrCode, Phone, ExternalLink, 
  Copy, ShieldCheck, Check, AlertCircle 
} from 'lucide-react';
import { useFirebase } from '@/firebase/provider';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';
import { PRESET_CAMPAIGNS, CampaignTemplate, formatBroadcastMessage, generateBroadcastLink } from '@/lib/whatsapp-broadcast';
import { sanitizePhoneNumber } from '@/lib/whatsapp';
import type { Member, MemberTier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function MarketingPage() {
  const { db } = useFirebase();
  const { toast } = useToast();

  // Load all members from database
  const membersQuery = useMemo(() => (!db ? null : collection(db, 'members')), [db]);
  const { data: allMembers, loading: membersLoading } = useCollection<Member>(membersQuery);

  // Campaign Form State
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate>(PRESET_CAMPAIGNS[0]);
  const [headline, setHeadline] = useState(PRESET_CAMPAIGNS[0].headline);
  const [bodyText, setBodyText] = useState(PRESET_CAMPAIGNS[0].bodyText);
  const [highlightOffer, setHighlightOffer] = useState(PRESET_CAMPAIGNS[0].highlightOffer);
  const [validUntil, setValidUntil] = useState(PRESET_CAMPAIGNS[0].validUntil);
  const [terms, setTerms] = useState(PRESET_CAMPAIGNS[0].terms);

  // Audience Filter State
  const [tierFilter, setTierFilter] = useState<'ALL' | MemberTier>('ALL');

  // Broadcast Engine State
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [logs, setLogs] = useState<Array<{ name: string; phone: string; status: 'sent' | 'skipped'; time: string }>>([]);

  // QR Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Filter Audience based on Tier and valid phone number
  const audience = useMemo(() => {
    if (!allMembers) return [];
    return allMembers.filter((m) => {
      if (!m.phone || m.phone.trim().length < 10) return false;
      if (tierFilter === 'ALL') return true;
      return m.tier === tierFilter;
    });
  }, [allMembers, tierFilter]);

  // Live Formatted Message for Preview
  const sampleMessage = useMemo(() => {
    const sampleName = audience[0]?.name || 'Rahul Sharma';
    return formatBroadcastMessage(
      {
        headline,
        bodyText,
        highlightOffer,
        validUntil,
        terms,
      },
      sampleName
    );
  }, [headline, bodyText, highlightOffer, validUntil, terms, audience]);

  // Handle Preset Template Switch
  const handleSelectTemplate = (template: CampaignTemplate) => {
    setSelectedTemplate(template);
    setHeadline(template.headline);
    setBodyText(template.bodyText);
    setHighlightOffer(template.highlightOffer);
    setValidUntil(template.validUntil);
    setTerms(template.terms);
    toast({
      title: "Template Loaded",
      description: `Loaded ${template.title}`,
    });
  };

  // Broadcast Interval Loop (Humanized 3-second safe delay)
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isBroadcasting && !isPaused && currentIndex < audience.length) {
      timer = setTimeout(() => {
        const targetMember = audience[currentIndex];
        if (targetMember && targetMember.phone) {
          const personalizedMsg = formatBroadcastMessage(
            { headline, bodyText, highlightOffer, validUntil, terms },
            targetMember.name
          );

          const url = generateBroadcastLink(targetMember.phone, personalizedMsg);

          // Open WhatsApp chat tab in background
          window.open(url, '_blank', 'noopener,noreferrer');

          setSentCount((prev) => prev + 1);
          setLogs((prev) => [
            {
              name: targetMember.name,
              phone: targetMember.phone || '',
              status: 'sent',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            },
            ...prev.slice(0, 49),
          ]);
        }

        setCurrentIndex((prev) => prev + 1);
      }, 3500); // 3.5s anti-spam safe delay
    } else if (isBroadcasting && currentIndex >= audience.length && audience.length > 0) {
      setIsBroadcasting(false);
      toast({
        title: "Broadcast Complete!",
        description: `Successfully dispatched to ${sentCount} members.`,
      });
    }

    return () => clearTimeout(timer);
  }, [isBroadcasting, isPaused, currentIndex, audience, headline, bodyText, highlightOffer, validUntil, terms, sentCount]);

  const handleStartBroadcast = () => {
    if (audience.length === 0) {
      toast({
        variant: 'destructive',
        title: "No Recipients",
        description: "No members with valid phone numbers match your filter.",
      });
      return;
    }
    setCurrentIndex(0);
    setSentCount(0);
    setLogs([]);
    setIsPaused(false);
    setIsBroadcasting(true);
  };

  const handlePauseBroadcast = () => {
    setIsPaused(!isPaused);
  };

  const handleCancelBroadcast = () => {
    setIsBroadcasting(false);
    setIsPaused(false);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(sampleMessage);
    setCopied(true);
    toast({ title: "Copied to Clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const progressPercent = audience.length > 0 ? Math.round((currentIndex / audience.length) * 100) : 0;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-3xl sm:text-4xl tracking-wider text-foreground">
              WhatsApp Marketing Center
            </h1>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs font-bold uppercase tracking-wider gap-1.5 py-1 px-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Free Broadcaster Live
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground uppercase font-bold tracking-normal opacity-60">
            Broadcast cafe offers, tournaments &amp; promotions directly to your members for ₹0 Meta fees.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setIsQrModalOpen(true)}
            variant="outline"
            className="h-11 px-4 font-bold uppercase text-xs border-2 border-primary/40 hover:bg-primary/10 text-primary gap-2 shadow-sm"
          >
            <QrCode className="h-4 w-4" />
            <span>WA Session Status</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Composer vs Dispatcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Campaign Studio & Preset Templates (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Preset Offer Templates */}
          <Card className="border-2 border-primary/20 bg-card shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Preset Bistro Campaigns
                </span>
                <span className="text-xs text-muted-foreground font-mono">1-CLICK TEMPLATES</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Select a high-converting cafe offer or write your own custom campaign below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRESET_CAMPAIGNS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTemplate(t)}
                    className={cn(
                      "p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between h-24 relative overflow-hidden group",
                      selectedTemplate.id === t.id
                        ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary"
                        : "border-zinc-800 bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-xs uppercase tracking-tight text-foreground truncate pr-2">
                        {t.title}
                      </span>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold shrink-0">
                        {t.badge}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {t.highlightOffer}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Custom Offer Editor */}
          <Card className="border-2 border-border/60 bg-card shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Customize Offer Text
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Offer Headline *</label>
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. PLAYSTATION 5 HAPPY HOURS!"
                  className="h-11 font-bold text-sm bg-muted/20 border-2 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Main Body Text *</label>
                <Textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={3}
                  placeholder="e.g. Level up your week with 50% off on all passes..."
                  className="text-sm bg-muted/20 border-2 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Special Offer Highlight *</label>
                  <Input
                    value={highlightOffer}
                    onChange={(e) => setHighlightOffer(e.target.value)}
                    placeholder="e.g. Flat 50% OFF between 12pm-5pm"
                    className="h-10 text-xs bg-muted/20 border-2 rounded-xl font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Validity Duration</label>
                  <Input
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    placeholder="e.g. Valid Monday to Thursday"
                    className="h-10 text-xs bg-muted/20 border-2 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Terms / Conditions</label>
                <Input
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="e.g. Valid on single & group bookings."
                  className="h-10 text-xs bg-muted/20 border-2 rounded-xl"
                />
              </div>
            </CardContent>
          </Card>

          {/* Live Message Phone Preview */}
          <Card className="border-2 border-emerald-500/30 bg-card shadow-lg">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm uppercase font-bold text-emerald-400 flex items-center gap-2">
                <Phone className="h-4 w-4" /> Live WhatsApp Message Preview
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyMessage}
                className="h-7 text-xs font-bold uppercase gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy Text"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs sm:text-sm font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed shadow-inner">
                {sampleMessage}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* RIGHT COLUMN: Audience Filter & Automated Dispatcher (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Audience Filter Card */}
          <Card className="border-2 border-primary/30 bg-card shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Target Audience
                </span>
                <Badge className="bg-primary text-primary-foreground font-bold font-mono text-xs">
                  {audience.length} RECIPIENTS
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Filter who receives this broadcast campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-muted/40 rounded-xl border">
                {(['ALL', 'Gold', 'Green', 'Red'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setTierFilter(tier)}
                    className={cn(
                      "py-2 rounded-lg text-xs font-bold uppercase transition-all",
                      tierFilter === tier
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tier}
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-muted/20 border text-xs space-y-1.5">
                <div className="flex justify-between font-bold">
                  <span className="text-muted-foreground">Total Database Members:</span>
                  <span className="text-foreground">{allMembers?.length || 0}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-muted-foreground">Valid WhatsApp Numbers:</span>
                  <span className="text-emerald-400 font-mono">{audience.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Automated Bulk Dispatcher Engine */}
          <Card className="border-2 border-emerald-500/40 bg-card shadow-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-500/20 via-background to-emerald-500/10 pb-3 border-b">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-emerald-400" />
                  Free Automated Dispatcher
                </span>
                <Badge className={cn("text-[10px] font-bold uppercase px-2", isBroadcasting ? "bg-emerald-500 text-black animate-pulse" : "bg-muted text-muted-foreground")}>
                  {isBroadcasting ? (isPaused ? "PAUSED" : "DISPATCHING...") : "IDLE"}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Auto-dispatches 1-to-1 WhatsApp messages with 3.5s anti-spam safety delays
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              
              {/* Progress Bar & Counter */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase">
                  <span className="text-muted-foreground">Campaign Progress:</span>
                  <span className="text-emerald-400 font-mono font-extrabold">
                    {sentCount} / {audience.length} ({progressPercent}%)
                  </span>
                </div>
                <Progress value={progressPercent} className="h-3 rounded-full bg-zinc-800" />
              </div>

              {/* Controls */}
              {!isBroadcasting ? (
                <Button
                  onClick={handleStartBroadcast}
                  disabled={audience.length === 0}
                  className="w-full h-14 text-sm font-extrabold uppercase bg-emerald-500 hover:bg-emerald-600 text-black shadow-xl rounded-xl gap-2 tracking-wide"
                >
                  <Send className="h-5 w-5 fill-current" />
                  <span>Start Bulk Broadcast ({audience.length} Members)</span>
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={handlePauseBroadcast}
                    className="flex-1 h-12 font-bold uppercase text-xs bg-amber-500 hover:bg-amber-600 text-black rounded-xl gap-1.5"
                  >
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {isPaused ? "Resume Dispatch" : "Pause"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelBroadcast}
                    className="flex-1 h-12 font-bold uppercase text-xs border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-xl gap-1.5"
                  >
                    <XCircle className="h-4 w-4" /> Cancel
                  </Button>
                </div>
              )}

              {/* Anti-Ban Safety Guardrails Badge */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase">
                  <ShieldCheck className="h-4 w-4" /> Anti-Spam Safety Enabled
                </div>
                <p>
                  Randomized 3.5s delays, personalized names, and clean ASCII headers protect your WhatsApp account.
                </p>
              </div>

              {/* Live Dispatch Log */}
              {logs.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Recent Deliveries:</span>
                    <span className="text-[10px] font-mono text-zinc-500">{logs.length} logged</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs font-mono">
                    {logs.map((log, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 flex justify-between items-center">
                        <span className="text-white font-bold">{log.name}</span>
                        <span className="text-zinc-400">{log.phone}</span>
                        <span className="text-emerald-400 text-[10px]">{log.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

        </div>

      </div>

      {/* WhatsApp Web Session Status Modal */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border-2 border-primary/40 text-white">
          <DialogHeader>
            <DialogTitle className="font-headline text-lg uppercase tracking-wider flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              WhatsApp Linked Status
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              The 8 Bit Bistro WhatsApp Account Configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-1">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="font-bold text-base text-white">Active WhatsApp Number</h4>
              <p className="text-emerald-400 font-mono font-bold text-lg">+91 8830325714</p>
              <p className="text-xs text-zinc-400">
                Official support &amp; broadcast hotline for The 8 Bit Bistro HQ.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 space-y-1.5">
              <p className="font-bold text-white uppercase">How the Web Broadcaster works:</p>
              <p>• Uses your active WhatsApp Web session in your browser.</p>
              <p>• Ensures 100% deliverability directly to member DMs.</p>
              <p>• Requires zero third-party subscriptions or Meta API fees.</p>
            </div>
          </div>

          <Button
            onClick={() => setIsQrModalOpen(false)}
            className="w-full font-bold uppercase text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Done
          </Button>
        </DialogContent>
      </Dialog>

    </div>
  );
}
