'use client'

import * as React from 'react'
import {
  Tabs as TabsPrimitive,
  TabsList as TabsListPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
  TabsContent as TabsContentPrimitive,
  TabsContents as TabsContentsPrimitive,
  type TabsProps as TabsPrimitiveProps,
  type TabsListProps as TabsListPrimitiveProps,
  type TabsTriggerProps as TabsTriggerPrimitiveProps,
  type TabsContentProps as TabsContentPrimitiveProps,
  type TabsContentsProps as TabsContentsPrimitiveProps,
} from '@/components/animate-ui/primitives/radix/tabs'
import { cn } from '@/lib/utils'

export type TabsProps = TabsPrimitiveProps

export function Tabs({ className, ...props }: TabsProps) {
  return (
    <TabsPrimitive
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

export type TabsListProps = TabsListPrimitiveProps

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsListPrimitive
      className={cn(
        'inline-flex h-9 w-fit items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        className
      )}
      {...props}
    />
  )
}

export type TabsTriggerProps = TabsTriggerPrimitiveProps

export function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  return (
    <TabsTriggerPrimitive
      className={cn(
        'data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-50 text-slate-600 dark:text-slate-400 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export type TabsContentsProps = TabsContentsPrimitiveProps

export function TabsContents(props: TabsContentsProps) {
  return <TabsContentsPrimitive {...props} />
}

export type TabsContentProps = TabsContentPrimitiveProps

export function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <TabsContentPrimitive
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}
