'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { PanelLeft } from 'lucide-react'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const SIDEBAR_COOKIE_NAME = 'sidebar_state'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_MOBILE = '18rem'
const SIDEBAR_WIDTH_ICON = '3.5rem'
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

type SidebarContextProps = {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const defaultContext: SidebarContextProps = {
  state: 'expanded',
  open: true,
  setOpen: () => {},
  openMobile: false,
  setOpenMobile: () => {},
  isMobile: false,
  toggleSidebar: () => {},
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  return context || defaultContext
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)

    const [_open, _setOpen] = React.useState(defaultOpen)
    const open = openProp ?? _open
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === 'function' ? value(open) : value
        if (setOpenProp) {
          setOpenProp(openState)
        } else {
          _setOpen(openState)
        }

        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      },
      [setOpenProp, open]
    )

    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((open) => !open)
        : setOpen((open) => !open)
    }, [isMobile, setOpen, setOpenMobile])

    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault()
          toggleSidebar()
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [toggleSidebar])

    const state = open ? 'expanded' : 'collapsed'

    const contextValue = React.useMemo<SidebarContextProps>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                '--sidebar-width': SIDEBAR_WIDTH,
                '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              'group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-slate-100 dark:has-[[data-variant=inset]]:bg-slate-900',
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = 'SidebarProvider'

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    side?: 'left' | 'right'
    variant?: 'sidebar' | 'floating' | 'inset'
    collapsible?: 'offcanvas' | 'icon' | 'none'
  }
>(
  (
    {
      side = 'left',
      variant = 'sidebar',
      collapsible = 'offcanvas',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

    if (collapsible === 'none') {
      return (
        <div
          data-sidebar="sidebar"
          style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', ...props.style }}
          className={cn(
            'flex h-full w-full flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-50 border-r border-slate-200 dark:border-slate-800',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      )
    }

    if (isMobile) {
      return (
        <div
          className={cn(
            'fixed inset-0 z-50 bg-black/80 transition-opacity',
            openMobile ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
          onClick={() => setOpenMobile(false)}
        >
          <div
            ref={ref}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'fixed inset-y-0 z-50 flex h-full flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-50 transition-transform duration-300 ease-in-out',
              side === 'left' ? 'left-0' : 'right-0',
              openMobile
                ? 'translate-x-0'
                : side === 'left'
                ? '-translate-x-full'
                : 'translate-x-full',
              className
            )}
            style={{ width: SIDEBAR_WIDTH_MOBILE }}
            {...props}
          >
            {children}
          </div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className="group peer hidden md:block text-slate-900 dark:text-slate-50"
        data-state={state}
        data-collapsible={state === 'collapsed' ? collapsible : ''}
        data-variant={variant}
        data-side={side}
      >
        <div
          className={cn(
            'duration-200 relative h-svh w-[--sidebar-width] bg-transparent transition-[width] ease-linear',
            'group-data-[collapsible=offcanvas]:w-0',
            'group-data-[side=right]:rotate-180',
            variant === 'floating' || variant === 'inset'
              ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]'
              : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon]'
          )}
        />
        <div
          className={cn(
            'duration-200 fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] ease-linear md:flex',
            side === 'left'
              ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
              : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
            variant === 'floating' || variant === 'inset'
              ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]'
              : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l border-slate-200 dark:border-slate-800',
            className
          )}
          {...props}
        >
          <div
            data-sidebar="sidebar"
            className="flex h-full w-full flex-col bg-white dark:bg-slate-900 group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-slate-200 group-data-[variant=floating]:shadow dark:group-data-[variant=floating]:border-slate-800"
          >
            {children}
          </div>
        </div>
      </div>
    )
  }
)
Sidebar.displayName = 'Sidebar'

const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      ref={ref}
      data-sidebar="trigger"
      type="button"
      className={cn('inline-flex items-center justify-center rounded-md h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors', className)}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft className="size-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  )
})
SidebarTrigger.displayName = 'SidebarTrigger'

const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'>
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      ref={ref}
      data-sidebar="rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-slate-300 dark:hover:after:bg-slate-700 group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex',
        '[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-slate-100',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        className
      )}
      {...props}
    />
  )
})
SidebarRail.displayName = 'SidebarRail'

const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'main'>
>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        'relative flex min-h-svh flex-1 flex-col bg-white dark:bg-slate-900',
        'peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow',
        className
      )}
      {...props}
    />
  )
})
SidebarInset.displayName = 'SidebarInset'

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, style, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      style={{ display: 'flex', flexDirection: 'column', width: '100%', flexShrink: 0, boxSizing: 'border-box', ...style }}
      className={cn('flex flex-col', className)}
      {...props}
    />
  )
})
SidebarHeader.displayName = 'SidebarHeader'

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, style, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      style={{ display: 'flex', flexDirection: 'column', width: '100%', flexShrink: 0, marginTop: 'auto', boxSizing: 'border-box', ...style }}
      className={cn('flex flex-col mt-auto', className)}
      {...props}
    />
  )
})
SidebarFooter.displayName = 'SidebarFooter'

const SidebarSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn('mx-2 w-auto bg-slate-200 dark:bg-slate-800', className)}
      {...props}
    />
  )
})
SidebarSeparator.displayName = 'SidebarSeparator'

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, style, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', width: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box', ...style }}
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className
      )}
      {...props}
    />
  )
})
SidebarContent.displayName = 'SidebarContent'

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, style, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'relative', boxSizing: 'border-box', ...style }}
      className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
      {...props}
    />
  )
})
SidebarGroup.displayName = 'SidebarGroup'

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & { asChild?: boolean }
>(({ className, asChild = false, style, ...props }, ref) => {
  const Comp = asChild ? Slot : 'div'

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', ...style }}
      className={cn(
        'duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-slate-500 outline-none transition-[margin,opacity] ease-linear focus-visible:ring-2 focus-visible:ring-slate-950 dark:text-slate-400 [&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        className
      )}
      {...props}
    />
  )
})
SidebarGroupLabel.displayName = 'SidebarGroupLabel'

