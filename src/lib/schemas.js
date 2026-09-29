/**
 * schemas.js — تحقق المدخلات بنمط واحد (zod) بدل التحقق اليدوي المتفرق.
 */
import { z } from 'zod';

const numberFromInput = (schema) =>
  z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }, schema);

export const itemSchema = z.object({
  item_number: z
    .string({ required_error: 'رقم الصنف مطلوب' })
    .trim()
    .min(1, 'رقم الصنف مطلوب')
    .max(60, 'رقم الصنف طويل جدًا'),
  item_name: z
    .string({ required_error: 'اسم الصنف مطلوب' })
    .trim()
    .min(1, 'اسم الصنف مطلوب')
    .max(200, 'اسم الصنف طويل جدًا'),
  brand: z.enum(['hyundai', 'kia', 'other']).default('other'),
  cost: numberFromInput(z.number({ invalid_type_error: 'التكلفة يجب أن تكون رقمًا' }).min(0, 'التكلفة لا يمكن أن تكون سالبة').max(99_999_999, 'التكلفة كبيرة جدًا')).default(0),
});

export const purchaseOrderHeaderSchema = z.object({
  order_number: z.string().trim().max(60, 'رقم الطلب طويل جدًا').optional().or(z.literal('')),
  order_date: z.string().trim().min(1, 'تاريخ الطلب مطلوب'),
  supplier_name: z.string().trim().min(1, 'اسم المورد مطلوب').max(200, 'اسم المورد طويل جدًا'),
  notes: z.string().trim().max(1000, 'الملاحظات طويلة جدًا').optional().or(z.literal('')),
});

export const purchaseOrderItemSchema = z.object({
  item_id: z.string().trim().min(1, 'يجب اختيار الصنف'),
  item_number: z.string().trim().min(1, 'رقم الصنف مطلوب'),
  item_name: z.string().trim().min(1, 'اسم الصنف مطلوب'),
  quantity_ordered: numberFromInput(
    z.number({ invalid_type_error: 'الكمية يجب أن تكون رقمًا' }).positive('الكمية يجب أن تكون أكبر من صفر'),
  ),
  unit_cost: numberFromInput(z.number().min(0, 'التكلفة لا يمكن أن تكون سالبة')).default(0),
});

export const purchaseOrderSchema = z.object({
  order: purchaseOrderHeaderSchema,
  items: z.array(purchaseOrderItemSchema).min(1, 'يجب إضافة صنف واحد على الأقل'),
});

export const goodsReceiptHeaderSchema = z.object({
  receipt_number: z.string().trim().max(60, 'رقم الإذن طويل جدًا').optional().or(z.literal('')),
  receipt_date: z.string().trim().min(1, 'تاريخ ووقت الاستلام مطلوب'),
  notes: z.string().trim().max(1000, 'الملاحظات طويلة جدًا').optional().or(z.literal('')),
});

export const goodsReceiptSchema = z.object({
  order_id: z.string().trim().min(1, 'يجب تحديد طلب الشراء'),
  receipt: goodsReceiptHeaderSchema,
  items: z
    .array(
      z.object({
        order_item_id: z.string().trim().min(1),
        quantity_received: numberFromInput(z.number().min(0, 'الكمية لا يمكن أن تكون سالبة')),
      }),
    )
    .refine((list) => list.some((entry) => Number(entry.quantity_received) > 0), {
      message: 'يجب تحديد كمية لصنف واحد على الأقل',
    }),
});

export const settingsSchema = z.object({
  system_name: z.string().trim().min(1, 'اسم النظام مطلوب').max(120, 'اسم النظام طويل جدًا'),
  logo_url: z.string().trim().url('رابط الشعار غير صحيح').optional().or(z.literal('')),
  show_logo_interface: z.boolean().default(true),
  show_logo_reports: z.boolean().default(true),
  show_logo_print: z.boolean().default(true),
});

export const stockAdjustmentSchema = z.object({
  item_id: z.string().trim().min(1),
  new_quantity: numberFromInput(z.number().min(0, 'الرصيد لا يمكن أن يكون سالبًا')),
  note: z.string().trim().max(300, 'السبب طويل جدًا').optional().or(z.literal('')),
});

/**
 * يُرجع أول رسالة خطأ مقروءة، أو null إذا كانت البيانات صحيحة.
 */
export const firstValidationError = (result) => {
  if (result.success) return null;
  const issue = result.error.issues[0];
  if (!issue) return 'تحقق من البيانات المُدخلة.';

  const rawPath = issue.path;
  const itemsIndex = rawPath.indexOf('items');
  const itemNumber = itemsIndex !== -1 ? Number(rawPath[itemsIndex + 1]) : null;

  if (itemsIndex !== -1 && Number.isInteger(itemNumber)) {
    return `البند ${itemNumber + 1}: ${issue.message}`;
  }

  const fieldLabels = {
    order_number: 'رقم الطلب',
    order_date: 'تاريخ الطلب',
    supplier_name: 'اسم المورد',
    receipt_date: 'تاريخ الاستلام',
    receipt_number: 'رقم الإذن',
    item_number: 'رقم الصنف',
    item_name: 'اسم الصنف',
    quantity_ordered: 'الكمية المطلوبة',
    quantity_received: 'الكمية المستلمة',
    unit_cost: 'تكلفة الوحدة',
    cost: 'التكلفة',
    system_name: 'اسم النظام',
    new_quantity: 'الرصيد الجديد',
  };

  const last = rawPath[rawPath.length - 1];
  if (typeof last !== 'string') return issue.message;
  return `${fieldLabels[last] || last}: ${issue.message}`;
};

