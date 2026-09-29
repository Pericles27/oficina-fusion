'use client';

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react';

/* ─── Input ─── */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  helperText?: string;
  error?: string;
  prefixIcon?: ReactNode;
  suffixIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, prefixIcon, suffixIcon, className = '', type = 'text', id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;

    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && <label htmlFor={inputId} className="label">{label}</label>}

        <div className="relative">
          {prefixIcon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none"
                  style={{ color: 'var(--warm-gray-3)' }}>
              {prefixIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className="input"
            style={{
              ...(prefixIcon ? { paddingLeft: 42 } : null),
              ...(suffixIcon ? { paddingRight: 42 } : null),
              ...(error ? { borderColor: 'var(--danger)' } : null),
            }}
            aria-invalid={!!error}
            aria-describedby={helperText || error ? `${inputId}-help` : undefined}
            {...props}
          />
          {suffixIcon && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center"
                  style={{ color: 'var(--warm-gray-3)' }}>
              {suffixIcon}
            </span>
          )}
        </div>

        {(helperText || error) && (
          <span id={`${inputId}-help`} className="text-small"
                style={{ color: error ? 'var(--danger)' : 'var(--warm-gray-3)' }}>
            {error || helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/* ─── Select ─── */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, placeholder, options, className = '', id, ...props }, ref) => {
    const autoId = useId();
    const selectId = id || autoId;

    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && <label htmlFor={selectId} className="label">{label}</label>}
        <select
          ref={ref}
          id={selectId}
          className="select"
          style={error ? { borderColor: 'var(--danger)' } : undefined}
          aria-invalid={!!error}
          aria-describedby={helperText || error ? `${selectId}-help` : undefined}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {(helperText || error) && (
          <span id={`${selectId}-help`} className="text-small"
                style={{ color: error ? 'var(--danger)' : 'var(--warm-gray-3)' }}>
            {error || helperText}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

/* ─── Textarea ─── */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, error, className = '', id, ...props }, ref) => {
    const autoId = useId();
    const areaId = id || autoId;

    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && <label htmlFor={areaId} className="label">{label}</label>}
        <textarea
          ref={ref}
          id={areaId}
          className="textarea"
          style={error ? { borderColor: 'var(--danger)' } : undefined}
          aria-invalid={!!error}
          aria-describedby={helperText || error ? `${areaId}-help` : undefined}
          {...props}
        />
        {(helperText || error) && (
          <span id={`${areaId}-help`} className="text-small"
                style={{ color: error ? 'var(--danger)' : 'var(--warm-gray-3)' }}>
            {error || helperText}
          </span>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Input, Select, Textarea };
