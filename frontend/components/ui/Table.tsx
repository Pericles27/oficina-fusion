'use client';

import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  CSSProperties,
  MouseEventHandler,
} from 'react';
import { cn } from '@/lib/utils';

/* ─── Table ─── */

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  striped?: boolean;
  stickyHeader?: boolean;
  children: ReactNode;
}

const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ striped = true, stickyHeader = false, className = '', children, ...props }, ref) => (
    <div className={cn('overflow-auto scrollbar', 'w-full')}>
      <table
        ref={ref}
        className={cn('table', stickyHeader && 'table-sticky', striped && 'table-striped', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  )
);

Table.displayName = 'Table';

/* ─── TableHeader ─── */

export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ children, className = '', ...props }, ref) => (
    <thead ref={ref} className={cn('table-header', className)} {...props}>
      {children}
    </thead>
  )
);

TableHeader.displayName = 'TableHeader';

/* ─── TableBody ─── */

export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ children, className = '', ...props }, ref) => (
    <tbody ref={ref} className={cn(className)} {...props}>
      {children}
    </tbody>
  )
);

TableBody.displayName = 'TableBody';

/* ─── TableCaption ─── */

export interface TableCaptionProps extends HTMLAttributes<HTMLTableCaptionElement> {
  children: ReactNode;
}

const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ children, className = '', ...props }, ref) => (
    <caption ref={ref} className={cn('text-sm text-warm-gray-3 py-2', className)} style={{ color: 'var(--warm-gray-3)' }} {...props}>
      {children}
    </caption>
  )
);

TableCaption.displayName = 'TableCaption';

/* ─── TableRow ─── */

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  hover?: boolean;
  clickable?: boolean;
  onClick?: MouseEventHandler<HTMLTableRowElement>;
  children: ReactNode;
}

const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ hover = true, clickable = false, onClick, children, className = '', ...props }, ref) => {
    const combinedClass = cn(
      'table-row',
      clickable && 'cursor-pointer',
      className
    );

    return (
      <tr
        ref={ref}
        className={combinedClass}
        onClick={clickable ? onClick : undefined}
        style={clickable ? { cursor: 'pointer' } : undefined}
        {...props}
      >
        {children}
      </tr>
    );
  }
);

TableRow.displayName = 'TableRow';

/* ─── TableCell ─── */

export interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  children: ReactNode;
}

const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ numeric = false, children, className = '', ...props }, ref) => (
    <td
      ref={ref}
      className={cn('table-cell', numeric && 'text-right tabular', className)}
      {...props}
    >
      {children}
    </td>
  )
);

TableCell.displayName = 'TableCell';

/* ─── TableHeadCell ─── */

export interface TableHeadCellProps extends HTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  ascending?: boolean;
  onClick?: MouseEventHandler<HTMLTableCellElement>;
  children: ReactNode;
}

const TableHeadCell = forwardRef<HTMLTableCellElement, TableHeadCellProps>(
  ({ sortable = false, ascending, onClick, children, className = '', ...props }, ref) => {
    const combinedClass = cn(
      'table-head-cell',
      sortable && 'cursor-pointer select-none',
      className
    );

    return (
      <th
        ref={ref}
        className={combinedClass}
        role={sortable ? 'button' : undefined}
        tabIndex={sortable ? 0 : undefined}
        aria-sort={
          sortable
            ? ascending
              ? 'ascending'
              : 'descending'
            : undefined
        }
        aria-label={sortable ? `Ordenar por ${children}` : undefined}
        onClick={sortable ? onClick : undefined}
        onKeyDown={
          sortable
            ? (e: React.KeyboardEvent<HTMLTableCellElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.(e as unknown as React.MouseEvent<HTMLTableCellElement>);
                }
              }
            : undefined
        }
        {...props}
      >
        {children}
      </th>
    );
  }
);

TableHeadCell.displayName = 'TableHeadCell';

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableCaption,
  TableHeadCell,
};
