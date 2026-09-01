---
name: animate-ui-sliding-number
description: Implements smooth mechanical counter and sliding number animations using Animate UI's SlidingNumber component, React 19, Tailwind CSS, and Motion. Use when asked to create animated counters, ticker numbers, stats counters, dashboard KPI numbers, or rolling price digits.
---

# Animate UI - Sliding Number Skill

## Overview
`SlidingNumber` is an animated numeric display component that vertically rolls individual digits like a physical mechanical counter/odometer when numbers change or when scrolling into view.

## Dependencies
- `motion` (`motion/react`)
- `react-use-measure`

Component location:
- [sliding-number.tsx](file:///c:/Users/ntutuser-2256/Documents/110360231Jeffrey%20Chen/Antigravity/FYCD-HD-MANAGER/src/components/animate-ui/primitives/texts/sliding-number.tsx)
- [use-is-in-view.ts](file:///c:/Users/ntutuser-2256/Documents/110360231Jeffrey%20Chen/Antigravity/FYCD-HD-MANAGER/src/hooks/use-is-in-view.ts)

## Props Reference

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `number` | `number` | **(Required)** | The target number to display and animate to. |
| `fromNumber` | `number` | `undefined` | Starting number for initial mount animation. |
| `decimalPlaces` | `number` | `0` | Number of decimal places to format. |
| `decimalSeparator` | `string` | `'.'` | Character for decimal point (e.g. `.` or `,`). |
| `thousandSeparator` | `string` | `undefined` | Separator for thousands (e.g. `,` or `' '`). |
| `padStart` | `boolean` | `false` | Pad integer with leading zeros (e.g. `09` instead of `9`). |
| `inView` | `boolean` | `false` | Trigger animation when scrolled into viewport. |
| `inViewOnce` | `boolean` | `true` | Animate only once when entering viewport. |
| `inViewMargin` | `string` | `'0px'` | Viewport margin offset (e.g. `'-100px'`). |
| `transition` | `SpringOptions` | `{ stiffness: 200, damping: 20, mass: 0.4 }` | Spring physics parameters. |
| `delay` | `number` | `0` | Delay in ms before animation begins. |
| `initiallyStable` | `boolean` | `false` | Skip initial mount animation and render target number immediately. |
| `onNumberChange` | `(num: number) => void` | `undefined` | Callback invoked as the number value updates. |

## Usage Examples

### 1. Basic Dynamic Counter
```tsx
'use client';

import * as React from 'react';
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number';

export function CounterDemo() {
  const [value, setValue] = React.useState(1280);

  return (
    <div className="flex items-center gap-4">
      <span className="text-4xl font-bold tracking-tight">
        <SlidingNumber number={value} thousandSeparator="," />
      </span>
      <button 
        onClick={() => setValue(prev => prev + 150)}
        className="px-3 py-1 bg-neutral-900 text-white rounded-md text-sm"
      >
        Add +150
      </button>
    </div>
  );
}
```

### 2. Scroll-triggered KPI Stat (Animate on View)
```tsx
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number';

export function MetricCard() {
  return (
    <div className="p-6 border rounded-xl bg-card">
      <p className="text-sm text-muted-foreground">Total Users</p>
      <div className="text-3xl font-extrabold flex items-center">
        <SlidingNumber 
          number={98500} 
          fromNumber={0} 
          inView={true} 
          thousandSeparator="," 
        />
        <span>+</span>
      </div>
    </div>
  );
}
```

### 3. Currency / Price with Decimals
```tsx
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number';

export function PriceDisplay({ price }: { price: number }) {
  return (
    <span className="text-2xl font-mono font-semibold">
      $
      <SlidingNumber 
        number={price} 
        decimalPlaces={2} 
        thousandSeparator="," 
      />
    </span>
  );
}
```
