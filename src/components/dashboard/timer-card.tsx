
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Station, AssignedMember, StationStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gamepad2, Pause, Play, StopCircle, Users, User, Clock, Utensils, ArrowRightLeft, Bell, ChevronDown, CheckCircle2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TimerCardProps {
  station: Station;
  onToggleTimer: (station: Station) => void;
  onStopSession: (station: Station) => void;
  onOpenBillModal: (station: Station) => void;
  onOpenEditTimeModal: (station: Station) => void;
  onOpenMoveModal?: (station: Station) => void;
  onStopPlayer?: (stationId: string, playerId: string) => void;
  onOpenJoinModal?: (station: Station) => void;
  onTogglePlayerTimer?: (stationId: string, playerId: string) => void;
}

const formatTime = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const IndividualPlayerTimer = ({ 
    member, 
    stationStatus 
}: { 
    member: AssignedMember, 
    stationStatus: StationStatus 
}) => {
    const [rem, setRem] = useState(0);
    const isRunning = stationStatus === 'in-use' && member.status !== 'paused';
    const isPaused = stationStatus === 'paused' || member.status === 'paused';

    useEffect(() => {
        if (member.status === 'finished') {
            setRem(0);
            return;
        }

        if (isPaused) {
            setRem((member.remainingTimeOnPause ?? 0) * 1000);
            return;
        }

        if (!member.endTime || !isRunning) {
            setRem(0);
            return;
        }

        const endTs = new Date(member.endTime).getTime();
        const update = () => {
            const diff = endTs - Date.now();
            setRem(diff > 0 ? diff : 0);
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [member, isRunning, isPaused]);

    if (member.status === 'finished' || !member.endTime) return null;

    return (
        <span className={cn(
            "font-mono font-bold text-xs ml-auto mr-3 px-2 py-0.5 rounded border shadow-sm",
            member.status === 'paused' ? "text-blue-600 bg-blue-500/10 border-blue-500/20" :
            rem <= 0 ? "text-destructive bg-destructive/10 border-destructive/20 animate-pulse" : 
            rem < 5 * 60 * 1000 ? "text-yellow-600 bg-yellow-500/10 border-yellow-500/20" : 
            "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
        )}>
            {formatTime(rem)}
        </span>
    );
};

export function TimerCard({ station, onToggleTimer, onStopSession, onOpenBillModal, onOpenEditTimeModal, onOpenMoveModal, onStopPlayer, onOpenJoinModal, onTogglePlayerTimer }: TimerCardProps) {
  const [minRemaining, setMinRemaining] = useState(0);
  const [maxRemaining, setMaxRemaining] = useState(0);
  const [isManageOpen, setIsManageOpen] = useState(false);
  
  const isRunning = station.status === 'in-use';
  const isPaused = station.status === 'paused';

  const activeMembers = useMemo(() => 
    station.members.filter(m => m.status !== 'finished'), 
  [station.members]);

  const activeWithTimers = useMemo(() => activeMembers.filter(m => !!m.endTime), [activeMembers]);

  const shortestMember = useMemo(() => {
    if (activeWithTimers.length === 0) return null;
    return activeWithTimers.reduce((prev, curr) => {
        const prevEnd = new Date(prev.endTime!).getTime();
        const currEnd = new Date(curr.endTime!).getTime();
        return prevEnd < currEnd ? prev : curr;
    });
  }, [activeWithTimers]);

  const longestMember = useMemo(() => {
    if (activeWithTimers.length === 0) return null;
    return activeWithTimers.reduce((prev, curr) => {
        const prevEnd = new Date(prev.endTime!).getTime();
        const currEnd = new Date(curr.endTime!).getTime();
        return prevEnd > currEnd ? prev : curr;
    });
  }, [activeWithTimers]);

  useEffect(() => {
    const update = () => {
        const now = Date.now();

        if (isPaused) {
            const minPause = shortestMember?.remainingTimeOnPause ?? station.remainingTimeOnPause ?? 0;
            const maxPause = longestMember?.remainingTimeOnPause ?? station.remainingTimeOnPause ?? 0;
            setMinRemaining(minPause * 1000);
            setMaxRemaining(maxPause * 1000);
            return;
        }

        const minEnd = shortestMember?.endTime || station.endTime;
        const maxEnd = longestMember?.endTime || station.endTime;

        if (!minEnd || !isRunning) {
            setMinRemaining(0);
            setMaxRemaining(0);
            return;
        }

        const minTs = new Date(minEnd).getTime();
        const maxTs = new Date(maxEnd).getTime();

        setMinRemaining(Math.max(0, minTs - now));
        setMaxRemaining(Math.max(0, maxTs - now));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isRunning, isPaused, shortestMember, longestMember, station.endTime, station.remainingTimeOnPause]);

  const isTimeUp = minRemaining <= 0 && (shortestMember?.endTime || station.endTime) && isRunning;
  const isTimeLow = minRemaining > 0 && minRemaining < 5 * 60 * 1000 && isRunning;

  const cardBorderColor = isPaused ? 'border-blue-500' : isTimeUp ? 'border-destructive' : isTimeLow ? 'border-yellow-500' : isRunning ? 'border-emerald-500' : 'border-border';
  const cardBgColor = isPaused ? 'bg-blue-500/5' : isTimeUp ? 'bg-destructive/5' : isTimeLow ? 'bg-yellow-500/5' : isRunning ? 'bg-emerald-500/5' : 'bg-card';

  const showTwoTimers = activeWithTimers.length > 1 && maxRemaining > minRemaining + 1000;

  return (
    <Card className={cn(
        "flex flex-col transition-all h-full overflow-hidden border-2 shadow-sm font-body",
        cardBorderColor,
        cardBgColor
    )}>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2 p-4">
        <div className="flex flex-col gap-1">
            <CardTitle className="text-lg font-display tracking-tight uppercase flex items-center gap-2">
                {station.type === 'ps5' ? <Gamepad2 className="h-5 w-5"/> : <Users className="h-5 w-5" />}
                {station.name}
            </CardTitle>
            {shortestMember && (
                <span className="text-[10px] font-bold uppercase text-primary tracking-normal flex items-center gap-1.5 bg-background/80 border border-primary/10 px-2 py-0.5 rounded-full w-fit shadow-sm">
                    <User className="h-2.5 w-2.5" />
                    {shortestMember.name}
                </span>
            )}
        </div>
        <div className="flex flex-col items-end gap-1">
            <Badge variant={isRunning || isPaused ? 'default' : 'secondary'} className={cn(
                "font-bold uppercase text-[10px] tracking-tight",
                isPaused && 'bg-blue-600',
                isRunning && !isTimeUp && 'bg-emerald-600',
                isTimeLow && 'bg-yellow-600',
                isTimeUp && 'bg-destructive',
            )}>
                {isPaused ? "Paused" : isTimeUp ? "Time's Up" : isRunning ? 'In Use' : 'Available'}
            </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-grow flex flex-col items-center justify-center space-y-3 py-2 px-4 relative">
        <div className="flex flex-col items-center">
            <div className={cn(
                "text-4xl font-bold font-mono tracking-tighter tabular-nums leading-none transition-colors",
                isTimeUp && "text-destructive",
                isTimeLow && "text-yellow-600"
                )}>
                {(shortestMember?.endTime || station.endTime) ? formatTime(minRemaining) : "00:00"}
            </div>
            {showTwoTimers && (
                <div className="mt-1.5 flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="text-[9px] font-bold uppercase text-muted-foreground opacity-60 tracking-widest leading-none mb-0.5">Session Ends</div>
                    <div className="text-base font-bold font-mono text-muted-foreground/80 tracking-tight tabular-nums leading-none">
                        {formatTime(maxRemaining)}
                    </div>
                </div>
            )}
        </div>

        <Popover open={isManageOpen} onOpenChange={setIsManageOpen}>
            <div className="h-14 flex items-center justify-center mt-2">
            {(isRunning || isPaused) && station.members.length > 0 ? (
                <PopoverTrigger asChild>
                    <button className="flex -space-x-3 hover:scale-105 transition-transform cursor-pointer focus:outline-none">
                        {station.members.map((member) => (
                            <div 
                                key={member.id} 
                                className={cn(
                                    "relative rounded-full border-2 transition-all shadow-md",
                                    shortestMember?.id === member.id ? "border-primary z-10 scale-110" : "border-background",
                                    member.status === 'finished' && "opacity-30 grayscale cursor-default"
                                )}
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={member.avatarUrl} />
                                    <AvatarFallback className="text-[10px] font-bold">{member.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                {shortestMember?.id === member.id && !isTimeUp && (
                                    <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-0.5 shadow-sm ring-1 ring-background">
                                        <Bell className="h-2.5 w-2.5" />
                                    </div>
                                )}
                                {member.status === 'finished' && (
                                    <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center">
                                        <CheckCircle2 className="h-4 w-4 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </button>
                </PopoverTrigger>
            ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
                    <User className="h-5 w-5" />
                    <span className="text-[8px] font-bold uppercase tracking-normal">Idle Session</span>
                </div>
            )}
            </div>

            {(isRunning || isPaused) && station.members.length > 0 && (
                <PopoverContent className="w-80 p-0 overflow-hidden shadow-2xl border-2 font-body" align="center">
                    <div className="bg-muted/30 p-3 border-b flex justify-between items-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Session Audit</p>
                        <Badge variant="outline" className="text-[9px] font-bold border-primary/20 text-primary uppercase">{station.members.length} Players</Badge>
                    </div>
                    <ScrollArea className="max-h-72">
                        <div className="divide-y">
                            {station.members.map(member => (
                                <div key={member.id} className="p-3 flex items-center justify-between hover:bg-muted/5 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <Avatar className="h-8 w-8 border shadow-sm">
                                            <AvatarImage src={member.avatarUrl} />
                                            <AvatarFallback className="text-[10px] font-bold">{member.name[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <p className={cn("text-xs font-bold uppercase truncate", member.status === 'finished' && "line-through opacity-40")}>{member.name}</p>
                                            {member.status !== 'finished' && (
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                                                    {member.endTime ? 'Live Timer' : 'Open Order'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <IndividualPlayerTimer member={member} stationStatus={station.status} />

                                        {member.status !== 'finished' && (
                                            <div className="flex gap-1">
                                                <Button 
                                                    variant="outline" 
                                                    size="icon" 
                                                    className={cn("h-8 w-8", member.status === 'paused' ? "text-emerald-600" : "text-blue-600")}
                                                    onClick={() => onTogglePlayerTimer?.(station.id, member.id)}
                                                >
                                                    {member.status === 'paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                                </Button>
                                                <Button 
                                                    variant="destructive" 
                                                    size="sm" 
                                                    className="h-8 px-3 text-[10px] font-bold uppercase shadow-sm shrink-0"
                                                    onClick={() => {
                                                        onStopPlayer?.(station.id, member.id);
                                                        if (station.members.filter(m => m.status !== 'finished').length <= 1) {
                                                            setIsManageOpen(false);
                                                        }
                                                    }}
                                                >
                                                    Stop
                                                </Button>
                                            </div>
                                        )}
                                        {member.status === 'finished' && (
                                            <Badge variant="outline" className="h-5 px-2 text-[9px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">DONE</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <div className="p-3 bg-muted/10 border-t">
                        <Button variant="outline" size="sm" className="w-full h-9 text-[10px] font-bold uppercase tracking-widest gap-2" onClick={() => setIsManageOpen(false)}>
                            Close Audit
                        </Button>
                    </div>
                </PopoverContent>
            )}
        </Popover>

        <div className="flex flex-col items-center gap-1">
            {station.startTime && (isRunning || isPaused) && (
                <div className="text-[9px] font-bold text-muted-foreground flex items-center gap-1.5 bg-muted/30 px-3 py-1 rounded-full shadow-inner">
                    <Clock className="h-3 w-3" />
                    <span>Started: {new Date(station.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 p-3 pt-2 bg-muted/5 border-t">
          {station.status === 'available' ? (
              <div className="grid grid-cols-2 gap-2 w-full">
                  <Button onClick={() => onToggleTimer(station)} variant={station.type === 'ps5' ? 'default' : 'outline'} size="sm" className="font-bold uppercase h-11 tracking-tight text-xs shadow-sm">
                      <Play className="h-4 w-4 mr-1.5 shrink-0" />
                      <span>{station.type === 'ps5' ? 'Start' : 'Play'}</span>
                  </Button>
                  <Button onClick={() => onOpenBillModal(station)} variant={station.type === 'ps5' ? 'outline' : 'default'} size="sm" className="font-bold uppercase h-11 tracking-tight text-xs border-2">
                      <Utensils className="h-4 w-4 mr-1.5 shrink-0" />
                      <span>Food</span>
                  </Button>
              </div>
          ) : (
              <>
                  <div className="grid grid-cols-4 gap-1.5 w-full">
                      {station.status === 'in-use' ? (
                          <Button onClick={() => onToggleTimer(station)} variant="secondary" size="sm" className="h-10 flex flex-col items-center justify-center p-0 gap-0.5 border shadow-sm">
                              <Pause className="h-3.5 w-3.5" />
                              <span className="text-[8px] font-bold uppercase leading-none">Pause</span>
                          </Button>
                      ) : (
                          <Button onClick={() => onToggleTimer(station)} variant="default" size="sm" className="h-10 flex flex-col items-center justify-center p-0 gap-0.5 bg-blue-600 hover:bg-blue-700 shadow-md">
                              <Play className="h-3.5 w-3.5" />
                              <span className="text-[8px] font-bold uppercase leading-none">Resume</span>
                          </Button>
                      )}
                      <Button onClick={() => onOpenEditTimeModal(station)} variant="secondary" size="sm" className="h-10 flex flex-col items-center justify-center p-0 gap-0.5 text-emerald-600 hover:bg-emerald-50 border-emerald-100 shadow-sm">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3.5 w-3.5"
                          >
                            <path d="M10 2h4" />
                            <circle cx="12" cy="14" r="8" />
                            <path d="M12 11v6" />
                            <path d="M9 14h6" />
                          </svg>
                          <span className="text-[8px] font-bold uppercase leading-none">Time</span>
                      </Button>
                      <Button onClick={() => onOpenJoinModal?.(station)} variant="secondary" size="sm" className="h-10 flex flex-col items-center justify-center p-0 gap-0.5 text-emerald-600 hover:bg-emerald-50 border-emerald-100 shadow-sm">
                          <UserPlus className="h-3.5 w-3.5"/>
                          <span className="text-[8px] font-bold uppercase leading-none">Join</span>
                      </Button>
                      <Button onClick={() => onOpenMoveModal?.(station)} variant="secondary" size="sm" className="h-10 flex flex-col items-center justify-center p-0 gap-0.5 border-primary/20 text-primary hover:bg-primary/5 shadow-sm">
                          <ArrowRightLeft className="h-3.5 w-3.5"/>
                          <span className="text-[8px] font-bold uppercase leading-none">Move</span>
                      </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 w-full">
                      <Button onClick={() => onStopSession(station)} variant="destructive" size="sm" className="h-11 font-bold uppercase tracking-tight text-xs shadow-md">
                          <StopCircle className="h-4 w-4 mr-1.5"/> Stop All
                      </Button>
                      <Button variant="outline" size="sm" className="h-11 font-bold uppercase tracking-tight text-xs border-2 bg-background hover:bg-muted" onClick={() => onOpenBillModal(station)}>
                          <Utensils className="h-4 w-4 mr-1.5" /> Food
                      </Button>
                  </div>
              </>
          )}
      </CardFooter>
    </Card>
  );
}
