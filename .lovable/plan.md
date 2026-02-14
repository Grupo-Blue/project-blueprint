

## Fix: Modal Content Overflow in Campaign Details

### Problem
The creative ranking cards inside the campaign dialog are overflowing horizontally. The funnel bars, metrics grid, and text content extend beyond the modal boundaries, causing a lateral scroll.

### Root Cause
The flex layout in `CriativoRankingCard.tsx` does not properly constrain the main content area. The inner `div` with `flex-1` needs `min-w-0` to allow it to shrink within the flex container. Without this, the funnel progress bars and metrics push beyond the available width.

### Changes

**File: `src/components/campanhas/CriativoRankingCard.tsx`**
- Add `min-w-0` to the main content `div` (the one with `flex-1`) so flex children can shrink properly
- This single change should prevent the horizontal overflow since the funnel bars and text will now respect the container width

**File: `src/components/campanhas/CampanhaSuperTrunfo.tsx`**
- Add `overflow-hidden` to the `CriativosDetalhe` wrapper to act as a safety net against any remaining overflow

These are minimal, targeted CSS fixes that address the root cause (flex items not shrinking) rather than hiding symptoms.

