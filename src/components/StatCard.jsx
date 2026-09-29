import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * بطاقة مؤشر موحّدة (كانت مكرّرة يدويًا في لوحة التحكم والمخزون).
 */
export default function StatCard({ title, value, icon: Icon, tone = 'brand', hint, className = '' }) {
  const tones = {
    brand: { bg: 'bg-brand', text: 'text-brand' },
    accent: { bg: 'bg-brand-accent', text: 'text-brand-accent' },
    mid: { bg: 'bg-brand-mid', text: 'text-brand-mid' },
    deep: { bg: 'bg-brand-dark', text: 'text-brand-deep' },
    danger: { bg: 'bg-red-500', text: 'text-red-600' },
    warning: { bg: 'bg-amber-500', text: 'text-amber-600' },
    success: { bg: 'bg-emerald-600', text: 'text-emerald-600' },
  };

  const toneStyles = tones[tone] || tones.brand;

  return (
    <Card className={cn('border-0 shadow-sm', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">{title}</p>
            <p className={cn('mt-1 truncate text-2xl font-bold', tone$.text)}>{value}</p>
            {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
          </div>
          {Icon ? (
            <div className={cn('shrink-0 rounded-xl p-3 text-white', tone$.bg)}>
              <Icon className="h-6 w-6" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
