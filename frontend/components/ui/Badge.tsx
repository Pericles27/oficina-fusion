'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'blue';
  size?: 'sm' | 'md';
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

const Badge = ({ variant = 'neutral', size = 'md', children, icon, className = '' }: BadgeProps) => {
  const variantMap = {
    success: 'badge-success',
    danger: 'badge-danger',
    warning: 'badge-warning',
    info: 'badge-info',
    neutral: 'badge-neutral',
    blue: 'badge-blue',
  };

  return (
    <span
      className={cn(
        'badge',
        variantMap[variant],
        size === 'sm' && '!text-xs !px-2',
        className
      )}
    >
      {icon && <span className="inline-flex items-center">{icon}</span>}
      {children}
    </span>
  );
};

export { Badge };
