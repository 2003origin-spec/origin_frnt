'use client';

import { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import TestConfigFields, { EMPTY_TEST_CONFIG, type TestConfigValue } from '@/components/test/TestConfigFields';

export type RoomTestConfigPayload = {
  subjects?: string[];
  chapters?: string[];
  class_levels?: number[];
  exams?: string[];
  difficulty: string;
  question_count: number;
};

export function TestConfigDrawer({
  disabled,
  onConfigure,
}: {
  disabled?: boolean;
  onConfigure: (payload: RoomTestConfigPayload) => Promise<void>;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === 'dark';

  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<TestConfigValue>(EMPTY_TEST_CONFIG);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setIsSubmitting(true);
    try {
      await onConfigure({
        // Empty arrays = "any / all / mixed" — mirror the Test Builder.
        subjects: config.subjects.length ? config.subjects : undefined,
        chapters: config.chapters.length ? config.chapters : undefined,
        class_levels: config.classLevels.length ? config.classLevels : undefined,
        exams: config.exams.length ? config.exams : undefined,
        // No user-facing difficulty filter (same as the builder) — "all".
        difficulty: 'all',
        question_count: config.question_count,
      });
      toast.success('Room test configured.');
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not configure test.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            isDark && 'bg-[#111520] border-[#1a2333] text-slate-300 hover:bg-[#161b28] hover:text-white hover:border-[#2bb1ff]/40',
          )}
        >
          <Settings2 className="h-4 w-4" />
          Configure Test
        </Button>
      </DrawerTrigger>
      <DrawerContent
        className={cn(
          isDark && 'bg-[#0a0d14] border-t-2 border-[#1a2333] shadow-[0_-8px_40px_rgba(43,177,255,0.12)]',
        )}
      >
        {/* Neon accent bar */}
        {isDark && (
          <div className="absolute top-0 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-transparent via-[#2bb1ff] to-transparent opacity-60 pointer-events-none" />
        )}
        <div className="mx-auto w-full max-w-xl max-h-[80vh] overflow-y-auto">
          <DrawerHeader>
            <div className="flex items-center gap-3">
              <span className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border flex-shrink-0',
                isDark ? 'bg-[#2bb1ff]/10 border-[#2bb1ff]/30' : 'bg-primary/10 border-transparent',
              )}>
                <Settings2 className={cn('h-4 w-4', isDark ? 'text-[#2bb1ff]' : 'text-primary')} />
              </span>
              <div>
                <DrawerTitle className={cn(
                  'text-lg font-black tracking-wide uppercase',
                  isDark ? 'text-white drop-shadow-[0_0_14px_rgba(43,177,255,0.4)]' : 'text-foreground',
                )}>
                  Configure Room Test
                </DrawerTitle>
                <DrawerDescription className={cn(isDark ? 'text-slate-500' : 'text-muted-foreground')}>
                  Generate one custom test for every active participant.
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <TestConfigFields value={config} onChange={setConfig} />
          </div>
          <DrawerFooter>
            <Button
              onClick={submit}
              disabled={isSubmitting}
              className={cn(
                'font-black uppercase tracking-wider',
                isDark && 'bg-gradient-to-r from-[#2bb1ff] to-[#006495] text-white border border-white/15 shadow-[0_0_22px_rgba(43,177,255,0.32)] hover:from-[#3bbbff] hover:to-[#0078b3] hover:shadow-[0_0_34px_rgba(43,177,255,0.5)]',
              )}
            >
              {isSubmitting ? 'Generating...' : 'Generate Test'}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
