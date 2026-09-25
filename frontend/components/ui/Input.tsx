'use client';

import {
  forwardRef,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
  useId,
} from 'react';
import { Search, Eye, EyeOff, X } from 'lucide-react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: ReactNode;
  suffixIcon?: ReactNode;
  floatingLabel?: boolean;
  prefixIcon?: ReactNode;
  prefix?: ReactNode | string;
  suffix?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      icon,
      suffixIcon,
      floatingLabel = false,
      prefixIcon,
      prefix,
      suffix,
      className = '',
      type = 'text',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || useId();
    const isPassword = type === 'password';
    const hasIcon = icon || prefixIcon || prefix || suffixIcon || suffix;
    const isSearch = type === 'search';

    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && (
          <label
            htmlFor={inputId}
            className={floatingLabel ? 'label' : 'label'}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {(prefixIcon || prefix) && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
              {prefixIcon || prefix}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={`input ${error ? '!border-red-500 !ring-1 !ring-red-500' : ''} ${
              hasIcon ? 'pl-9' : ''
            }`}
            aria-invalid={!!error}
            aria-describedby={helperText || error ? `${inputId}-help` : undefined}
            {...props}
          />
          {(suffixIcon || suffix || isPassword) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {suffixIcon || suffix}
              {isPassword && (
                <button
                  type="button"
                  className="btn-icon w-5 h-5"
                  tabIndex={-1}
                  aria-label={isPassword ? 'Mostrar contraseña' : 'Ocultar contraseña'}
                >
                  {true ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
          )}
        </div>
        {(helperText || error) && (
          <span
            id={`${inputId}-help`}
            className={`text-sm ${error ? 'text-red-500' : 'text-warm-gray-3'}`}
            style={{ color: error ? 'var(--danger)' : 'var(--warm-gray-3)' }}
          >
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
    const selectId = id || useId();

    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && (
          <label htmlFor={selectId} className="label">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`input ${error ? '!border-red-500 !ring-1 !ring-red-500' : ''}`}
          aria-invalid={!!error}
          aria-describedby={`${selectId}-help`}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {(helperText || error) && (
          <span
            id={`${selectId}-help`}
            style={{ color: error ? 'var(--danger)' : 'var(--warm-gray-3)' }}
            className="text-sm"
          >
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
    const textareaId = id || useId();

    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && (
          <label htmlFor={textareaId} className="label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`input resize-y ${error ? '!border-red-500 !ring-1 !ring-red-500' : ''}`}
          aria-invalid={!!error}
          aria-describedby={`${textareaId}-help`}
          {...props}
        />
        {(helperText || error) && (
          <span
            id={`${textareaId}-help`}
            style={{ color: error ? 'var(--danger)' : 'var(--warm-gray-3)' }}
            className="text-sm"
          >
            {error || helperText}
          </span>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Input, Select, Textarea };
