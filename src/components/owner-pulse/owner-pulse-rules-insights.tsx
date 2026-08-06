'use client';

import React from 'react';
import { RuleInsight } from '@/lib/business-rules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, CheckCircle, AlertCircle, ArrowUpRight, Zap } from 'lucide-react';
import Link from 'next/link';

interface OwnerPulseRulesInsightsProps {
  insights: RuleInsight[];
}

export function OwnerPulseRulesInsights({ insights }: OwnerPulseRulesInsightsProps) {
  if (!insights || insights.length === 0) return null;

  const getColorStyles = (color: RuleInsight['color']) => {
    switch (color) {
      case 'green':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
      case 'blue':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
      case 'amber':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
      case 'red':
        return 'border-destructive/30 bg-destructive/10 text-destructive';
      default:
        return 'border-border bg-muted/10 text-muted-foreground';
    }
  };

  const getIcon = (status: RuleInsight['status']) => {
    switch (status) {
      case 'Growing':
      case 'Celebration':
        return <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />;
      case 'Declining':
      case 'Action Needed':
        return <AlertTriangle className="h-5 w-5 text-destructive shrink-0 animate-pulse" />;
      default:
        return <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />;
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-background/60 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-bold uppercase tracking-wide flex items-center gap-2 text-foreground">
          <Zap className="h-4 w-4 text-primary fill-primary/20" />
          Rule-Based Business Insights ({insights.length})
        </CardTitle>
        <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary">
          DETERMINISTIC ENGINE
        </Badge>
      </CardHeader>
      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map((item) => (
          <div
            key={item.id}
            className={`p-3.5 rounded-xl border-2 flex flex-col justify-between transition-all hover:scale-[1.01] ${getColorStyles(
              item.color
            )}`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getIcon(item.status)}
                  <span className="font-bold text-sm tracking-tight text-foreground">{item.title}</span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                    item.priority === 'High'
                      ? 'bg-destructive/20 text-destructive border-destructive/40'
                      : 'bg-background/40 text-muted-foreground border-border'
                  }`}
                >
                  {item.priority} Priority
                </Badge>
              </div>
              <p className="text-xs opacity-90 leading-relaxed text-muted-foreground font-medium pl-7">
                {item.message}
              </p>
            </div>
            {item.actionUrl && (
              <div className="mt-3 pl-7">
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs font-bold gap-1 p-0 text-primary hover:underline">
                  <Link href={item.actionUrl}>
                    {item.actionText || 'Take Action'} <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
