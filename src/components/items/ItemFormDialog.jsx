import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BRAND_LABELS } from '@/lib/labels';

const EMPTY_FORM = { item_number: '', item_name: '', brand: 'other', cost: '' };

const BRAND_OPTIONS = ['hyundai', 'kia', 'other'];

/**
 * نافذة إضافة/تعديل صنف — مستقلة لتقليل حجم صفحة الأصناف.
 */
export default function ItemFormDialog({ open, onOpenChange, item, onSubmit, busy = false }) {
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    setFormData(
      item
        ? {
            item_number: item.item_number || '',
            item_name: item.item_name || '',
            brand: item.brand || 'other',
            cost: item.cost?.toString() || '',
          }
        : EMPTY_FORM,
    );
  }, [open, item]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit?.(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-brand">{item ? 'تعديل الصنف' : 'إضافة صنف جديد'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>رقم الصنف</Label>
            <Input
              placeholder="مثال: 97701-F1500"
              value={formData.item_number}
              onChange={(event) => setFormData({ ...formData, item_number: event.target.value })}
              required
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>اسم الصنف</Label>
            <Input
              placeholder="اسم الصنف"
              value={formData.item_name}
              onChange={(event) => setFormData({ ...formData, item_name: event.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>الماركة</Label>
              <Select value={formData.brand} onValueChange={(value) => setFormData({ ...formData, brand: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {BRAND_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التكلفة</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.cost}
                onChange={(event) => setFormData({ ...formData, cost: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={busy} className="bg-brand hover:opacity-90">
              {busy ? 'جاري الحفظ...' : item ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
