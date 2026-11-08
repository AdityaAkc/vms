"use client";

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

/**
 * Generic table with sorting + pagination. On small screens rows render as
 * cards via `renderCard`, so wide tables never force horizontal scrolling
 * for primary workflows.
 */
export function DataTable<T>({
  columns,
  data,
  onRowClick,
  renderCard,
  initialSorting = [],
  pageSize = 10,
  empty,
  getRowLabel,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  onRowClick?: (row: T) => void;
  renderCard?: (row: T) => React.ReactNode;
  initialSorting?: SortingState;
  pageSize?: number;
  empty?: React.ReactNode;
  getRowLabel?: (row: T) => string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });

  const rows = table.getRowModel().rows;
  const total = data.length;
  const start = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const end = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);

  if (total === 0) {
    return <div className="rounded-xl border bg-card">{empty ?? <EmptyState title="Nothing to show" />}</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Desktop table */}
      <div className={cn("overflow-x-auto", renderCard && "hidden md:block")}>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className="h-9 px-3 text-left text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-4 last:pr-4"
                    >
                      {h.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" aria-hidden />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row.original);
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick && getRowLabel ? getRowLabel(row.original) : undefined}
                className={cn(
                  "border-b last:border-0",
                  onRowClick && "cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/60 outline-none",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="h-12 px-3 align-middle whitespace-nowrap first:pl-4 last:pr-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      {renderCard && (
        <ul className="divide-y md:hidden">
          {rows.map((row) => (
            <li key={row.id}>
              {onRowClick ? (
                <button
                  type="button"
                  className="block w-full p-4 text-left hover:bg-muted/40 focus-visible:bg-muted/60 outline-none"
                  onClick={() => onRowClick(row.original)}
                >
                  {renderCard(row.original)}
                </button>
              ) : (
                <div className="p-4">{renderCard(row.original)}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      <div className="flex flex-col gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="tabular">
          Showing {start}–{end} of {total}
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows</span>
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(v) => setPagination({ pageIndex: 0, pageSize: Number(v) })}
          >
            <SelectTrigger size="sm" className="w-16" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="tabular px-1">
            Page {pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
