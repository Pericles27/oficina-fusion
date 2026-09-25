'use client';

import { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  change?: number; // percentage
  changeLabel?: string;
  subtitle?: string;
  icon?: ReactNode;
  iconClassName?: string;
  className?: string;
  formatFn?: (value: string | number) => string;
}

function StatCard({
  label,
  value,
  change,
  changeLabel,
  subtitle,
  icon,
  iconClassName,
  className = '',
  formatFn,
}: StatCardProps) {
  const displayValue = formatFn ? formatFn(value) : String(value);
  const hasChange = change !== undefined && change !== 0;
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className={cn('stat-card animate-scale-in', className)}>
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {icon && (
          <span
            className={cn('inline-flex items-center justify-center rounded-md p-1', iconClassName)}
            style={{ color: 'var(--blue)' }}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="amount-large">{displayValue}</div>
      {hasChange && (
        <div className={cn('stat-change', isPositive ? 'positive' : 'negative')}>
          {isPositive ? (
            <ArrowUpRight className="w-3 h-3 inline mr-1" />
          ) : (
            <ArrowDownRight className="w-3 h-3 inline mr-1" />
          )}
          {isPositive ? '+' : ''}
          {change}%
          {changeLabel && (
            <span className="text-warm-gray-3" style={{ color: 'var(--warm-gray-3)', marginLeft: '2px' }}>
              {changeLabel}
            </span>
          )}
        </div>
      )}
      {subtitle && !hasChange && (
        <span className="text-sm text-warm-gray-3" style={{ color: 'var(--warm-gray-3)' }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}

export { StatCard };
