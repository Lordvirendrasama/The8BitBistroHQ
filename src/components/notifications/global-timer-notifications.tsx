
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
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

async function processQueue(audioRef: React.RefObject<HTMLAudioElement | null>) {
  if (isProcessingQueue || audioQueue.length === 0 || !audioRef?.current) return;
  
  isProcessingQueue = true;
  const text = audioQueue.shift()!;

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

  useEffect(() => {
    globalToast = toast;
  }, [toast]);

  const announcedWarnings = useRef<Set<string>>(new Set());
  const announcedEnds = useRef<Set<string>>(new Set());
  const processedAnnouncements = useRef<Set<string>>(new Set());
  const [activeEndAlert, setActiveEndAlert] = useState<{ station: Station, memberName: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isUnlocked = useRef(false);
  const sessionStartTime = useRef(new Date().toISOString());

  const stationsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'stations'), where('status', 'in', ['in-use', 'paused']));
  }, [db]);
  const { data: activeStations } = useCollection<Station>(stationsQuery);

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
        } else if (endCandidates.length === 1) {
            // Individual announcement for single player
            const m = endCandidates[0];
            announcedEnds.current.add(`${station.id}-${m.id}-ended`);
            playAnnouncement(`Time is up for ${m.name} at ${station.name}.`);
            setActiveEndAlert({ station, memberName: m.name });
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
            playAnnouncement(`Attention. Five minutes remaining for everyone at ${station.name}.`);
            toast({ title: "Session Warning", description: `5 minutes left at ${station.name}` });
        } else if (warningCandidates.length === 1) {
            const m = warningCandidates[0];
            announcedWarnings.current.add(`${station.id}-${m.id}-5min`);
            playAnnouncement(`Attention. Five minutes remaining for ${m.name} at ${station.name}.`);
            toast({ title: "Player Warning", description: `5 minutes left for ${m.name}` });
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [activeStations, playAnnouncement, toast]);

  const handleAcknowledge = () => {
    if (activeEndAlert) {
      router.push(`/dashboard?checkoutId=${activeEndAlert.station.id}`);
    }
    setActiveEndAlert(null);
  };

  const handleStartFinishing = async () => {
    if (activeEndAlert) {
      await updateStation(activeEndAlert.station.id, {
        status: 'finishing',
        finishingStartTime: new Date().toISOString()
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

      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        preload="auto"
        autoPlay={false}
      />
    </>
  );
}
