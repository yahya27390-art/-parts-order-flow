import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatQuantity, toNumber } from '@/lib/format';

/**
 * تسوية رصيد صنف يدويًا (جرد/تصحيح) — كانت غير متاحة إطلاقًا في النظام.
 * كل تسوية تُسجَّل كحركة مخزون موثّقة عند تطبيق ترحيل دفتر الحركات.
 */
export default function StockAdjustDialog({ open, onOpenChange, item, onSubmit, busy = false }) {
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open || !item) return;
    setQuantity(String(toNumber(item.current_stock)));
    setNote('');
  }, [open, item]);

  const delta = toNumber(quantity) - toNumber(item?.current_stock);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit?.({ item_id: item.id, new_quantity: toNumber(quantity), note });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-brand">تسوية رصيد المخزون</DialogTitle>
        </DialogHeader>
        {item ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-700">{item.item_name}</p>
              <p dir="ltr" className="font-mono text-xs text-slate-500">
                {item.item_number}
              </p>
              <p className="mt-2 text-slate-500">
                الرصيد الحالي: <span className="font-bold">{formatQuantity(item.current_stock)}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>الرصيد الصحيح بعد الجرد</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
              <p className={`text-xs ${delta === 0 ? 'text-slate-400' : delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {delta === 0 ? 'لا يوجد تغيير' : `الفرق: ${delta > 0 ? '+' : ''}${formatQuantity(delta)}`}
              </p>
            </div>
            <div className="space-y-2">
              <Label>السبب / الملاحظات</Label>
              <Input
                placeholder="مثال: نتيجة الجرد الفعلي"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={busy || delta === 0} className="bg-brand hover:opacity-90">
                {busy ? 'جاري الحفظ...' : 'حفظ التسوية'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
