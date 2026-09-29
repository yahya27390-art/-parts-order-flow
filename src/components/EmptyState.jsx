import React from 'react';
import { cn } from '@/lib/utils';

/**
 * حالة فراغ موحّدة مع إمكانية إضافة إجراء (زر) — بدل تكرار نفس الكتلة في كل جدول.
 */
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      {Icon ? <Icon className="mb-4 h-12 w-12 text-slate-300" /> : null}
      <p className="font-medium text-slate-600">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
