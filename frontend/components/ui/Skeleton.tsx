'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'pill' | 'none';
  children?: ReactNode;
}

function Skeleton({ className = '', width, height, rounded = 'sm', children }: SkeletonProps) {
  const roundedMap = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    pill: 'rounded-pill',
    none: 'rounded-none',
  };

  return (
    <div
      className={cn('skeleton', roundedMap[rounded], className)}
      style={width ? { width } : undefined}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

export interface SkeletonTextProps {
  lines?: number;
  width?: string;
  className?: string;
}

function SkeletonText({ lines = 3, width, className = '' }: SkeletonTextProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="14px"
          width={i === lines - 1 ? width || '60%' : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  );
}

export interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

function SkeletonAvatar({ size = 'md', className = '' }: SkeletonAvatarProps) {
  const sizeMap = {
    sm: '24px',
    md: '32px',
    lg: '40px',
    xl: '56px',
  };

  return (
    <Skeleton
      height={sizeMap[size]}
      width={sizeMap[size]}
      rounded="pill"
      className={className}
    />
  );
}

export interface SkeletonCardProps {
  className?: string;
}

function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <Skeleton
      height="120px"
      rounded="lg"
      className={className}
    >
      <div className="p-4 flex flex-col gap-3 h-full">
        <Skeleton width="40%" height="14px" />
        <Skeleton width="80%" height="14px" />
        <Skeleton width="60%" height="14px" />
      </div>
    </Skeleton>
  );
}

export interface SkeletonTableRowProps {
  cells?: number;
  className?: string;
}

function SkeletonTableRow({ cells = 4, className = '' }: SkeletonTableRowProps) {
  return (
    <Skeleton
      height="44px"
      rounded="none"
      className={className}
    >
      <div className="flex items-center gap-4 px-4 h-full">
        {Array.from({ length: cells }).map((_, i) => (
          <Skeleton
            key={i}
            width={`${50 + Math.random() * 100}px`}
            height="14px"
          />
        ))}
      </div>
    </Skeleton>
  );
}

export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard, SkeletonTableRow };
