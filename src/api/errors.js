/**
 * errors.js — تحويل أخطاء Supabase ورسائل دوال قاعدة البيانات إلى رسائل عربية
 * واضحة للمستخدم، مع تصنيف الأخطاء لتعرف الواجهة هل يجب الرجوع للمسار القديم.
 */

// رسائل مرفوعة من دوال قاعدة البيانات (RPC) عبر raise exception '<TOKEN>'.
const RPC_MESSAGES = {
  AUTH_REQUIRED: 'انتهت جلسة الدخول. يرجى تسجيل الدخول من جديد.',
  USER_NOT_ACTIVE: 'حسابك غير مُفعَّل في النظام. تواصل مع مدير النظام.',
  INSUFFICIENT_ROLE: 'لا تملك صلاحية تنفيذ هذه العملية (تحتاج صلاحية أمين مستودع أو مدير).',
  ORDER_REQUIRES_ITEMS: 'يجب إضافة صنف واحد على الأقل في الطلب.',
  ORDER_REQUIRED: 'يجب تحديد طلب الشراء المرتبط بالمستند.',
  ORDER_NOT_FOUND: 'لم يتم العثور على طلب الشراء.',
  ORDER_ITEM_NOT_FOUND: 'أحد بنود الطلب لم يعد موجودًا، حدّث الصفحة ثم حاول مرة أخرى.',
  ORDER_CANCELLED: 'لا يمكن تعديل طلب ملغي.',
  ORDER_ALREADY_CANCELLED: 'الطلب ملغي مسبقًا.',
  ORDER_HAS_RECEIPTS: 'لا يمكن حذف الطلب لوجود إذونات استلام مرتبطة به. يمكنك إلغاؤه بدلًا من حذفه.',
  ITEM_REQUIRED: 'يجب اختيار الصنف لكل بند.',
  ITEM_NOT_FOUND: 'الصنف غير موجود في دليل الأصناف.',
  INVALID_QUANTITY: 'الكمية غير صحيحة، يجب أن تكون أكبر من صفر.',
  QUANTITY_BELOW_RECEIVED: 'لا يمكن أن تكون الكمية المطلوبة أقل من الكمية المستلمة فعليًا.',
  CANNOT_DELETE_RECEIVED_ITEM: 'لا يمكن حذف بند تم استلام جزء منه. عدّل الكمية بدل الحذف.',
  RECEIPT_REQUIRES_ITEMS: 'يجب تحديد كمية لصنف واحد على الأقل.',
  RECEIPT_NOT_FOUND: 'لم يتم العثور على إذن الاستلام.',
  RECEIPT_ITEM_NOT_FOUND: 'أحد بنود إذن الاستلام لم يعد موجودًا، حدّث الصفحة ثم حاول مرة أخرى.',
  RECEIPT_ALREADY_VOIDED: 'إذن الاستلام ملغي مسبقًا.',
};

// أخطاء PostgreSQL القياسية.
const PG_ERRORS = {
  '23505': 'توجد قيمة مكررة محفوظة مسبقًا. تأكد من رقم المستند أو رقم الصنف.',
  '23503': 'لا يمكن تنفيذ العملية لارتباط السجل بمستندات أخرى.',
  '23514': 'إحدى القيم خارج النطاق المسموح به. تحقق من الكميات والتكاليف.',
  '42501': 'لا تملك صلاحية تنفيذ هذه العملية.',
  '22023': 'إحدى القيم المُرسلة غير صحيحة.',
  'P0001': 'تعذّر تنفيذ العملية على قاعدة البيانات.',
};

// رموز تعني أن دوال قاعدة البيانات المطوّرة غير مُطبَّقة بعد.
const MISSING_RPC_CODES = ['PGRST202', 'PGRST203', '42883', '404'];
const MISSING_RPC_HINTS = ['could not find the function', 'function public.', 'does not exist'];

export const isMissingRpcError = (error) => {
  if (!error) return false;
  const code = String(error.code || '');
  if (MISSING_RPC_CODES.includes(code)) return true;

  const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return MISSING_RPC_HINTS.some((hint) => message.includes(hint));
};

export const isConfigurationError = (error) =>
  Boolean(error && (error.name === 'SupabaseConfigurationError' || error.code === 'CONFIG_MISSING'));

export const isPermissionError = (error) => {
  if (!error) return false;
  const code = String(error.code || '');
  return code === '42501' || String(error.message || '').includes('INSUFFICIENT_ROLE');
};

export const isAuthError = (error) => {
  if (!error) return false;
  const code = String(error.code || '');
  return code === '401' || code === 'PGRST301' || code === '42501' || code === 'PGRST116';
};

/**
 * يحوّل أي خطأ (Supabase / RPC / شبكة) إلى رسالة عربية قابلة للعرض.
 */
export const getErrorMessage = (error, fallback = 'حدث خطأ غير متوقع. حاول مرة أخرى.') => {
  if (!error) return fallback;

  if (isConfigurationError(error)) {
    return 'إعدادات قاعدة البيانات غير مكتملة. تأكد من وجود VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.';
  }

  const rawMessage = String(error.message || '').trim();
  const token = rawMessage.toUpperCase().replace(/^ERROR:\s*/, '').split('\n')[0].trim();
  if (RPC_MESSAGES[token]) return RPC_MESSAGES[token];

  if (PG_ERRORS[String(error.code || '')]) {
    return PG_ERRORS[String(error.code || '')];
  }

  if (isMissingRpcError(error)) {
    return 'ميزات قاعدة البيانات المطوّرة غير مُفعَّلة بعد. طبّق ملفات الترحيل في مجلد supabase/migrations.';
  }

  if (rawMessage.toLowerCase().includes('failed to fetch') || rawMessage.toLowerCase().includes('networkerror')) {
    return 'تعذّر الاتصال بالخادم. تحقق من اتصال الإنترنت ثم أعد المحاولة.';
  }

  if (rawMessage.toLowerCase().includes('invalid login credentials')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }

  if (rawMessage.toLowerCase().includes('email not confirmed')) {
    return 'البريد الإلكتروني غير مُؤكَّد. افحص بريدك لتأكيد الحساب.';
  }

  return rawMessage || fallback;
};

export class SupabaseConfigurationError extends Error {
  constructor(message = 'إعدادات قاعدة البيانات غير مكتملة.') {
    super(message);
    this.name = 'SupabaseConfigurationError';
    this.code = 'CONFIG_MISSING';
  }
}
