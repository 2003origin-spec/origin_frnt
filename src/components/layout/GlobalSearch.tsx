'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Search,
  X,
  Command,
  FileText,
  MessageSquare,
  BookOpen,
  HelpCircle,
  ChevronRight,
  TrendingUp,
  User as UserIcon,
  ArrowRight,
  Loader2,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiCall } from '@/lib/api';
import type { ViewState } from '@/types';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

type SearchScope = 'all' | 'tests' | 'questions' | 'people' | 'ai';
type SearchResultType = 'test' | 'question' | 'person' | 'ai' | 'book' | 'nav';

interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  score: number;
}

const CATEGORIES: { id: SearchScope; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'tests', label: 'Tests', icon: FileText },
  { id: 'questions', label: 'Questions', icon: HelpCircle },
  { id: 'people', label: 'People', icon: UserIcon },
  { id: 'ai', label: 'AI Hub', icon: MessageSquare },
];

const TYPE_ICON: Record<SearchResultType, React.ComponentType<{ className?: string }>> = {
  test: FileText,
  question: HelpCircle,
  person: UserIcon,
  ai: MessageSquare,
  book: BookOpen,
  nav: Compass,
};

const DEBOUNCE_MS = 200;

export default function GlobalSearch({ isOpen, onClose, currentView, onNavigate }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchScope>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against out-of-order responses: only the latest request may commit.
  const requestSeq = useRef(0);

  // Default category based on the current view + autofocus on open.
  useEffect(() => {
    if (!isOpen) return;
    if (currentView === 'test-list' || currentView === 'test-interface') setActiveCategory('tests');
    else if (currentView === 'doubt-solver') setActiveCategory('ai');
    else setActiveCategory('all');
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [isOpen, currentView]);

  // Debounced fetch against the universal search endpoint.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed, scope: activeCategory });
        const data = await apiCall(`/users/search/?${params.toString()}`, { silentAuth: true });
        if (seq !== requestSeq.current) return; // a newer request superseded this one
        setResults(Array.isArray(data?.results) ? (data.results as SearchResult[]) : []);
      } catch {
        if (seq === requestSeq.current) setResults([]);
      } finally {
        if (seq === requestSeq.current) setIsLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, activeCategory]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleSelect = (result: SearchResult) => {
    onClose();
    router.push(result.href);
  };

  // Keyboard shortcuts.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (results.length || 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + (results.length || 1)) % (results.length || 1));
      }
      if (e.key === 'Enter' && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const hasQuery = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/20 dark:bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="relative w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground mr-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tests, questions, people…"
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-lg"
          />
          <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
            <span className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] text-muted-foreground font-medium">
              <Command className="w-3 h-3" /> K
            </span>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-1 px-4 py-2 bg-muted/30 border-b border-border overflow-x-auto">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
          {!hasQuery ? (
            <EmptyState onNavigate={onNavigate} onPick={setQuery} />
          ) : isLoading && results.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Searching…</p>
            </div>
          ) : results.length > 0 ? (
            <div className="p-3 space-y-1.5">
              {results.map((result, idx) => {
                const Icon = TYPE_ICON[result.type] ?? Search;
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left group border',
                      isSelected
                        ? 'bg-primary border-primary shadow-md shadow-primary/20'
                        : 'bg-background border-border/50 hover:border-primary/30 hover:bg-primary/5'
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors border',
                        isSelected ? 'bg-white/20 border-white/20 text-white' : 'bg-primary/5 border-primary/20 text-primary'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-bold truncate leading-tight mb-0.5', isSelected ? 'text-white' : 'text-foreground')}>
                        {result.title}
                      </p>
                      <p className={cn('text-[10px] truncate', isSelected ? 'text-white/70' : 'text-muted-foreground')}>
                        {result.subtitle}
                      </p>
                    </div>
                    <ArrowRight
                      className={cn(
                        'w-4 h-4 transition-all',
                        isSelected
                          ? 'text-white opacity-100'
                          : 'text-muted-foreground/30 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                      )}
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">No results for &ldquo;{query}&rdquo;</h3>
              <p className="text-sm text-muted-foreground">Try a different term or category.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-[10px] font-bold text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 rotate-90" /> Select</span>
            <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> Open</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-1 py-0.5 rounded border border-border">ESC</span>
            <span>to close</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function EmptyState({ onNavigate, onPick }: { onNavigate: (view: ViewState) => void; onPick: (q: string) => void }) {
  return (
    <div className="py-4 px-3 space-y-3">
      <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" />
          Popular Searches
        </h3>
        <div className="flex flex-wrap gap-2">
          {['JEE Main', 'Circular Motion', 'Doubt Solver', 'NCERT Physics', 'Leaderboard'].map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="px-3 py-1.5 rounded-full bg-background border border-border text-xs font-bold text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-1.5"
            >
              <TrendingUp className="w-2.5 h-2.5" />
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3" />
          Quick Navigation
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'My Dashboard', icon: UserIcon, view: 'dashboard' },
            { label: 'Physics Hub', icon: FileText, view: 'test-list' },
            { label: 'NCERT Library', icon: BookOpen, view: 'study-corner' },
            { label: 'AI Study Mentor', icon: MessageSquare, view: 'doubt-solver' },
          ].map((nav) => (
            <button
              key={nav.label}
              onClick={() => onNavigate(nav.view as ViewState)}
              className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-background hover:border-primary/30 hover:bg-primary/5 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                <nav.icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{nav.label}</span>
              <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
