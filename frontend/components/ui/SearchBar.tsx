'use client';

import {
  forwardRef,
  InputHTMLAttributes,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  useCallback,
} from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  debounceMs?: number;
  onChange?: (value: string) => void;
  suggestions?: string[];
  onSuggestionSelect?: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      debounceMs = 300,
      onChange,
      suggestions = [],
      onSuggestionSelect,
      autoFocus = false,
      placeholder = 'Buscar...',
      className = '',
      value,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [debouncedValue, setDebouncedValue] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => inputRef.current!);

    const displayValue = value !== undefined ? value : internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (value === undefined) setInternalValue(newValue);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setDebouncedValue(newValue);
        onChange?.(newValue);
      }, debounceMs);

      if (newValue.length > 0) {
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
    };

    const handleClear = () => {
      if (value === undefined) setInternalValue('');
      if (inputRef.current) inputRef.current.value = '';
      onChange?.('');
      setShowDropdown(false);
      inputRef.current?.focus();
    };

    const handleSelect = (suggestion: string) => {
      if (value === undefined) setInternalValue(suggestion);
      if (inputRef.current) inputRef.current.value = suggestion;
      onSuggestionSelect?.(suggestion);
      onChange?.(suggestion);
      setShowDropdown(false);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    };

    useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
      }
    }, [autoFocus]);

    // Close dropdown on outside click
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredSuggestions = suggestions.filter((s) =>
      s.toLowerCase().includes(debouncedValue.toLowerCase())
    );

    return (
      <div className={cn('search-bar', className)} ref={dropdownRef}>
        <span className="search-icon">
          <Search className="w-4 h-4" />
        </span>
        <input
          ref={inputRef}
          type="text"
          className="search-input input"
          placeholder={placeholder}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          {...props}
        />
        {displayValue && (
          <button
            className="search-clear"
            onClick={handleClear}
            type="button"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {showDropdown && filteredSuggestions.length > 0 && (
          <div className="search-dropdown">
            {filteredSuggestions.slice(0, 8).map((s, i) => (
              <button
                key={i}
                className="search-dropdown-item"
                type="button"
                onMouseDown={() => handleSelect(s)}
              >
                <Search className="w-4 h-4 text-warm-gray-3" style={{ color: 'var(--warm-gray-3)' }} />
                <span>{s}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

SearchBar.displayName = 'SearchBar';

export { SearchBar };
