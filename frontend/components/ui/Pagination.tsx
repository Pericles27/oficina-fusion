'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  className?: string;
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = (): (number | '...')[] => {
    // En pantallas chicas mostramos menos números
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const out: (number | '...')[] = [1];
    if (currentPage > 3) out.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      out.push(i);
    }
    if (currentPage < totalPages - 2) out.push('...');
    out.push(totalPages);
    return out;
  };

  return (
    <nav className={cn('pagination', className)} aria-label="Paginación">
      <button
        className="btn btn-icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Página anterior"
      >
        <ChevronLeft className="w-[18px] h-[18px]" />
      </button>

      {pages().map((p, i) =>
        p === '...' ? (
          <span key={`e-${i}`} className="page-ellipsis">…</span>
        ) : (
          <button
            key={p}
            className={`btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-ghost'}`}
            style={{ minWidth: 38 }}
            onClick={() => onPageChange(p)}
            aria-label={`Página ${p}`}
            aria-current={p === currentPage ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        className="btn btn-icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Página siguiente"
      >
        <ChevronRight className="w-[18px] h-[18px]" />
      </button>
    </nav>
  );
}

export { Pagination };
