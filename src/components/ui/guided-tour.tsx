'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TourStep {
  selector?: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  steps: TourStep[];
}

export function GuidedTour({ isOpen, onClose, steps }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setHighlightRect(null);
      setTooltipPos(null);
      return;
    }

    const step = steps[currentStep];
    if (!step) return;

    const updatePosition = () => {
      let rect: DOMRect | null = null;
      
      if (step.selector) {
        const element = document.querySelector(step.selector);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          rect = element.getBoundingClientRect();
          setHighlightRect(rect);
        } else {
          setHighlightRect(null);
        }
      } else {
        setHighlightRect(null);
      }

      // Calculate tooltip position
      const tooltipWidth = 320;
      const padding = 16;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = 0;
      let left = 0;

      if (rect) {
        const pos = step.position || 'bottom';
        if (pos === 'bottom') {
          top = rect.bottom + padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
        } else if (pos === 'top') {
          top = rect.top - 200 - padding; // estimate height
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
        } else if (pos === 'left') {
          top = rect.top + rect.height / 2 - 100;
          left = rect.left - tooltipWidth - padding;
        } else if (pos === 'right') {
          top = rect.top + rect.height / 2 - 100;
          left = rect.right + padding;
        } else {
          top = viewportHeight / 2 - 100;
          left = viewportWidth / 2 - tooltipWidth / 2;
        }
      } else {
        // center
        top = viewportHeight / 2 - 100;
        left = viewportWidth / 2 - tooltipWidth / 2;
      }

      // viewport boundary collision protection
      if (left < padding) left = padding;
      if (left + tooltipWidth > viewportWidth - padding) {
        left = viewportWidth - tooltipWidth - padding;
      }
      if (top < padding) top = padding;

      setTooltipPos({ top, left });
    };

    // Wait a brief tick for scrolling/rendering to settle before measuring
    const timer = setTimeout(updatePosition, 300);
    
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isOpen, currentStep, steps]);

  if (!isOpen) return null;

  const activeStep = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Dimmed cutout overlay backdrop */}
      {highlightRect && (
        <div
          className="fixed z-40 pointer-events-none rounded-xl border-[3px] border-primary shadow-[0_0_15px_rgba(236,72,153,0.5)] transition-all duration-300 ease-out"
          style={{
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
          }}
        />
      )}

      {!highlightRect && (
        <div 
          className="fixed inset-0 bg-black/75 z-40 transition-opacity pointer-events-auto" 
          onClick={onClose}
        />
      )}

      {/* Floating tooltip guide card */}
      {tooltipPos && (
        <div
          className="fixed z-50 p-5 bg-card border-2 border-primary/50 shadow-2xl rounded-xl w-[320px] flex flex-col gap-3 font-body transition-all duration-300 ease-out animate-in fade-in zoom-in-95 pointer-events-auto"
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
          }}
        >
          <div className="flex flex-col gap-1">
            <h4 className="font-headline text-sm uppercase tracking-wider text-primary">
              {activeStep.title}
            </h4>
            <p className="text-xs text-muted-foreground font-bold uppercase leading-relaxed mt-1">
              {activeStep.description}
            </p>
          </div>

          <div className="space-y-3 mt-1">
            {/* Steps progress indicator dots */}
            <div className="flex justify-center gap-1.5 items-center">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    idx === currentStep ? "w-6 bg-primary" : "w-2 bg-primary/20"
                  )}
                />
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-dashed border-muted-foreground/30 pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="font-bold uppercase text-[10px] h-8 px-2 hover:bg-muted/10"
              >
                Skip Tour
              </Button>
              <div className="flex gap-1.5">
                {currentStep > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    className="font-bold uppercase text-[10px] h-8 px-2"
                  >
                    Back
                  </Button>
                )}
                {currentStep < steps.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    className="font-bold uppercase text-[10px] h-8 px-3 shadow"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={onClose}
                    className="font-bold uppercase text-[10px] h-8 px-3 shadow bg-emerald-600 hover:bg-emerald-600/90 text-white"
                  >
                    Finish
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
