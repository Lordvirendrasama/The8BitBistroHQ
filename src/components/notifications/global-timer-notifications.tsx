
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

/**
 * Universal Voice Announcer Engine
 */

const audioQueue: string[] = [];
let isProcessingQueue = false;

async function processQueue(audioRef: React.RefObject<HTMLAudioElement | null>) {
  if (isProcessingQueue || audioQueue.length === 0 || !audioRef?.current) return;
  
  isProcessingQueue = true;
  const text = audioQueue.shift()!;

  const fallbackSpeech = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Premium')) || 
                             voices.find(v => v.lang.startsWith('en')) || 
                             voices[0];
      
      if (preferredVoice) utterance.voice = preferredVoice;
      
      utterance.onend = () => {
        isProcessingQueue = false;
        processQueue(audioRef);
      };

      setTimeout(() => {
        if (isProcessingQueue) {
            isProcessingQueue = false;
            processQueue(audioRef);
        }
      }, 8000);

      window.speechSynthesis.speak(utterance);
    } else {
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

export async function announceGlobally(text: string, audioRef?: React.RefObject<HTMLAudioElement | null>) {
  if (typeof window === 'undefined') return;
  audioQueue.push(text);
  if (audioRef) {
    processQueue(audioRef);
  }
}

export function GlobalTimerNotifications() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  
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

  const unlockAudio = useCallback(() => {
    if (isUnlocked.current) return;
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const context = new AudioContext();
      if (context.state === 'suspended') context.resume();
    }
    if (audioRef.current && !isProcessingQueue) {
      audioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
      audioRef.current.play().then(() => { isUnlocked.current = true; }).catch(() => {});
    } else {
      isUnlocked.current = true;
    }
  }, []);

  useEffect(() => {
    const handleInteraction = () => unlockAudio();
    window.addEventListener('mousedown', handleInteraction, { passive: true });
    window.addEventListener('keydown', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    return () => {
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
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
        // (Only check players who aren't already in the "endCandidates" list)
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
            // Group warning for multiple players
            warningCandidates.forEach(m => announcedWarnings.current.add(`${station.id}-${m.id}-5min`));
            playAnnouncement(`Attention. Five minutes remaining for everyone at ${station.name}.`);
            toast({ title: "Session Warning", description: `5 minutes left at ${station.name}` });
        } else if (warningCandidates.length === 1) {
            // Individual warning for single player
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

  return (
    <>
      <AlertDialog open={!!activeEndAlert} onOpenChange={(open) => !open && setActiveEndAlert(null)}>
        <AlertDialogContent className="border-4 border-destructive z-[10000] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-4xl text-destructive font-headline text-center animate-pulse uppercase tracking-tighter">Time is Up!</AlertDialogTitle>
            <Separator className="bg-destructive/20 my-4" />
            <AlertDialogDescription className="text-xl text-center pt-2 text-foreground font-medium">
              The gaming session for <span className="font-black text-2xl block mt-2 text-primary">{activeEndAlert?.memberName}</span> has ended.
              <br />
              <span className="font-semibold text-muted-foreground mt-4 block italic text-sm border bg-muted/50 p-2 rounded">Station: {activeEndAlert?.station.name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction 
            className="bg-destructive hover:bg-destructive/90 text-xl h-16 font-bold mt-6 shadow-lg" 
            onClick={handleAcknowledge}
          >
            Acknowledge & Close
          </AlertDialogAction>
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
