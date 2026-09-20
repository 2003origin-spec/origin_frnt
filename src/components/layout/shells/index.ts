/**
 * Mobile layout shells — Stage 5 of V1/MOBILE_DESIGN_OVERHAUL_PLAN.md.
 *
 * Each encodes a rule from MOBILE_UX_RESEARCH_FINDINGS.md so a screen cannot
 * re-break it: safe-area and nav offsets (PageShell), sticky-header inset
 * (PageHeader), overflow you can see (FilterBar), an exit from every dead end
 * (StateBlock), one unambiguous action (EntityCard), no room for decoration
 * over data (StatGrid).
 */
export { PageShell } from './PageShell';
export { PageHeader } from './PageHeader';
export { FilterBar, type FilterOption } from './FilterBar';
export { EmptyState, ErrorState, LoadingState } from './StateBlock';
export { EntityCard, type Stat } from './EntityCard';
export { StatGrid } from './StatGrid';
