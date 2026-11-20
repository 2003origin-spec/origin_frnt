// Origin addition (not from the Glassy UI registry): the TypeScript DOM lib in
// this project has no ViewTimeline yet. use-refraction-filter.tsx feature-checks
// it at runtime (`typeof ViewTimeline !== 'undefined'`), so this is types only.
declare class ViewTimeline extends AnimationTimeline {
  constructor(options?: {
    subject?: Element;
    axis?: 'block' | 'inline' | 'x' | 'y';
    inset?: string;
  });
  readonly source: Element | null;
  readonly subject: Element | null;
  readonly startOffset: CSSNumericValue;
  readonly endOffset: CSSNumericValue;
}
