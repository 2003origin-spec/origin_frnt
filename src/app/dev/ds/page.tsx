'use client';

/**
 * DEV-ONLY design-system gallery — /dev/ds
 *
 * Every primitive the mobile app actually uses, in every state, on one scroll.
 * The point is to judge the OLED Material token layer on a real phone BEFORE
 * any student screen is rewritten: if a token is wrong, it is wrong here first
 * and costs one file to fix instead of seventy-seven.
 *
 * Renders on semantic tokens only — no literal colours anywhere in this file.
 * See V1/DESIGN_LANGUAGE.md and design/tokens/origin.tokens.json.
 */
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  EmptyState, EntityCard, ErrorState, FilterBar, LoadingState, StatGrid,
} from '@/components/layout/shells';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <div>
        <h2 className="font-display text-xl font-bold leading-none text-foreground">{title}</h2>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </section>
  );
}

const SURFACES = [
  ['background', 'bg-background'],
  ['surface-1 / card', 'bg-[hsl(var(--surface-1))]'],
  ['surface-2', 'bg-[hsl(var(--surface-2))]'],
  ['surface-3', 'bg-[hsl(var(--surface-3))]'],
] as const;

const TEXT = [
  ['foreground', 'text-foreground'],
  ['muted-foreground', 'text-muted-foreground'],
  ['primary', 'text-primary'],
  ['destructive', 'text-destructive'],
] as const;

