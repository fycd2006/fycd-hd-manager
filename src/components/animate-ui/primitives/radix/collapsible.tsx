'use client'

import * as React from 'react'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { motion, AnimatePresence } from 'motion/react'

interface CollapsibleContextValue {
  open?: boolean
}

const CollapsibleContext = React.createContext<CollapsibleContextValue>({ open: true })

const Collapsible = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root>
>(({ open, defaultOpen, onOpenChange, children, ...props }, ref) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? true)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : uncontrolledOpen

  const handleOpenChange = (val: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(val)
    }
    onOpenChange?.(val)
  }

  return (
    <CollapsibleContext.Provider value={{ open: isOpen }}>
      <CollapsiblePrimitive.Root
        ref={ref}
        open={isOpen}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {children}
      </CollapsiblePrimitive.Root>
    </CollapsibleContext.Provider>
  )
})
Collapsible.displayName = 'Collapsible'

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'> & {
    transition?: any
  }
>(({ className, children, transition = { duration: 0.22, ease: [0.16, 1, 0.3, 1] }, ...props }, ref) => {
  const { open } = React.useContext(CollapsibleContext)

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          ref={ref}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={transition}
          style={{ overflow: 'hidden' }}
          className={className}
          {...(props as any)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
})
CollapsibleContent.displayName = 'CollapsibleContent'

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
