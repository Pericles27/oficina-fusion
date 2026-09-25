'use client';

import { forwardRef, ImgHTMLAttributes, ReactNode } from 'react';
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

const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  (
    { src, alt, initials, icon, size = 'md', status = null, bordered = false, className = '' },
    ref
  ) => {
    const sizeClass = size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : size === 'xl' ? 'avatar-xl' : 'avatar-md';
    const borderClass = bordered ? 'ring-2 ring-white dark:ring-gray-800' : '';
    const sizeStyle =
      size === 'sm'
        ? { width: 24, height: 24 }
        : size === 'lg'
          ? { width: 40, height: 40 }
          : size === 'xl'
            ? { width: 56, height: 56 }
            : { width: 32, height: 32 };

    const statusColors: Record<string, string> = {
      online: 'var(--success)',
      offline: 'var(--warm-gray-4)',
      away: 'var(--warning)',
      busy: 'var(--danger)',
    };

    return (
      <span
        ref={ref}
        className={cn('avatar', sizeClass, borderClass, className)}
        style={sizeStyle}
        role="img"
        aria-label={alt || `Avatar ${initials || ''}`}
      >
        {src ? (
          <img src={src} alt={alt || ''} />
        ) : initials ? (
          <span className="text-xs font-semibold">{initials.toUpperCase()}</span>
        ) : icon ? (
          icon
        ) : (
          <User className="w-3/5 h-3/5 opacity-40" />
        )}
        {status && (
          <span
            className="absolute bottom-0 right-0 block w-[35%] h-[35%] rounded-full ring-2 ring-white dark:ring-gray-800"
            style={{ backgroundColor: statusColors[status] }}
            aria-label={`Estado: ${status}`}
          />
        )}
      </span>
    );
  }
);

Avatar.displayName = 'Avatar';

export { Avatar };
