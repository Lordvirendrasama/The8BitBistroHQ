'use client';

import React, { useState } from 'react';
import { CeoActionRecommendation, ActionStatus } from '@/lib/metrics-layer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck2,
  Filter,
  Flame,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Target,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/firebase/auth/use-user';
import { addOwnerTask } from '@/firebase/firestore/owner-tasks';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface ActionCentreProps {
  initialActions: CeoActionRecommendation[];
}

export function OwnerPulseActionCentre({ initialActions }: ActionCentreProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [actions, setActions] = useState<CeoActionRecommendation[]>(initialActions);
  const [statusFilter, setStatusFilter] = useState<'All' | ActionStatus>('All');
  const [convertingTaskId, setConvertingTaskId] = useState<string | null>(null);

  const handleStatusChange = (id: string, newStatus: ActionStatus) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    );
    toast({
      title: `Action Marked: ${newStatus}`,
      description: `Recommendation status updated. Review outcome metric periodically.`,
    });
  };

  const handleConvertToTask = async (action: CeoActionRecommendation) => {
    if (!user) return;
    setConvertingTaskId(action.id);
    try {
      const taskId = await addOwnerTask(
        {
          title: `[CEO Pulse] ${action.title}`,
          description: `${action.suggestedAction}\n\nEvidence: ${action.evidence}\nExpected Impact: ${action.expectedImpact} (${action.impactCalculationFormula})\nAssumptions: ${action.assumptions}`,
          dueDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          priority: action.priority === 'Critical' ? 'high' : action.priority === 'High' ? 'high' : action.priority === 'Medium' ? 'medium' : 'low',
          category: action.category === 'Revenue' || action.category === 'Financial' ? 'strategic' : action.category === 'Gaming' || action.category === 'Cafe' ? 'upgrade' : 'maintenance',
        },
        user
      );

      if (taskId) {
        setActions((prev) =>
          prev.map((a) => (a.id === action.id ? { ...a, status: 'In Progress', taskId } : a))
        );
        toast({
          title: 'Owner Task Created',
          description: `Action added to Owner Tasks queue for execution tracking.`,
        });
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Task Creation Failed',
        description: e.message || 'Could not persist to Owner Tasks.',
      });
    } finally {
      setConvertingTaskId(null);
    }
  };

  const filteredActions = actions.filter((a) => {
    if (statusFilter === 'All') return true;
    return a.status === statusFilter;
  });

  const getSeverityBadge = (severity: CeoActionRecommendation['severity']) => {
    switch (severity) {
      case 'Critical':
        return <Badge className="bg-destructive text-destructive-foreground font-black text-xs">CRITICAL</Badge>;
      case 'Warning':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold text-xs">WARNING</Badge>;
      case 'Opportunity':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 font-bold text-xs">OPPORTUNITY</Badge>;
      case 'Informational':
        return <Badge variant="outline" className="text-muted-foreground font-bold text-xs">INFO</Badge>;
    }
  };

  const getPriorityBadge = (priority: CeoActionRecommendation['priority']) => {
    switch (priority) {
      case 'Critical':
        return <Badge variant="outline" className="border-destructive text-destructive font-mono text-[10px]">P0 CRITICAL</Badge>;
      case 'High':
        return <Badge variant="outline" className="border-amber-500 text-amber-400 font-mono text-[10px]">P1 HIGH</Badge>;
      case 'Medium':
        return <Badge variant="outline" className="border-blue-500 text-blue-400 font-mono text-[10px]">P2 MEDIUM</Badge>;
      case 'Low':
        return <Badge variant="outline" className="border-muted text-muted-foreground font-mono text-[10px]">P3 LOW</Badge>;
    }
  };

  return (
    <Card className="border-2 border-primary/30 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Compass className="h-5 w-5 text-primary" />
            CEO Action Centre &amp; Strategic Execution Hub
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Deterministic Decision Rules, Documented ROI Impact &amp; Task Conversion
          </CardDescription>
        </div>

        {/* STATUS FILTER BUTTONS */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          {(['All', 'New', 'In Progress', 'Completed', 'Dismissed'] as const).map((st) => {
            const count = st === 'All' ? actions.length : actions.filter((a) => a.status === st).length;
            return (
              <Button
                key={st}
                size="sm"
                variant={statusFilter === st ? 'default' : 'outline'}
                onClick={() => setStatusFilter(st)}
                className="h-7 text-xs font-bold uppercase px-2.5 py-0"
              >
                {st} <span className="opacity-70 ml-1 font-mono">({count})</span>
              </Button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {filteredActions.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-primary mx-auto opacity-70" />
            <p className="text-sm font-bold text-foreground">No Actions In Filter</p>
            <p className="text-xs text-muted-foreground">
              All recommendations in this filter status have been resolved or dismissed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredActions.map((action) => (
              <div
                key={action.id}
                className={`p-5 rounded-2xl border-2 transition-all space-y-4 ${
                  action.status === 'Completed'
                    ? 'border-emerald-500/30 bg-emerald-500/5 opacity-80'
                    : action.status === 'Dismissed'
                    ? 'border-border/40 bg-muted/5 opacity-50'
                    : action.severity === 'Critical'
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-border/80 bg-muted/10 hover:border-primary/50'
                }`}
              >
                {/* TOP HEADER */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/30 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono font-bold uppercase">
                      {action.category}
                    </Badge>
                    {getSeverityBadge(action.severity)}
                    {getPriorityBadge(action.priority)}
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Period: {action.reportingPeriod}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase text-muted-foreground">Status:</span>
                    <select
                      value={action.status}
                      onChange={(e) => handleStatusChange(action.id, e.target.value as ActionStatus)}
                      className="h-7 px-2 bg-background border border-border rounded font-bold uppercase text-xs text-foreground outline-none cursor-pointer"
                    >
                      <option value="New">New</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Dismissed">Dismissed</option>
                    </select>
                  </div>
                </div>

                {/* TITLE & REASON */}
                <div className="space-y-1">
                  <h4 className="text-base font-extrabold text-foreground tracking-tight flex items-center gap-2">
                    {action.title}
                  </h4>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    <strong className="text-foreground">Why: </strong>
                    {action.reason}
                  </p>
                </div>

                {/* SUGGESTED ACTION & EVIDENCE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-xl bg-background/50 border border-border/40 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Recommended Action
                    </span>
                    <p className="text-foreground font-semibold leading-relaxed">
                      {action.suggestedAction}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Target className="h-3 w-3" /> Underlying Evidence
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      {action.evidence}
                    </p>
                  </div>
                </div>

                {/* IMPACT, FORMULA & ASSUMPTIONS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Expected Impact</span>
                    <p className="text-sm font-extrabold text-foreground">{action.expectedImpact}</p>
                    <p className="text-[10px] text-muted-foreground font-mono leading-tight pt-1">
                      Formula: {action.impactCalculationFormula}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Confidence &amp; Assumptions</span>
                    <p className="text-xs font-bold text-foreground">Confidence: {action.confidence}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight pt-1">
                      {action.assumptions}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-0.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Metric to Monitor</span>
                      <p className="text-sm font-extrabold text-cyan-400">{action.outcomeMetric}</p>
                    </div>
                    {action.status === 'Completed' && (
                      <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Action completed &bull; Review metric delta
                      </p>
                    )}
                  </div>
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    {!action.taskId ? (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={convertingTaskId === action.id}
                        onClick={() => handleConvertToTask(action)}
                        className="h-8 text-xs font-bold uppercase gap-1.5"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        {convertingTaskId === action.id ? 'Creating Task...' : 'Convert to Owner Task'}
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline" className="h-8 text-xs font-bold uppercase gap-1.5 border-primary/40">
                        <Link href="/owner-tasks">
                          <FileCheck2 className="h-3.5 w-3.5 text-primary" /> View Linked Task
                        </Link>
                      </Button>
                    )}

                    {action.actionUrl && (
                      <Button asChild size="sm" variant="ghost" className="h-8 text-xs font-bold uppercase gap-1 text-primary hover:underline">
                        <Link href={action.actionUrl}>
                          {action.actionText || 'Execute Now'} <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {action.status !== 'Completed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStatusChange(action.id, 'Completed')}
                        className="h-8 text-xs font-bold uppercase text-emerald-400 hover:bg-emerald-500/10"
                      >
                        Mark Done
                      </Button>
                    )}
                    {action.status !== 'Dismissed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStatusChange(action.id, 'Dismissed')}
                        className="h-8 text-xs font-bold uppercase text-muted-foreground hover:bg-muted/30"
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
