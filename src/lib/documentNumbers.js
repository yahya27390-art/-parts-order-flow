/**
 * documentNumbers.js — توليد أرقام المستندات في المسار البديل فقط.
 *
 * المصدر الأساسي هو دالة قاعدة البيانات next_document_number (تسلسل ذري
 * بصيغة PO-202609-0001). هذا الملف يُستخدم عندما تكون ملفات الترحيل غير
 * مُطبَّقة بعد، ويعتمد على الطابع الزمني لمنع التعارض.
 */
import { monthPeriodKey } from '@/lib/format';

export const DOCUMENT_PREFIX = { ORDER: 'PO', RECEIPT: 'GR' };

/** لاحقة فريدة مبنية على الزمن (٦ أرقام) — أدق بكثير من رقم عشوائي من ٣ أرقام. */
export const uniqueSuffix = (date = new Date()) => {
  const stamp = `${date.getHours()}${date.getMinutes()}${date.getSeconds()}${String(date.getMilliseconds()).padStart(3, '0')}`;
  return stamp.slice(-6);
};

export const generateDocumentNumber = (prefix, date = new Date()) =>
  `${prefix}-${monthPeriodKey(date)}-${uniqueSuffix(date)}`;

export const generateOrderNumber = (date = new Date()) => generateDocumentNumber(DOCUMENT_PREFIX.ORDER, date);

export const generateReceiptNumber = (date = new Date()) => generateDocumentNumber(DOCUMENT_PREFIX.RECEIPT, date);