export default function DesignSystemGallery() {
  const { theme, setTheme } = useTheme();
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  // next-themes resolves nothing on the server, so the label must not be
  // rendered until mount or SSR and client disagree. Same guard as
  // components/ui/ThemeToggle.tsx.
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState('all');
  useEffect(() => setMounted(true), []);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-24 pt-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-extrabold leading-none tracking-tight text-foreground">
            Design system
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            OLED Material · dev-only · every primitive, every state
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {mounted ? (theme === 'dark' ? 'Light' : 'Dark') : 'Theme'}
        </Button>
      </header>

      <Section title="Surfaces" hint="Elevation is tonal, never a shadow. This is what keeps true black true on OLED.">
        <div className="grid w-full grid-cols-2 gap-2">
          {SURFACES.map(([name, cls]) => (
            <div key={name} className={`flex min-h-16 flex-col justify-end rounded-lg border border-border p-3 ${cls}`}>
              <span className="text-xs text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Text" hint="Every pair below passes WCAG 2.2 AA — the token build refuses to emit a palette that doesn't.">
        <div className="flex w-full flex-col gap-1">
          {TEXT.map(([name, cls]) => (
            <p key={name} className={`text-sm ${cls}`}>
              {name} — the quick brown fox jumps over the lazy dog
            </p>
          ))}
        </div>
      </Section>

      <Section title="Type scale" hint="Darker Grotesque for display and numerals; Inter for everything functional.">
        <div className="flex w-full flex-col gap-1">
          <p className="font-display text-[34px] font-extrabold leading-none text-foreground">Display 34</p>
          <p className="font-display text-[27px] font-bold leading-tight text-foreground">Display 27</p>
          <p className="font-display text-[21px] font-bold leading-tight text-foreground">Title 21</p>
          <p className="text-[17px] font-semibold text-foreground">Subtitle 17</p>
          <p className="text-sm text-foreground">Body 14 — used for most reading text in the app.</p>
          <p className="text-xs text-muted-foreground">Label 12 · Caption 11</p>
        </div>
      </Section>

      <Section title="Buttons" hint="Primary actions are pill-shaped (M3 Expressive). Press feedback is a state layer, not a shadow.">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="Legacy .neu-* classes" hint="878 call sites across 120 files still use these names. The names survive; the neumorphism does not — they now resolve to tonal surfaces.">
        <div className="grid w-full grid-cols-2 gap-2">
          <div className="neu-raised p-3 text-xs text-muted-foreground">.neu-raised</div>
          <div className="neu-inset p-3 text-xs text-muted-foreground">.neu-inset</div>
          <div className="neu-chip p-3 text-xs text-muted-foreground">.neu-chip</div>
          <div className="neu-field p-3 text-xs text-muted-foreground">.neu-field</div>
        </div>
        <div className="neu-segmented flex w-full gap-1 p-1">
          <button className="neu-segmented__item flex-1 py-2 text-xs" data-active="true">JEE</button>
          <button className="neu-segmented__item flex-1 py-2 text-xs">NEET</button>
          <button className="neu-segmented__item flex-1 py-2 text-xs">PCMB</button>
        </div>
      </Section>

      <Section title="Badges">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Locked</Badge>
      </Section>

      <Section title="Form controls" hint="Touch targets ≥ 48px. Focus rings must be visible on both grounds.">
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ds-email">Email</Label>
            <Input id="ds-email" placeholder="you@example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ds-err">With error</Label>
            <Input id="ds-err" aria-invalid defaultValue="not-an-email" />
            <span className="text-xs text-destructive">Enter a valid email address.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ds-note">Textarea</Label>
            <Textarea id="ds-note" placeholder="Ask Ori anything…" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ds-cb" checked={checked} onCheckedChange={(v) => setChecked(Boolean(v))} />
            <Label htmlFor="ds-cb">Remember me</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ds-sw" checked={on} onCheckedChange={setOn} />
            <Label htmlFor="ds-sw">Sound effects</Label>
          </div>
          <RadioGroup defaultValue="a" className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="a" id="ds-r1" /><Label htmlFor="ds-r1">Option A</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="b" id="ds-r2" /><Label htmlFor="ds-r2">Option B</Label>
            </div>
          </RadioGroup>
          <Slider defaultValue={[60]} max={100} step={1} />
        </div>
      </Section>

      <Section title="Feedback">
        <div className="flex w-full flex-col gap-3">
          <Progress value={38} />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="mock">Mock</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="pt-3 text-sm text-muted-foreground">All tests.</TabsContent>
          <TabsContent value="daily" className="pt-3 text-sm text-muted-foreground">Daily practice.</TabsContent>
          <TabsContent value="mock" className="pt-3 text-sm text-muted-foreground">Full-length mocks.</TabsContent>
        </Tabs>
      </Section>

      <Section title="Card" hint="The pattern the audit rated best in the app — title, one-line description, labelled stats, one unambiguous action.">
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Free</Badge>
              <Badge variant="outline">6 sections</Badge>
            </div>
            <CardTitle className="font-display text-2xl">JEE Main</CardTitle>
            <CardDescription>Full paper across Physics, Chemistry and Mathematics.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-5">
              {[['75', 'questions'], ['300', 'marks'], ['180', 'minutes']].map(([v, l]) => (
                <div key={l} className="flex flex-col">
                  <span className="font-display text-xl font-bold leading-none text-foreground">{v}</span>
                  <span className="text-[11px] text-muted-foreground">{l}</span>
                </div>
              ))}
            </div>
            <Button className="w-full">Start mock</Button>
          </CardContent>
        </Card>
      </Section>

      <Section title="Shell · FilterBar" hint="One scrolling row, never a wrapping tab bar — a wrapped second row hides the fact that it exists.">
        <FilterBar
          className="w-full"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: 42 },
            { value: 'daily', label: 'Daily', count: 7 },
            { value: 'mock', label: 'Mock', count: 12 },
            { value: 'pyq', label: 'Previous years', count: 18 },
            { value: 'mine', label: 'Mine', count: 5 },
          ]}
        />
      </Section>

      <Section title="Shell · StatGrid" hint="No slot for decoration — the audit found Ori rendered inside all four dashboard tiles at once, covering the values.">
        <StatGrid
          className="w-full"
          stats={[
            { value: 0, label: 'Questions solved' },
            { value: 1, label: 'Day streak' },
            { value: 'Novice', label: 'Current rank' },
            { value: '7m', label: 'Studied today' },
          ]}
        />
      </Section>

      <Section title="Shell · EntityCard" hint="Extracted from the JEE Main card — the best-designed element already in the app. One unambiguous action, by design.">
        <EntityCard
          className="w-full"
          title="JEE Main"
          description="Full paper across Physics, Chemistry and Mathematics."
          chips={<><Badge variant="secondary">Free</Badge><Badge variant="outline">6 sections</Badge></>}
          stats={[
            { value: 75, label: 'questions' },
            { value: 300, label: 'marks' },
            { value: 180, label: 'minutes' },
          ]}
          action={{ label: 'Start mock' }}
        />
      </Section>

      <Section title="Shell · States" hint="`action` is REQUIRED on empty and error — the type system refuses a dead end.">
        <div className="flex w-full flex-col gap-3">
          <EmptyState
            title="No practice sets yet"
            description="Finish a test and we'll build practice sets from the questions you got wrong."
            action={{ label: 'Take a test' }}
          />
          <ErrorState action={{ label: 'Try again', onClick: () => {} }} />
          <LoadingState rows={1} />
        </div>
      </Section>
    </main>
  );
}
