'use client';

import {
  createContext,
  forwardRef,
  HTMLAttributes,
  ReactNode,
  useContext,
  useState,
  KeyboardEvent,
  PointerEvent,
} from 'react';
import { cn } from '@/lib/utils';

/* ─── Context ─── */

interface TabsContextValue {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  orientation: 'horizontal' | 'vertical';
}

const TabsContext = createContext<TabsContextValue>({
  activeIndex: 0,
  setActiveIndex: () => {},
  orientation: 'horizontal',
});

function useTabsContext() {
  return useContext(TabsContext);
}

/* ─── Tabs ─── */

export interface TabsProps {
  defaultIndex?: number;
  index?: number;
  onIndexChange?: (index: number) => void;
  orientation?: 'horizontal' | 'vertical';
  children: ReactNode;
  className?: string;
}

function Tabs({
  defaultIndex = 0,
  index: controlledIndex,
  onIndexChange,
  orientation = 'horizontal',
  children,
  className = '',
}: TabsProps) {
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const activeIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;

  const setActiveIndex = (index: number) => {
    setInternalIndex(index);
    onIndexChange?.(index);
  };

  return (
    <TabsContext.Provider value={{ activeIndex, setActiveIndex, orientation }}>
      <div className={cn('tabs', className)} role="tablist" data-orientation={orientation}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

/* ─── TabList ─── */

export interface TabListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const TabList = forwardRef<HTMLDivElement, TabListProps>(
  ({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={cn('tab-list', className)} role="tablist" {...props}>
      {children}
    </div>
  )
);

TabList.displayName = 'TabList';

/* ─── TabTrigger ─── */

export interface TabTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  index: number;
}

const TabTrigger = forwardRef<HTMLButtonElement, TabTriggerProps>(
  ({ children, index, className = '', ...props }, ref) => {
    const { activeIndex, setActiveIndex, orientation } = useTabsContext();
    const isActive = index === activeIndex;

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      const siblings = (e.currentTarget.parentElement?.querySelectorAll('[role="tab"]') || []) as NodeListOf<HTMLElement>;
      let newIndex = index;

      if (orientation === 'horizontal') {
        if (e.key === 'ArrowRight') newIndex = Math.min(index + 1, siblings.length - 1);
        if (e.key === 'ArrowLeft') newIndex = Math.max(index - 1, 0);
      } else {
        if (e.key === 'ArrowDown') newIndex = Math.min(index + 1, siblings.length - 1);
        if (e.key === 'ArrowUp') newIndex = Math.max(index - 1, 0);
      }

      if (newIndex !== index) {
        e.preventDefault();
        setActiveIndex(newIndex);
        siblings[newIndex]?.focus();
      }

      if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(0);
        siblings[0]?.focus();
      }

      if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(siblings.length - 1);
        siblings[siblings.length - 1]?.focus();
      }
    };

    return (
      <button
        ref={ref}
        className={cn('tab-trigger', className)}
        role="tab"
        aria-selected={isActive}
        aria-controls={`panel-${index}`}
        id={`tab-${index}`}
        data-state={isActive ? 'active' : 'inactive'}
        tabIndex={isActive ? 0 : -1}
        onClick={() => setActiveIndex(index)}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TabTrigger.displayName = 'TabTrigger';

/* ─── TabPanel ─── */

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  index: number;
}

const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>(
  ({ children, index, className = '', ...props }, ref) => {
    const { activeIndex } = useTabsContext();
    const isActive = index === activeIndex;

    if (!isActive) return null;

    return (
      <div
        ref={ref}
        className={cn('tab-panel', className)}
        role="tabpanel"
        id={`panel-${index}`}
        aria-labelledby={`tab-${index}`}
        tabIndex={0}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabPanel.displayName = 'TabPanel';

export { Tabs, TabList, TabTrigger, TabPanel };
