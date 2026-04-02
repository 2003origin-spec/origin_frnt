'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X } from 'lucide-react';

import OriginAiMentor from '@/components/origin-ai/OriginAiMentor';

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="origin-ai-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 h-[620px] w-[380px] max-w-[calc(100vw-2rem)]"
          >
            <OriginAiMentor compact onClose={() => setIsOpen(false)} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen((current) => !current)}
        className="relative outline-none"
        aria-label={isOpen ? 'Close Origin AI' : 'Open Origin AI'}
      >
        {isOpen ? (
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-white shadow-lg shadow-black/20">
            <X className="h-6 w-6" />
          </div>
        ) : (
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-blue-500/25 blur-2xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-blue-400/30 bg-[#081223] text-blue-100 shadow-[0_20px_50px_rgba(37,99,235,0.25)]">
              <Bot className="h-7 w-7" />
            </div>
            <div className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-[#081223] bg-rose-500" />
          </div>
        )}
      </motion.button>
    </div>
  );
}
