'use client'

import * as React from 'react'
import { motion, AnimatePresence, type HTMLMotionProps, type Transition } from 'motion/react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (val: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

export function useTabs() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) {
    throw new Error('useTabs must be used within a Tabs provider')
  }
  return ctx
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value: controlledValue, defaultValue = '', onValueChange, className, children, ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
    const isControlled = controlledValue !== undefined
    const activeValue = isControlled ? (controlledValue || '') : uncontrolledValue

    const handleValueChange = React.useCallback(
      (val: string) => {
        if (!isControlled) {
          setUncontrolledValue(val)
        }
        onValueChange?.(val)
      },
      [isControlled, onValueChange]
    )

    return (
      <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
        <div ref={ref} data-slot="tabs" className={cn('flex flex-col gap-2', className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = 'Tabs'

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="tablist"
        data-slot="tabs-list"
        className={cn(
          'relative inline-flex h-9 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
          className
        )}
        {...props}
      />
    )
  }
)
TabsList.displayName = 'TabsList'

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, className, children, onClick, ...props }, ref) => {
    const { value: activeValue, onValueChange } = useTabs()
    const isActive = activeValue === value

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        data-state={isActive ? 'active' : 'inactive'}
        data-slot="tabs-trigger"
        onClick={(e) => {
          onClick?.(e)
          onValueChange(value)
        }}
        className={cn(
          'relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50',
          isActive
            ? 'text-slate-950 dark:text-slate-50'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
          className
        )}
        {...props}
      >
        {children}
        {isActive && (
          <motion.div
            layoutId="active-tab-highlight"
            className="absolute inset-0 z-[-1] rounded-md bg-white shadow-sm dark:bg-slate-900"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
      </button>
    )
  }
)
TabsTrigger.displayName = 'TabsTrigger'

export interface TabsContentsProps extends React.HTMLAttributes<HTMLDivElement> {
  transition?: Transition
}

export const TabsContents = React.forwardRef<HTMLDivElement, TabsContentsProps>(
  ({ className, transition, children, ...props }, ref) => {
    return (
      <div ref={ref} data-slot="tabs-contents" className={cn('relative w-full overflow-hidden', className)} {...props}>
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </div>
    )
  }
)
TabsContents.displayName = 'TabsContents'

export interface TabsContentProps extends HTMLMotionProps<'div'> {
  value: string
  transition?: Transition
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, transition, children, ...props }, ref) => {
    const { value: activeValue } = useTabs()
    if (activeValue !== value) return null

    return (
      <motion.div
        key={value}
        role="tabpanel"
        data-slot="tabs-content"
        initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
        transition={transition || { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={cn('w-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-500', className)}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
TabsContent.displayName = 'TabsContent'
