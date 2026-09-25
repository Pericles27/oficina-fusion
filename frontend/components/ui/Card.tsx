'use client';

import { forwardRef, HTMLAttributes, ReactNode, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

/* ─── Context ─── */

interface CardContextValue {
  clickable: boolean;
  glass: boolean;
}

const CardContext = createContext<CardContextValue>({ clickable: false, glass: false });

function useCardContext() {
  return useContext(CardContext);
}

/* ─── Card ─── */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  clickable?: boolean;
  glass?: boolean;
  children: ReactNode;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ clickable = false, glass = false, children, className = '', ...props }, ref) => {
    const baseClass = glass ? 'panel' : 'card';
    const clickClass = clickable ? 'cursor-pointer' : '';

    return (
      <CardContext.Provider value={{ clickable, glass }}>
        <div
          ref={ref}
          className={cn(baseClass, clickClass, className)}
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          onClick={clickable ? props.onClick : undefined}
          onKeyDown={
            clickable
              ? (e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    props.onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
                  }
                }
              : undefined
          }
          {...props}
        >
          {children}
        </div>
      </CardContext.Provider>
    );
  }
);

Card.displayName = 'Card';

/* ─── CardHeader ─── */

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pb-0', className)} {...props}>
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

/* ─── CardTitle ─── */

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, className = '', ...props }, ref) => (
    <h3 ref={ref} className={cn('heading-3', className)} {...props}>
      {children}
    </h3>
  )
);

CardTitle.displayName = 'CardTitle';

/* ─── CardDescription ─── */

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ children, className = '', ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-warm-gray-3 mt-1', className)} style={{ color: 'var(--warm-gray-3)' }} {...props}>
      {children}
    </p>
  )
);

CardDescription.displayName = 'CardDescription';

/* ─── CardContent ─── */

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={cn('p-5', className)} {...props}>
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';

/* ─── CardFooter ─── */

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0 flex items-center justify-end gap-2', className)} {...props}>
      {children}
    </div>
  )
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
