'use client';

import {
  createContext,
  forwardRef,
  HTMLAttributes,
  ReactNode,
  useContext,
  useState,
} from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/* ─── Context ─── */

interface PanelContextValue {
  collapsed: boolean;
  sticky: boolean;
  toggleCollapsed: () => void;
}

const PanelContext = createContext<PanelContextValue>({
  collapsed: false,
  sticky: false,
  toggleCollapsed: () => {},
});

function usePanelContext() {
  return useContext(PanelContext);
}

/* ─── Panel ─── */

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  sticky?: boolean;
  collapsible?: boolean;
}

const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ children, sticky = false, collapsible = false, className = '', ...props }, ref) => {
    const [collapsed, setCollapsed] = useState(false);

    const toggleCollapsed = () => setCollapsed((prev) => !prev);

    return (
      <PanelContext.Provider value={{ collapsed, sticky, toggleCollapsed }}>
        <div
          ref={ref}
          className={`panel ${sticky ? 'sticky top-0 z-10' : ''} ${className}`}
          role="region"
          aria-labelledby={sticky ? undefined : undefined}
          {...props}
        >
          {children}
        </div>
      </PanelContext.Provider>
    );
  }
);

Panel.displayName = 'Panel';

/* ─── PanelHeader ─── */

export interface PanelHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const PanelHeader = forwardRef<HTMLDivElement, PanelHeaderProps>(
  ({ children, className = '', ...props }, ref) => {
    const { collapsed, sticky, toggleCollapsed } = usePanelContext();

    return (
      <div ref={ref} className={`panel-header ${sticky ? 'sticky top-0 z-10' : ''} ${className}`} {...props}>
        <div className="flex items-center gap-2">
          {sticky && (
            <button
              className="btn-icon"
              onClick={toggleCollapsed}
              type="button"
              aria-label={collapsed ? 'Expandir panel' : 'Colapsar panel'}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
          {children}
        </div>
      </div>
    );
  }
);

PanelHeader.displayName = 'PanelHeader';

/* ─── PanelTitle ─── */

export interface PanelTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

const PanelTitle = forwardRef<HTMLHeadingElement, PanelTitleProps>(
  ({ children, className = '', ...props }, ref) => (
    <h3 ref={ref} className={`panel-title ${className}`} {...props}>
      {children}
    </h3>
  )
);

PanelTitle.displayName = 'PanelTitle';

/* ─── PanelBody ─── */

export interface PanelBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const PanelBody = forwardRef<HTMLDivElement, PanelBodyProps>(
  ({ children, className = '', ...props }, ref) => {
    const { collapsed } = usePanelContext();

    if (collapsed) return null;

    return (
      <div ref={ref} className={`panel-body ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

PanelBody.displayName = 'PanelBody';

/* ─── PanelFooter ─── */

export interface PanelFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const PanelFooter = forwardRef<HTMLDivElement, PanelFooterProps>(
  ({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={`panel-footer ${className}`} {...props}>
      {children}
    </div>
  )
);

PanelFooter.displayName = 'PanelFooter';

export { Panel, PanelHeader, PanelTitle, PanelBody, PanelFooter };
