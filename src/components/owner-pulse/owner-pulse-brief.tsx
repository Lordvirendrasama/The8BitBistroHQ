'use client';

import { OwnerBriefData } from '@/lib/business-rules';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/firebase/auth/use-user';
import { Sparkles, TrendingUp, TrendingDown, Users, Coins, Target, Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OwnerPulseBrief({ data }: { data: OwnerBriefData }) {
  const { user } = useAuth();
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const name = user?.displayName ? user.displayName.charAt(0).toUpperCase() + user.displayName.slice(1) : 'Owner';

  return (
    <Card className="bg-zinc-950/50 border border-zinc-800 shadow-xl overflow-hidden mb-6 relative group">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/80 group-hover:bg-primary transition-colors" />
      <CardContent className="p-6">
        <h2 className="text-xl font-bold font-display tracking-tight text-white mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {getGreeting()}, {name}.
        </h2>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            {data.revenuePctChange >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" /> : <TrendingDown className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
            <p className="text-sm font-medium text-zinc-300">
              Revenue this month is <strong className={data.revenuePctChange >= 0 ? "text-emerald-400" : "text-destructive"}>{data.revenuePctChange >= 0 ? 'up' : 'down'} {Math.abs(data.revenuePctChange)}%</strong>.
            </p>
          </div>

          <div className="flex items-start gap-3">
            {data.footfallPctChange >= 0 ? <Users className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" /> : <Users className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
            <p className="text-sm font-medium text-zinc-300">
              Footfall is <strong className={data.footfallPctChange >= 0 ? "text-emerald-400" : "text-destructive"}>{data.footfallPctChange >= 0 ? 'up' : 'down'} {Math.abs(data.footfallPctChange)}%</strong>.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Coins className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-zinc-300">
              Average customer spends <strong>₹{Math.abs(data.avgSpendDifference)} {data.avgSpendDifference >= 0 ? 'more' : 'less'}</strong> than last month.
            </p>
          </div>

          {data.highestRoiProduct && (
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-zinc-300">
                Your highest revenue product is <strong>{data.highestRoiProduct}</strong>.
              </p>
            </div>
          )}

          {data.idleHoursThisMonth > 0 && (
             <div className="flex items-start gap-3">
               <TrendingDown className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
               <p className="text-sm font-medium text-zinc-300">
                 Your controllers were idle for <strong className="text-destructive">{data.idleHoursThisMonth.toLocaleString()} hours</strong> out of a potential {data.totalPossibleHoursThisMonth.toLocaleString()} hours this month.
               </p>
             </div>
          )}

          {data.bestWeekdayTarget > 0 && (
             <div className="flex items-start gap-3">
               <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
               <p className="text-sm font-medium text-zinc-300">
                 Best {data.bestWeekdayName} was <strong className="text-primary">₹{data.bestWeekdayTarget.toLocaleString()}</strong> on {data.bestWeekdayDate}. Need <strong>₹{data.bestWeekdayRemaining.toLocaleString()}</strong> more today to break this record.
               </p>
             </div>
          )}

          <div className="flex items-start gap-3 pt-3 mt-3 border-t border-zinc-800">
             <ChevronRight className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
             <p className="text-sm font-medium text-white">
               <span className="opacity-70 uppercase text-xs tracking-wider mr-2 font-bold text-yellow-500">Recommended priority today:</span> 
               {data.recommendedPriority}
             </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
