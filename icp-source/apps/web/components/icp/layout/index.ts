/**
 * apps/web/components/icp/layout/index.ts
 *
 * Slice:    S-01 UI Foundation
 * Task:     T03 Layout Primitives — barrel export
 *
 * Consumer pattern (unified import):
 *   import { PhoneFrame, MainScroll, BottomBar, TopBar, AppHeader }
 *     from '@/components/icp/layout';
 *
 * Note: PhoneFrame lives at `components/icp/PhoneFrame.tsx` (root) per D-01
 *   convention (S-00b T08 emitted there; T03 REWRITE preserved path). This
 *   barrel re-exports it so consumers have a single import source for all
 *   layout primitives.
 */

// Re-export PhoneFrame from sibling (not in layout/ subfolder per D-01 lock)
export { PhoneFrame, type PhoneFrameProps } from '../PhoneFrame';

// 4 layout sub-components
export { MainScroll, type MainScrollProps } from './MainScroll';
export { BottomBar, type BottomBarProps } from './BottomBar';
export { TopBar, type TopBarProps } from './TopBar';
export { AppHeader, type AppHeaderProps } from './AppHeader';

// T03b Dashboard hub (S-03 Phiên 36) — decorative 4-tab bottom nav per D-13 + C-24
export { HomeBottomNav, type HomeBottomNavProps } from './HomeBottomNav';
