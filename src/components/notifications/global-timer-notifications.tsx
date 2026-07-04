
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, limit, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useData } from '@/context/data-context';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import type { Station, AudioAnnouncement } from '@/lib/types';
import { generateSpeech } from '@/ai/flows/tts-flow';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock } from 'lucide-react';
import { updateStation } from '@/firebase/firestore/stations';

/**
 * Universal Voice Announcer Engine
 */

const audioQueue: string[] = [];
let isProcessingQueue = false;
let globalToast: any = null;
let activeUtterance: SpeechSynthesisUtterance | null = null; // Prevent GC
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  return sharedAudioCtx;
}

function playBeep() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  try {
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1); // C#6
    osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.2); // E6
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(1, ctx.currentTime + 0.4);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio beep failed", e);
  }
}

async function processQueue(audioRef: React.RefObject<HTMLAudioElement | null>) {
  if (isProcessingQueue || audioQueue.length === 0 || !audioRef?.current) return;
  
  isProcessingQueue = true;
  const text = audioQueue.shift()!;

  if (text.trim() !== "") {
    playBeep();
  }

  const fallbackSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Clear any hung utterances
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      // Try to find a natural sounding English voice
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Premium') || v.name.includes('Natural'))) || 
                             voices.find(v => v.lang.startsWith('en')) || 
                             voices[0];
      
      if (preferredVoice) utterance.voice = preferredVoice;
      activeUtterance = utterance; // Keep reference to prevent GC
      
      utterance.onend = () => {
        activeUtterance = null;
        isProcessingQueue = false;
        setTimeout(() => processQueue(audioRef), 100);
      };

      utterance.onerror = (e: any) => {
        activeUtterance = null;
        const errCode = (e as any).error;
        if (errCode === 'interrupted' || errCode === 'canceled' || errCode === 'not-allowed') {
           // Standard interruptions or permission denial, just move on
        } else {
           console.error(`SpeechSynthesis actual failure [${errCode}]:`, e);
        }
        
        if (typeof window !== 'undefined' && window.navigator.platform.toLowerCase().includes('linux')) {
            if (globalToast && errCode !== 'interrupted') {
                globalToast({
                    title: "Audio Link Failure",
                    description: errCode === 'not-allowed' ? "Browser blocked audio. Click settings to allow." : "Synthesis failed. System restart might help.",
                    variant: "destructive"
                });
            }
        }
        isProcessingQueue = false;
        setTimeout(() => processQueue(audioRef), 100);
      };

      // Brave/Linux specific: utterances can sometimes hang if too long or if voices aren't ready
      setTimeout(() => {
        if (isProcessingQueue) {
            console.warn("SpeechSynthesis timed out, forcing next in queue");
            isProcessingQueue = false;
            processQueue(audioRef);
        }
      }, 10000);

      window.speechSynthesis.speak(utterance);
    } else {
      console.error("SpeechSynthesis NOT supported in this browser");
      isProcessingQueue = false;
      processQueue(audioRef);
    }
  };

  try {
    const response = await generateSpeech({ text });
    if (response.audioDataUri && audioRef.current) {
      audioRef.current.src = response.audioDataUri;
      audioRef.current.onended = () => {
        isProcessingQueue = false;
        processQueue(audioRef);
      };
      audioRef.current.onerror = () => {
        fallbackSpeech();
      };
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          fallbackSpeech();
        });
      }
    } else {
      fallbackSpeech();
    }
  } catch (error) {
    fallbackSpeech();
  }
}

let globalAudioRef: React.RefObject<HTMLAudioElement | null> | null = null;
let globalUnlockFunc: (() => void) | null = null;

export async function announceGlobally(text: string, audioRef?: React.RefObject<HTMLAudioElement | null>) {
  if (typeof window === 'undefined') return;
  
  if (audioRef) {
    globalAudioRef = audioRef;
  }

  audioQueue.push(text);
  
  if (globalAudioRef) {
    if (globalUnlockFunc) globalUnlockFunc();
    processQueue(globalAudioRef);
  }
}