const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & { asChild?: boolean }
>(({ className, asChild = false, style, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      style={{ border: 'none', background: 'transparent', cursor: 'pointer', ...style }}
      className={cn(
        'absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-slate-500 outline-none transition-transform hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50 [&>svg]:size-4 [&>svg]:shrink-0',
        'after:absolute after:-inset-2 after:md:hidden',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
})
SidebarGroupAction.displayName = 'SidebarGroupAction'

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    style={{ display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', ...style }}
    className={cn('w-full text-sm', className)}
    {...props}
  />
))
SidebarGroupContent.displayName = 'SidebarGroupContent'
SidebarGroupContent.displayName = 'SidebarGroupContent'

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'>
>(({ className, style, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', width: '100%', gap: '4px', ...style }}
    className={cn('flex w-full min-w-0 flex-col gap-1 list-none p-0 m-0', className)}
    {...props}
  />
))
SidebarMenu.displayName = 'SidebarMenu'

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ className, style, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', ...style }}
    className={cn('group/menu-item relative list-none p-0 m-0', className)}
    {...props}
  />
))
SidebarMenuItem.displayName = 'SidebarMenuItem'

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-slate-950 transition-[width,height,padding] hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 active:bg-slate-100 active:text-slate-900 disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-slate-100 data-[active=true]:font-medium data-[active=true]:text-slate-900 data-[state=open]:hover:bg-slate-100 data-[state=open]:hover:text-slate-900 group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 dark:ring-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus-visible:ring-slate-300 dark:active:bg-slate-800 dark:active:text-slate-50 dark:data-[active=true]:bg-slate-800 dark:data-[active=true]:text-slate-50 dark:data-[state=open]:hover:bg-slate-800 dark:data-[state=open]:hover:text-slate-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50',
        outline:
          'bg-white shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-slate-100 hover:text-slate-900 hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))] dark:bg-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:!p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = 'default',
      size = 'default',
      tooltip,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    const { isMobile, state } = useSidebar()

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        style={{ display: 'flex', alignItems: 'center', width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box', ...style }}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      />
    )

    if (!tooltip) {
      return button
    }

    if (typeof tooltip === 'string') {
      tooltip = {
        children: tooltip,
      }
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          hidden={state !== 'collapsed' || isMobile}
          {...tooltip}
        />
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = 'SidebarMenuButton'

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & {
    asChild?: boolean
    showOnHover?: boolean
  }
>(({ className, asChild = false, showOnHover = false, style, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      style={{
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        position: 'absolute',
        right: '4px',
        top: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        padding: 0,
        margin: 0,
        zIndex: 5,
        ...style,
      }}
      className={cn(
        'text-slate-500 transition-all hover:bg-slate-200/90 hover:text-slate-900 focus-visible:ring-2 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-50 [&>svg]:size-3.5 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:hidden',
        showOnHover &&
          'opacity-0 group-hover/db-row:opacity-100 group-hover/table-row:opacity-100 group-hover/sub-item:opacity-100 group-focus-within/menu-item:opacity-100 data-[state=open]:opacity-100 transition-opacity duration-150',
        className
      )}
      {...props}
    />
  )
})
SidebarMenuAction.displayName = 'SidebarMenuAction'

const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'>
>(({ className, style, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu-sub"
    style={{ listStyle: 'none', margin: '2px 0 2px 14px', padding: '0 0 0 10px', display: 'flex', flexDirection: 'column', width: 'auto', gap: '2px', borderLeft: '1px solid #e2e8f0', ...style }}
    className={cn(
      'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-slate-200 px-2.5 py-0.5 dark:border-slate-800 list-none',
      'group-data-[collapsible=icon]:hidden',
      className
    )}
    {...props}
  />
))
SidebarMenuSub.displayName = 'SidebarMenuSub'

const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ className, style, ...props }, ref) => (
  <li
    ref={ref}
    style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', ...style }}
    className={cn('relative group/sub-item list-none p-0 m-0', className)}
    {...props}
  />
))
SidebarMenuSubItem.displayName = 'SidebarMenuSubItem'

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<'a'> & {
    asChild?: boolean
    size?: 'sm' | 'md'
    isActive?: boolean
  }
>(({ asChild = false, size = 'md', isActive, className, style, ...props }, ref) => {
  const Comp = asChild ? Slot : 'a'

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      style={{ display: 'flex', alignItems: 'center', width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box', ...style }}
      className={cn(
        'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-slate-700 outline-none ring-slate-950 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 active:bg-slate-100 active:text-slate-900 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 dark:text-slate-300 dark:ring-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:active:bg-slate-800 dark:active:text-slate-50 font-medium',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        className
      )}
      {...props}
    />
  )
})
const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="menu-badge"
    style={{
      marginLeft: 'auto',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '18px',
      height: '18px',
      padding: '0 5px',
      borderRadius: '9999px',
      fontSize: '11px',
      fontWeight: 700,
      pointerEvents: 'none',
      flexShrink: 0,
      boxSizing: 'border-box',
      ...style,
    }}
    className={cn(
      'ml-auto inline-flex h-4 min-w-4 select-none items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-200',
      className
    )}
    {...props}
  />
))
SidebarMenuBadge.displayName = 'SidebarMenuBadge'

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}

