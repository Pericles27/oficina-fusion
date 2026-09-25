'use client';

import { ReactNode } from 'react';
import { FileSearch, Inbox, AlertCircle, Search } from 'lucide-react';
import { Button } from './Button';

export type EmptyStateVariant = 'search' | 'data' | 'actions' | 'default';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  action?: () => void;
  variant?: EmptyStateVariant;
  className?: string;
}

const variantIcons: Record<EmptyStateVariant, ReactNode> = {
  search: <Search className="w-8 h-8" />,
  data: <Inbox className="w-8 h-8" />,
  actions: <FileSearch className="w-8 h-8" />,
  default: <AlertCircle className="w-8 h-8" />,
};

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  action,
  variant = 'default',
  className = '',
}: EmptyStateProps) {
  const iconToUse = icon || variantIcons[variant];

  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-icon">{iconToUse}</div>
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-description">{description}</p>}
      {actionLabel && action && (
        <Button variant="primary" onClick={action}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export { EmptyState };
