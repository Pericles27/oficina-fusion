'use client';

import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  useState,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  showItemsPerPage?: boolean;
  itemsPerPageOptions?: number[];
  className?: string;
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage = 10,
  showItemsPerPage = false,
  itemsPerPageOptions = [5, 10, 20, 50],
  className = '',
}: PaginationProps) {
  const [perPage, setPerPage] = useState(itemsPerPage);

  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages: (number | '...')[] = [];

    // Always show first page
    pages.push(1);

    if (currentPage > 3) {
      pages.push('...');
    }

    // Show pages around current
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();
  const startItem = (currentPage - 1) * perPage + 1;
  const endItem = Math.min(currentPage * perPage, totalItems || 0);

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-4 py-4', className)}>
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--warm-gray-2)' }}>
        <span>Mostrar</span>
        {showItemsPerPage && (
          <select
            className="input input-sm"
            style={{ width: 'auto' }}
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            aria-label="Elementos por página"
          >
            {itemsPerPageOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
        <span>de</span>
        <span className="font-medium">{totalItems || 0}</span>
        <span>elementos</span>
        <span style={{ color: 'var(--warm-gray-3)' }}>
          ({startItem}–{endItem})
        </span>
      </div>

      {totalPages > 1 && (
        <nav className="pagination" aria-label="Paginación">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Página anterior"
            className="!px-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {pageNumbers.map((page, i) =>
            page === '...' ? (
              <span key={`ellipsis-${i}`} className="page-ellipsis">
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={page === currentPage ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => onPageChange(page as number)}
                className={page === currentPage ? '' : ''}
                aria-label={`Página ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </Button>
            )
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Página siguiente"
            className="!px-2"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}

export { Pagination };
