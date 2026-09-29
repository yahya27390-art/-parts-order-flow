import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * ترقيم صفحات موحّد للجداول (كانت الجداول تعرض كل الصفوف بلا ترقيم).
 */
export default function TablePagination({
  page = 1,
  pageSize = 25,
  total = 0,
  hasMore = false,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span>
          {total === 0 ? 'لا توجد نتائج' : `${from} - ${to} من ${total}`}
        </span>
        {onPageSizeChange ? (
          <label className="flex items-center gap-2">
            <span className="text-xs">عدد الصفوف</span>
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>
          السابق
        </Button>
        <span className="px-2 text-xs">
          صفحة {page} من {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore && page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
        >
          التالي
        </Button>
      </div>
    </div>
  );
}
