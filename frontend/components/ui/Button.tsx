'use client';

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      children,
      icon,
      iconPosition = 'left',
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseClasses = 'btn';
    const variantClasses =
      variant === 'primary'
        ? 'btn-primary'
        : variant === 'secondary'
          ? 'btn-secondary'
          : variant === 'ghost'
            ? 'btn-ghost'
            : variant === 'danger'
              ? 'btn-danger'
              : variant === 'icon'
                ? 'btn-icon'
                : '';
    const sizeClasses =
      variant === 'icon'
        ? ''
        : size === 'sm'
          ? 'btn-sm'
          : size === 'lg'
            ? 'btn-lg'
            : '';
    const widthClass = fullWidth ? 'btn-full' : '';
    const combinedClass = [baseClasses, variantClasses, sizeClasses, widthClass, className]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} className={combinedClass} disabled={disabled || loading} {...props}>
        {icon && iconPosition === 'left' && (
          <span className="inline-flex items-center">{icon}</span>
        )}
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
        {icon && iconPosition === 'right' && !loading && (
          <span className="inline-flex items-center">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
