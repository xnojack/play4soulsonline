import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'fs_tutorial_seen';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetAttr: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'hand',
    title: 'Your Hand',
    description: 'These are your loot cards. Drag them to the stack to play them, or use the card actions.',
    targetAttr: 'data-zone="my-hand"',
  },
  {
    id: 'stack',
    title: 'The Stack',
    description: 'Cards and abilities resolve here. When all players pass, the top item resolves.',
    targetAttr: 'data-zone="the-stack"',
  },
  {
    id: 'monsters',
    title: 'Monsters',
    description: 'Attack monsters to defeat them. Drag your character card to a monster to attack.',
    targetAttr: 'data-zone^="monster-"',
  },
  {
    id: 'shop',
    title: 'Shop',
    description: 'Buy cards from the shop using coins. Click the Buy button to purchase.',
    targetAttr: 'data-zone^="shop-"',
  },
  {
    id: 'priority',
    title: 'Priority',
    description: 'When you have priority, you can play cards or pass. Pass to move to the next player.',
    targetAttr: 'data-tutorial="priority"',
  },
];

function findTargetElement(attr: string): HTMLElement | null {
  if (attr.includes('^=')) {
    const selector = attr.split('^=')[0];
    const attrName = selector.replace('data-zone', 'data-zone');
    return document.querySelector(`[data-zone^="${attr.split('^=')[1].replace(/"/g, '')}"]`) as HTMLElement | null;
  }
  return document.querySelector(`[${attr}]`) as HTMLElement | null;
}

export function TutorialOverlay() {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (!hasSeen) {
      setVisible(true);
    }
  }, []);

  const updateSpotlight = useCallback(() => {
    const step = TUTORIAL_STEPS[currentStep];
    if (!step) {
      setSpotlight(null);
      return;
    }
    const el = findTargetElement(step.targetAttr);
    if (!el) {
      setSpotlight(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const padding = 20;
    setSpotlight({
      x: Math.max(0, rect.left - padding),
      y: Math.max(0, rect.top - padding),
      w: Math.min(rect.width + padding * 2, window.innerWidth - Math.max(0, rect.left - padding)),
      h: Math.min(rect.height + padding * 2, window.innerHeight - Math.max(0, rect.top - padding)),
    });
  }, [currentStep]);

  useEffect(() => {
    if (!visible) return;
    updateSpotlight();
    const handleResize = () => updateSpotlight();
    window.addEventListener('resize', handleResize);
    const observer = new MutationObserver(() => updateSpotlight());
    observer.observe(document.body, { attributes: true, subtree: true, childList: true });
    animFrameRef.current = requestAnimationFrame(() => updateSpotlight());
    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [visible, currentStep, updateSpotlight]);

  const nextStep = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      completeTutorial();
    }
  };

  const completeTutorial = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  const step = TUTORIAL_STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Dark overlay with spotlight cutout */}
      <div
        className="absolute inset-0 bg-black/60 transition-all duration-300"
        style={
          spotlight
            ? {
                  maskImage: `radial-gradient(circle at ${spotlight.x + spotlight.w / 2}px ${spotlight.y + spotlight.h / 2}px, transparent 0%, transparent ${Math.max(spotlight.w, spotlight.h) / 2}px, black ${Math.max(spotlight.w, spotlight.h) / 2 + 1}px)`,
                  WebkitMaskImage: `radial-gradient(circle at ${spotlight.x + spotlight.w / 2}px ${spotlight.y + spotlight.h / 2}px, transparent 0%, transparent ${Math.max(spotlight.w, spotlight.h) / 2}px, black ${Math.max(spotlight.w, spotlight.h) / 2 + 1}px)`,
                }
            : undefined
        }
        onClick={nextStep}
      />

      {/* Spotlight border glow */}
      {spotlight && (
        <div
          className="absolute pointer-events-none border-2 border-fs-gold/60 rounded-lg shadow-lg shadow-fs-gold/20"
          style={{
            left: spotlight.x,
            top: spotlight.y,
            width: spotlight.w,
            height: spotlight.h,
          }}
        />
      )}

      {/* Tutorial panel */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-md px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-fs-dark border border-fs-gold/40 rounded-lg p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-display text-fs-gold font-bold text-lg">{step.title}</h3>
              <span className="text-xs text-fs-parchment/40 flex-shrink-0 ml-2">
                {currentStep + 1} / {TUTORIAL_STEPS.length}
              </span>
            </div>
            <p className="text-fs-parchment/70 text-sm mb-4 leading-relaxed">{step.description}</p>
            <div className="flex justify-between items-center">
              <button
                onClick={completeTutorial}
                className="text-xs text-fs-parchment/40 hover:text-fs-parchment transition-colors"
              >
                Skip tutorial
              </button>
              <button
                onClick={nextStep}
                className="px-4 py-1.5 bg-fs-gold text-fs-dark rounded text-sm font-display font-bold hover:bg-fs-gold/80 transition-colors"
              >
                {currentStep === TUTORIAL_STEPS.length - 1 ? 'Got it!' : 'Next'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
