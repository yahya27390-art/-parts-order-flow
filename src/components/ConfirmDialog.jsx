import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * نافذة تأكيد موحّدة (بديل window.confirm الذي كان مستخدمًا في صفحة الأصناف).
 * تدعم حقل سبب اختياريًا/إلزاميًا للعمليات الحساسة مثل الإلغاء والحذف.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  destructive = false,
  reasonLabel,
  reasonRequired = false,
  onConfirm,
  busy = false,
}) {
  const [reason, setReason] = useState('');

  const handleConfirm = async () => {
    if (reasonRequired && !reason.trim()) return;
    await onConfirm?.(reason.trim());
    setReason('');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>

        {reasonLabel ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Input
              id="confirm-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="اكتب السبب..."
            />
          </div>
        ) : null}

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || (reasonRequired && !reason.trim())}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
            className={destructive ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-brand hover:opacity-90'}
          >
            {busy ? 'جاري التنفيذ...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