export function GlobalTimerNotifications() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  const [breakState, setBreakState] = useState<any>(null);
  const [showBreakOverAlert, setShowBreakOverAlert] = useState(false);
  const lastAlertedBreakStart = useRef<string | null>(null);

  useEffect(() => {
    globalToast = toast;
  }, [toast]);

  // Listen to Firestore break timer config
  useEffect(() => {
    if (!db) return;
    const docRef = doc(db, 'settings', 'break_timer');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBreakState(data);
        // If break timer is set to inactive from somewhere else, close alert
        if (data.status === 'inactive') {
          setShowBreakOverAlert(false);
        }
      } else {
        setBreakState(null);
        setShowBreakOverAlert(false);
      }
    });
    return () => unsubscribe();
  }, [db]);


  const announcedWarnings = useRef<Set<string>>(new Set());
  const announcedEnds = useRef<Set<string>>(new Set());
  const processedAnnouncements = useRef<Set<string>>(new Set());
  const [activeEndAlert, setActiveEndAlert] = useState<{ station: Station, memberName: string } | null>(null);
  const [activeWarningAlert, setActiveWarningAlert] = useState<{ station: Station, memberName: string } | null>(null);
  const activeEndAlertRef = useRef<{ station: Station, memberName: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isUnlocked = useRef(false);
  const sessionStartTime = useRef(new Date().toISOString());

  // Automatically dismiss the "5 Minutes Left" warning alert when a session ends alert is shown
  useEffect(() => {
    activeEndAlertRef.current = activeEndAlert;
    if (activeEndAlert) {
      setActiveWarningAlert(null);
    }
  }, [activeEndAlert]);

  const { stations } = useData();
  const activeStations = useMemo(() => stations?.filter(s => s.status === 'in-use' || s.status === 'paused') || null, [stations]);

  const announcementsQuery = useMemo(() => {
    if (!db) return null;
    return query(
      collection(db, 'announcements'), 
      where('timestamp', '>', sessionStartTime.current),
      limit(10)
    );
  }, [db]);
  const { data: announcementsData } = useCollection<AudioAnnouncement>(announcementsQuery);

  const playAnnouncement = useCallback(async (text: string) => {
    await announceGlobally(text, audioRef);
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      announceGlobally("", audioRef);
    }
  }, []);

  // Check if break is active and expired
  useEffect(() => {
    if (!breakState || breakState.status !== 'active' || !breakState.endTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const endTimeMs = new Date(breakState.endTime).getTime();
      const diff = endTimeMs - now;

      if (diff <= 0) {
        // Break has expired!
        if (user && user.username !== 'Viren') {
          if (lastAlertedBreakStart.current !== breakState.startTime) {
            lastAlertedBreakStart.current = breakState.startTime;
            setShowBreakOverAlert(true);
            playAnnouncement("Break time is over. Please return to work.");
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [breakState, user, playAnnouncement]);

  const handleAcknowledgeBreakOver = async () => {
    setShowBreakOverAlert(false);
    if (!db) return;
    try {
      const docRef = doc(db, 'settings', 'break_timer');
      await updateDoc(docRef, { status: 'inactive' });
      toast({ title: "Break Reset Complete", description: "Bistro status returned to normal." });
    } catch (err) {
      console.error("Error acknowledging break over:", err);
    }
  };

  const unlockAudio = useCallback(() => {
    if (isUnlocked.current) return;
    
    // 1. Unlock Web Audio API (AudioContext)
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const context = new AudioContext();
      if (context.state === 'suspended') {
        context.resume().then(() => {
            console.log("AudioContext resumed successfully");
        });
      }
    }

    // 2. Unlock HTML5 Audio Element (for AI TTS)
    if (audioRef.current && !isProcessingQueue) {
      // Use a slightly longer silent buffer to ensure the hardware is engaged
      audioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
      audioRef.current.play()
        .then(() => { 
          isUnlocked.current = true; 
          console.log("HTML5 Audio unlocked");
        })
        .catch((err) => {
          console.warn("HTML5 Audio unlock failed:", err);
        });
    }

    // 3. Unlock SpeechSynthesis (for Fallback TTS)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      
      // Force voice loading for Linux/Brave
      window.speechSynthesis.getVoices();
    }
    
    // If we've done all we can, mark as unlocked (or at least attempted)
    isUnlocked.current = true;
  }, []);

  useEffect(() => {
    globalUnlockFunc = unlockAudio;
    return () => { globalUnlockFunc = null; };
  }, [unlockAudio]);

  // 1. Voice loading effect
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      
      const voiceInterval = setInterval(() => {
        if (window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.getVoices();
        } else {
            clearInterval(voiceInterval);
        }
      }, 5000);
      
      return () => clearInterval(voiceInterval);
    }
  }, []);

  // 2. Interaction event listeners for unlocking audio
  useEffect(() => {
    const handleInteraction = () => {
      if (!isUnlocked.current) {
        unlockAudio();
      }
    };

    window.addEventListener('mousedown', handleInteraction, { passive: true });
    window.addEventListener('keydown', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    window.addEventListener('click', handleInteraction, { passive: true });
    
    return () => {
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [unlockAudio]);

  useEffect(() => {
    if (!announcementsData) return;
    const sorted = [...announcementsData].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    sorted.forEach(ann => {
      if (!processedAnnouncements.current.has(ann.id)) {
        processedAnnouncements.current.add(ann.id);
        playAnnouncement(ann.text);
      }
    });
  }, [announcementsData, playAnnouncement]);

  useEffect(() => {
    if (!activeStations) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      activeStations.forEach((station) => {
        if (station.status !== 'in-use') return;

        const activeMembersWithTimers = station.members.filter(m => m.status !== 'finished' && !!m.endTime);
        
        // 1. SESSION END CHECK
        const endCandidates = activeMembersWithTimers.filter(m => {
            const mEndTime = new Date(m.endTime!).getTime();
            const mRemaining = mEndTime - now;
            const endKey = `${station.id}-${m.id}-ended`;
            return mRemaining <= 0 && !announcedEnds.current.has(endKey);
        });

        if (endCandidates.length > 1) {
            // Group announcement for multiple players
            endCandidates.forEach(m => announcedEnds.current.add(`${station.id}-${m.id}-ended`));
            playAnnouncement(`Time is up for ${station.name}. All sessions ended.`);
            setActiveEndAlert({ station, memberName: "EVERYONE" });
            setActiveWarningAlert(null);
        } else if (endCandidates.length === 1) {
            // Individual announcement for single player
            const m = endCandidates[0];
            announcedEnds.current.add(`${station.id}-${m.id}-ended`);
            playAnnouncement(`Time is up for ${m.name} at ${station.name}.`);
            setActiveEndAlert({ station, memberName: m.name });
            setActiveWarningAlert(null);
        }

        // 2. FIVE MINUTE WARNING CHECK
        const warningCandidates = activeMembersWithTimers.filter(m => {
            const mEndTime = new Date(m.endTime!).getTime();
            const mRemaining = mEndTime - now;
            const warningKey = `${station.id}-${m.id}-5min`;
            const endKey = `${station.id}-${m.id}-ended`;
            
            return mRemaining <= fiveMinutes && mRemaining > 0 && 
                   !announcedWarnings.current.has(warningKey) && 
                   !announcedEnds.current.has(endKey);
        });

        if (warningCandidates.length > 1) {
            warningCandidates.forEach(m => announcedWarnings.current.add(`${station.id}-${m.id}-5min`));
            playAnnouncement(`Attention. Five minutes remaining for everyone at ${station.name}. Please ask if they will be continuing or ending their session.`);
            if (!activeEndAlertRef.current) {
                setActiveWarningAlert({ station, memberName: "EVERYONE" });
            }
        } else if (warningCandidates.length === 1) {
            const m = warningCandidates[0];
            announcedWarnings.current.add(`${station.id}-${m.id}-5min`);
            playAnnouncement(`Attention. Five minutes remaining for ${m.name} at ${station.name}. Please ask if they will be continuing or ending their session.`);
            if (!activeEndAlertRef.current) {
                setActiveWarningAlert({ station, memberName: m.name });
            }
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [activeStations, playAnnouncement, toast]);

  // Dismiss warning alert when end alert is displayed
  useEffect(() => {
    if (activeEndAlert) {
      setActiveWarningAlert(null);
    }
  }, [activeEndAlert]);

  // Sync activeWarningAlert with activeStations list to auto-dismiss if session state changes
  useEffect(() => {
    if (!activeWarningAlert || !activeStations) return;

    const { station: warningStation, memberName } = activeWarningAlert;
    const currentStation = activeStations.find(s => s.id === warningStation.id);

    if (!currentStation || currentStation.status !== 'in-use') {
      setActiveWarningAlert(null);
      return;
    }

    const now = Date.now();

    if (memberName !== "EVERYONE") {
      const activeMember = currentStation.members.find(
        m => m.name === memberName && m.status !== 'finished'
      );
      if (!activeMember || !activeMember.endTime) {
        setActiveWarningAlert(null);
        return;
      }
      const mEndTime = new Date(activeMember.endTime).getTime();
      const mRemaining = mEndTime - now;
      if (mRemaining > 5 * 60 * 1000) {
        setActiveWarningAlert(null);
      }
    } else {
      const activeMembers = currentStation.members.filter(m => m.status !== 'finished' && !!m.endTime);
      if (activeMembers.length === 0) {
        setActiveWarningAlert(null);
        return;
      }
      // Check if all active members have more than 5 minutes remaining
      const allHaveMoreTime = activeMembers.every(m => {
        const mEndTime = new Date(m.endTime!).getTime();
        return (mEndTime - now) > 5 * 60 * 1000;
      });
      if (allHaveMoreTime) {
        setActiveWarningAlert(null);
      }
    }
  }, [activeStations, activeWarningAlert]);

  // Sync activeEndAlert with activeStations list to auto-dismiss if session state changes
  useEffect(() => {
    if (!activeEndAlert || !activeStations) return;

    const { station: endStation, memberName } = activeEndAlert;
    const currentStation = activeStations.find(s => s.id === endStation.id);

    if (!currentStation || (currentStation.status !== 'in-use' && currentStation.status !== 'finishing')) {
      setActiveEndAlert(null);
      return;
    }

    const now = Date.now();

    if (memberName !== "EVERYONE") {
      const activeMember = currentStation.members.find(
        m => m.name === memberName && m.status !== 'finished'
      );
      if (!activeMember || !activeMember.endTime) {
        setActiveEndAlert(null);
        return;
      }
      const mEndTime = new Date(activeMember.endTime).getTime();
      const mRemaining = mEndTime - now;
      if (mRemaining > 0) {
        setActiveEndAlert(null);
      }
    } else {
      const activeMembers = currentStation.members.filter(m => m.status !== 'finished' && !!m.endTime);
      if (activeMembers.length === 0) {
        setActiveEndAlert(null);
        return;
      }
      const allHaveTime = activeMembers.every(m => {
        const mEndTime = new Date(m.endTime!).getTime();
        return (mEndTime - now) > 0;
      });
      if (allHaveTime) {
        setActiveEndAlert(null);
      }
    }
  }, [activeStations, activeEndAlert]);

  const handleAcknowledge = () => {
    if (activeEndAlert) {
      router.push(`/dashboard?checkoutId=${activeEndAlert.station.id}`);
    }
    setActiveEndAlert(null);
  };

  const handleStartFinishing = async () => {
    if (activeEndAlert) {
      const stationId = activeEndAlert.station.id;
      const currentStation = stations?.find(s => s.id === stationId) || activeEndAlert.station;
      
      let endedTimeISO = new Date().toISOString();
      
      if (currentStation) {
        let endedTimeMs = 0;
        
        if (activeEndAlert.memberName !== "EVERYONE") {
          const member = currentStation.members.find(
            m => m.name === activeEndAlert.memberName && m.status !== 'finished'
          );
          if (member?.endTime) {
            endedTimeMs = new Date(member.endTime).getTime();
          }
        } else {
          const endedMembers = currentStation.members.filter(
            m => m.status !== 'finished' && m.endTime && new Date(m.endTime).getTime() <= Date.now()
          );
          if (endedMembers.length > 0) {
            endedTimeMs = Math.max(...endedMembers.map(m => new Date(m.endTime!).getTime()));
          }
        }
        
        if (!endedTimeMs && currentStation.endTime) {
          endedTimeMs = new Date(currentStation.endTime).getTime();
        }
        
        if (endedTimeMs && endedTimeMs <= Date.now()) {
          endedTimeISO = new Date(endedTimeMs).toISOString();
        }
      }

      await updateStation(stationId, {
        status: 'finishing',
        finishingStartTime: endedTimeISO
      });
      toast({ title: "Grace Period Started", description: "5 minutes wrap-up timer active." });
      setActiveEndAlert(null);
    }
  };

  const handleAddTime = () => {
    if (activeEndAlert) {
      router.push(`/dashboard?addTimeId=${activeEndAlert.station.id}`);
    }
    setActiveEndAlert(null);
  };

  const handleWarningAddTime = () => {
    if (activeWarningAlert) {
      router.push(`/dashboard?addTimeId=${activeWarningAlert.station.id}`);
    }
    setActiveWarningAlert(null);
  };

  const handleWarningAcknowledge = () => {
    setActiveWarningAlert(null);
  };

  return (
    <>
      <AlertDialog open={!!activeEndAlert} onOpenChange={(open) => !open && setActiveEndAlert(null)}>
        <AlertDialogContent className="border-4 border-destructive z-[10000] w-[95vw] max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-4xl text-destructive font-headline text-center animate-pulse uppercase tracking-tighter">Time is Up!</AlertDialogTitle>
            <Separator className="bg-destructive/20 my-4" />
            <AlertDialogDescription className="text-xl text-center pt-2 text-foreground font-medium">
              The gaming session for <span className="font-black text-2xl block mt-2 text-primary">{activeEndAlert?.memberName}</span> has ended.
              <br />
              <span className="font-semibold text-muted-foreground mt-4 block italic text-sm border bg-muted/50 p-2 rounded">Station: {activeEndAlert?.station.name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
            <Button 
              variant="outline"
              className="h-14 sm:h-16 font-bold text-sm lg:text-base uppercase border-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-sm whitespace-normal text-center leading-tight"
              onClick={handleAddTime}
            >
              <Clock className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Add Time
            </Button>
            <Button 
              variant="outline"
              className="h-14 sm:h-16 font-bold text-sm lg:text-base uppercase border-2 border-amber-500/50 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm whitespace-normal text-center leading-tight"
              onClick={handleStartFinishing}
            >
              <CheckCircle2 className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Finishing Game
            </Button>
            <Button 
              className="bg-destructive hover:bg-destructive/90 text-sm lg:text-base h-14 sm:h-16 font-bold shadow-lg whitespace-normal text-center leading-tight" 
              onClick={handleAcknowledge}
            >
              Acknowledge & Close
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!activeWarningAlert} onOpenChange={(open) => !open && setActiveWarningAlert(null)}>
        <AlertDialogContent className="border-4 border-amber-500 z-[10000] w-[95vw] max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-4xl text-amber-500 font-headline text-center animate-pulse uppercase tracking-tighter">5 Minutes Left!</AlertDialogTitle>
            <Separator className="bg-amber-500/20 my-4" />
            <AlertDialogDescription className="text-xl text-center pt-2 text-foreground font-medium">
              <span className="font-black text-2xl block mt-2 text-primary">{activeWarningAlert?.memberName}</span>
              <br />
              <span className="text-base block mt-1 text-muted-foreground">has <strong className="text-amber-600">5 minutes</strong> remaining at</span>
              <span className="font-semibold text-muted-foreground mt-3 block italic text-sm border bg-muted/50 p-2 rounded">Station: {activeWarningAlert?.station.name}</span>
              <span className="text-sm block mt-4 font-bold text-foreground/80 uppercase tracking-wide">Please ask the customer if they will be continuing or ending their session.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
            <Button 
              variant="outline"
              className="h-14 sm:h-16 font-bold text-sm lg:text-base uppercase border-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-sm whitespace-normal text-center leading-tight"
              onClick={handleWarningAddTime}
            >
              <Clock className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Add More Time
            </Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-white text-sm lg:text-base h-14 sm:h-16 font-bold shadow-lg whitespace-normal text-center leading-tight" 
              onClick={handleWarningAcknowledge}
            >
              <CheckCircle2 className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Acknowledged
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBreakOverAlert} onOpenChange={setShowBreakOverAlert}>
        <AlertDialogContent className="border-4 border-amber-500 z-[10000] w-[95vw] max-w-2xl font-body">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-4xl text-amber-500 font-headline text-center animate-pulse uppercase tracking-tighter">
              Break Time Over!
            </AlertDialogTitle>
            <Separator className="bg-amber-500/20 my-4" />
            <AlertDialogDescription className="text-xl text-center pt-2 text-foreground font-medium">
              The 1-hour break period has ended.
              <br />
              <span className="text-base block mt-2 text-muted-foreground">
                Please return to your station and resume operations.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex justify-center mt-6">
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-white text-sm lg:text-base h-14 sm:h-16 px-8 font-black uppercase tracking-widest shadow-lg" 
              onClick={handleAcknowledgeBreakOver}
            >
              Acknowledge & Reset
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        preload="auto"
        autoPlay={false}
      />
    </>
  );
}
