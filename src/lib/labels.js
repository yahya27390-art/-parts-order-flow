/**
 * labels.js — مصدر واحد لكل التسميات والألوان (كانت مكرّرة في ٤ صفحات مختلفة).
 */
export const ORDER_STATUS = {
  pending: { label: 'معلق', className: 'bg-amber-50 text-amber-700 border-amber-200', color: '#d4a853' },
  partial: { label: 'جزئي', className: 'bg-blue-50 text-blue-700 border-blue-200', color: '#4d82b8' },
  completed: { label: 'مكتمل', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', color: '#2f8f6b' },
  cancelled: { label: 'ملغي', className: 'bg-red-50 text-red-700 border-red-200', color: '#c45b5b' },
};

export const getOrderStatusLabel = (status) => ORDER_STATUS[status]?.label || status || '-';
export const getOrderStatusClassName = (status) => ORDER_STATUS[status]?.className || ORDER_STATUS.pending.className;
export const getOrderStatusColor = (status) => ORDER_STATUS[status]?.color || ORDER_STATUS.pending.color;

export const DISCREPANCY_STATUS = {
  excess: { label: 'زيادة', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  shortage: { label: 'نقص', className: 'bg-red-50 text-red-700 border-red-200' },
  complete: { label: 'مكتمل', className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export const STOCK_STATUS = {
  negative: { label: 'رصيد سالب', className: 'bg-red-50 text-red-700 border-red-200' },
  out: { label: 'غير متوفر', className: 'bg-red-50 text-red-700 border-red-200' },
  low: { label: 'منخفض', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ok: { label: 'متاح', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

/** الحد الذي يعتبر ما دونه مخزونًا منخفضًا (كان مكتوبًا ٥ في عدة ملفات). */
export const LOW_STOCK_THRESHOLD = 5;

export const STOCK_MOVEMENT_TYPE = {
  opening_balance: { label: 'رصيد افتتاحي', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  receipt: { label: 'استلام', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  receipt_excess: { label: 'استلام زائد', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  adjustment: { label: 'تسوية', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  return_to_supplier: { label: 'إرجاع للمورد', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  issue: { label: 'صرف', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  reversal: { label: 'عكس قيد', className: 'bg-red-50 text-red-700 border-red-200' },
};

export const BRAND_LABELS = {
  hyundai: 'هيونداي',
  kia: 'كيا',
  other: 'أخرى',
};

export const ROLE_LABELS = {
  admin: 'مدير النظام',
  storekeeper: 'أمين مستودع',
  viewer: 'قارئ فقط',
};

export const ROLE_DESCRIPTIONS = {
  admin: 'كل الصلاحيات بما فيها الإعدادات والمستخدمون والحذف',
  storekeeper: 'إدارة الطلبات والاستلام والأصناف بدون إعدادات النظام',
  viewer: 'عرض وتقارير فقط بدون أي تعديل',
};

export const canWrite = (role) => role === 'admin' || role === 'storekeeper';
export const isAdminRole = (role) => role === 'admin';
