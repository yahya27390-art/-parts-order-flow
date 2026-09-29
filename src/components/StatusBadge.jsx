import React from 'react';
import { cn } from '@/lib/utils';
import { ORDER_STATUS, DISCREPANCY_STATUS, STOCK_STATUS, STOCK_MOVEMENT_TYPE } from '@/lib/labels';

const DICTIONARIES = {
  order: ORDER_STATUS,
  discrepancy: DISCREPANCY_STATUS,
  stock: STOCK_STATUS,
  movement: STOCK_MOVEMENT_TYPE,
};

/**
 * شارة حالة موحّدة (كانت مكرّرة في ٤ صفحات كدالة getStatusBadge).
 */
export default function StatusBadge({ type = 'order', status, fallback, className = '' }) {
  const dictionary = DICTIONARIES[type] || ORDER_STATUS;
  const entry = dictionary[status];
  const label = entry?.label || fallback || status || '-';
  const styles = entry?.className || 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium',
        styles,
        className,
      )}
    >
      {label}
    </span>
  );
}
