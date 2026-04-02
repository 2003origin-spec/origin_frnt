'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

import OriginAiMentor from '@/components/origin-ai/OriginAiMentor';

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (containerRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 z-50 flex flex-col items-end sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="origin-ai-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-2 h-[min(640px,calc(100vh-1rem))] w-[380px] max-w-[calc(100vw-1rem)] overflow-hidden sm:mb-3 sm:max-w-[calc(100vw-1.5rem)]"
          >
            <OriginAiMentor compact onClose={() => setIsOpen(false)} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isOpen ? (
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="relative outline-none"
          aria-label="Open Origin AI"
        >
          <div className="relative group">
            <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-2xl scale-0 transition-transform duration-500 group-hover:scale-150" />
            <div className="absolute inset-0 z-0 flex items-center justify-center text-blue-100">
              <Sparkles className="h-7 w-7" />
            </div>
            <img
              src="/Dipraj-ChatBot.png"
              alt="Origin AI"
              className="relative z-10 h-24 w-24 object-contain drop-shadow-2xl transition-all duration-300 group-hover:brightness-110 sm:h-28 sm:w-28"
              onError={(event) => {
                (event.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute right-4 top-4 z-20 h-4 w-4 rounded-full border-2 border-white bg-rose-500 shadow-md dark:border-slate-900" />
          </div>
        </motion.button>
      ) : null}
    </div>
  );
}
