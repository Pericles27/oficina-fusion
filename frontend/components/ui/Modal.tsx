'use client';

import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  glass?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  titleId?: string;
  className?: string;
}

function getModalSize(size: ModalProps['size']): string {
  switch (size) {
    case 'sm': return 'max-w-sm';
    case 'md': return 'max-w-md';
    case 'lg': return 'max-w-lg';
    case 'xl': return 'max-w-xl';
    default: return 'max-w-2xl';
  }
}

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  glass = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = '',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnBackdrop && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdrop, onClose]
  );

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      previousFocus.current?.focus();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, closeOnEscape]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`modal-content ${glass ? 'panel' : ''} ${getModalSize(size)} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-desc' : undefined}
      >
        {(title || description) && (
          <div className="modal-header">
            <div>
              {title && (
                <h2 id="modal-title" className="heading-3 m-0">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-desc" className="text-sm mt-1" style={{ color: 'var(--warm-gray-3)' }}>
                  {description}
                </p>
              )}
            </div>
            <button
              className="btn-icon"
              onClick={onClose}
              aria-label="Cerrar"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && (
          <div className="modal-footer">{footer}</div>
        )}
      </div>
    </div>
  );
}

export { Modal };
