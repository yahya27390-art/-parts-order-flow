import React from 'react';
import { cn } from '@/lib/utils';

/**
 * عنوان صفحة موحّد مع أزرار الإجراءات (كان مكررًا في كل صفحة).
 */
export default function PageHeader({ title, subtitle, icon: Icon, actions, className = '' }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex items-center gap-3">
        {Icon ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold text-brand">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
