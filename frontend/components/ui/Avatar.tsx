'use client';

import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

export interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy' | null;
  bordered?: boolean;
  className?: string;
}

const sizeClassMap = {
  sm: 'avatar-sm',
  md: 'avatar-md',
  lg: 'avatar-lg',
  xl: 'avatar-xl',
} as const;

const statusColors: Record<string, string> = {
  online: 'var(--success)',
  offline: 'var(--warm-gray-4)',
  away: 'var(--warning)',
  busy: 'var(--danger)',
};

const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ src, alt, initials, icon, size = 'md', status = null, bordered = false, className = '' }, ref) => (
    <span
      ref={ref}
      className={cn('avatar', 'relative', sizeClassMap[size], className)}
      style={bordered ? { outline: '2px solid var(--bg-surface)', outlineOffset: 0 } : undefined}
      role="img"
      aria-label={alt || (initials ? `Avatar ${initials}` : 'Avatar')}
    >
      {src ? (
        <img src={src} alt={alt || ''} />
      ) : initials ? (
        <span>{initials.toUpperCase()}</span>
      ) : icon ? (
        icon
      ) : (
        <User className="w-3/5 h-3/5 opacity-50" />
      )}

      {status && (
        <span
          className="absolute bottom-0 right-0 block rounded-full"
          style={{
            width: '32%',
            height: '32%',
            backgroundColor: statusColors[status],
            boxShadow: '0 0 0 2px var(--bg-surface)',
          }}
          aria-label={`Estado: ${status}`}
        />
      )}
    </span>
  )
);

Avatar.displayName = 'Avatar';

export { Avatar };
