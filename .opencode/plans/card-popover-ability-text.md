# Card Action Popover — Add Ability Text

## Goal
Show the card's `abilityText` in the inline action popover, displayed to the right of the action buttons.

## Current State
The popover in `packages/client/src/components/cards/CardComponent.tsx` (lines 275-358) currently shows:
- Card name header (truncated)
- Action buttons (if provided)
- Generic counter row (if instance present)
- "View card" link

The popover is `min-w-[140px]` and stacks everything vertically.

## Change: `packages/client/src/components/cards/CardComponent.tsx`

### 1. Popover container width
When `card.abilityText` exists, widen the popover:
```
className={`... min-w-[140px] ${card.abilityText ? 'w-[260px]' : ''}`}
```

### 2. Popover padding
Increase from `p-1.5` to `p-2` to give the wider popover room.

### 3. Two-column layout
Wrap the content in a flex row:
```jsx
<div className="flex gap-2">
  {/* Left column — actions & controls */}
  <div className="flex flex-col gap-0.5 min-w-0">
    {action buttons}
    {counter row}
    {view card link}
  </div>

  {/* Right column — ability text */}
  {card.abilityText && (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-fs-parchment/30 mb-0.5">Ability</div>
      <div className="text-xs text-fs-parchment/60 leading-relaxed whitespace-pre-line max-h-[160px] overflow-y-auto">
        {card.abilityText}
      </div>
    </div>
  )}
</div>
```

## Details
- **Left column**: Unchanged — action buttons, counter row (add/remove generic counters), "View card" link
- **Right column**: Only shown when `card.abilityText` is non-empty
- **Ability text**: 
  - Label "ABILITY" in tiny uppercase at 30% opacity
  - Body text at `text-xs` (12px) in 60% opacity — lighter than the card modal (90%) since it's secondary info
  - `whitespace-pre-line` to preserve line breaks from card data
  - `max-h-[160px]` with `overflow-y-auto` scrolls if text exceeds ~10 lines
  - `scrollbar-thin` uses Tailwind's scrollbar plugin (already in project)
- **No ability text**: Popover stays the original narrow single-column layout

## Verification
- `npm run build --workspace=packages/client` — must pass
- Test on a card with ability text (e.g., "A Penny!" treasure) — popover should show text on right
- Test on a card without ability text — popover should be unchanged
