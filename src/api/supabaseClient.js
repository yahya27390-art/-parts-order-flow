import { createClient } from '@supabase/supabase-js';
import { SupabaseConfigurationError } from './errors';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const TABLES = {
  Item: 'items',
  PurchaseOrder: 'purchase_orders',
  PurchaseOrderItem: 'purchase_order_items',
  GoodsReceipt: 'goods_receipts',
  GoodsReceiptItem: 'goods_receipt_items',
  SystemSettings: 'system_settings',
  StockMovement: 'stock_movements',
  Profile: 'profiles',
};

// عروض تجميعية على الخادم (تُقلّل حجم البيانات المنقولة إلى المتصفح).
export const VIEWS = {
  Inventory: 'v_inventory',
  OrderFulfillment: 'v_order_fulfillment',
  SupplierDiscrepancies: 'v_supplier_discrepancies',
};

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

export const requireSupabase = () => {
  if (!supabase) throw new SupabaseConfigurationError();
  return supabase;
};

const unwrap = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

const normalizeOrder = (order) => {
  const raw = typeof order === 'string' && order.length > 0 ? order : '-created_date';
  const ascending = raw.startsWith('+');
  const column = raw.replace(/^[-+]/, '');
  return { column, ascending };
};

/** تنظيف نص البحث قبل تمريره إلى PostgREST (منع كسر تعبير or/ilike). */
export const sanitizeSearchTerm = (term = '') => String(term).replace(/[,()%\\]/g, ' ').trim();

export const clampPageSize = (size) => {
  const parsed = Number.parseInt(size, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
};

/**
 * قراءة عامة مع فلترة وبحث وترتيب وترقيم صفحات من الخادم.
 * تعيد { rows, total, page, pageSize, hasMore }.
 */
export const selectRows = async (
  source,
  {
    columns = '*',
    filters = {},
    search = '',
    searchColumns = [],
    order = '-created_date',
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    withCount = true,
    single = false,
  } = {},
) => {
  const client = requireSupabase();
  const size = clampPageSize(pageSize);
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const { column, ascending } = normalizeOrder(order);

  let query = client.from(source).select(columns, withCount ? { count: 'exact' } : undefined);

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === '') return;

    if (value === null) {
      query = query.is(key, null);
      return;
    }

    if (Array.isArray(value)) {
      query = query.in(key, value);
      return;
    }

    // دعم فلاتر المدى: { gte, lte, gt, lt, neq, like, ilike }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([operator, operand]) => {
        if (operand === undefined || operand === null || operand === '') return;
        if (['gte', 'lte', 'gt', 'lt', 'neq', 'like', 'ilike'].includes(operator)) {
          query = query[operator](key, operand);
        }
      });
      return;
    }

    query = query.eq(key, value);
  });

  const term = sanitizeSearchTerm(search);
  if (term && searchColumns.length > 0) {
    const pattern = `%${term}%`;
    query = query.or(searchColumns.map((col) => `${col}.ilike.${pattern}`).join(','));
  }

  query = query.order(column, { ascending });

  if (single) {
    const { data, error } = await query.limit(1);
    if (error) throw error;
    return { rows: data ?? [], total: data?.length ?? 0, page: 1, pageSize: 1, hasMore: false };
  }

  const from = (safePage - 1) * size;
  const { data, error, count } = await query.range(from, from + size - 1);
  if (error) throw error;

  const total = typeof count === 'number' ? count : (data?.length ?? 0);

  return {
    rows: data ?? [],
    total,
    page: safePage,
    pageSize: size,
    hasMore: from + (data?.length ?? 0) < total,
  };
};

/** قراءة كل الصفوف المطابقة على دفعات (للتقارير المجمّعة الصغيرة). */
export const selectAllRows = async (source, options = {}) => {
  const pages = [];
  let page = 1;
  let result;

  do {
    result = await selectRows(source, { ...options, page, pageSize: MAX_PAGE_SIZE, withCount: false });
    pages.push(...result.rows);
    page += 1;
  } while (result.rows.length === MAX_PAGE_SIZE && page <= 20);

  return pages;
};

/** عدد الصفوف المطابقة بدون نقل البيانات (لتقارير لوحة التحكم). */
export const countRows = async (source, filters = {}) => {
  const client = requireSupabase();
  let query = client.from(source).select('*', { count: 'exact', head: true });

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query = Array.isArray(value) ? query.in(key, value) : query.eq(key, value);
  });

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

// ---------------------------------------------------------------------------
// واجهة الكيانات (متوافقة مع الاستخدام القديم list/filter/create/update/delete)
// ---------------------------------------------------------------------------
const createEntity = (entityName) => {
  const table = TABLES[entityName];

  return {
    table,

    async list(order = '-created_date', limit) {
      const client = requireSupabase();
      const { column, ascending } = normalizeOrder(order);
      let query = client.from(table).select('*').order(column, { ascending });
      if (limit) query = query.limit(limit);
      return (await unwrap(query)) ?? [];
    },

    async filter(filters) {
      const client = requireSupabase();
      let query = client.from(table).select('*');
      Object.entries(filters || {}).forEach(([column, value]) => {
        query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
      });
      return (await unwrap(query)) ?? [];
    },

    async find(filters) {
      const [row] = await this.filter(filters);
      return row ?? null;
    },

    async page(options = {}) {
      return selectRows(table, options);
    },

    async count(filters = {}) {
      return countRows(table, filters);
    },

    async create(values) {
      const client = requireSupabase();
      return unwrap(client.from(table).insert(values).select().single());
    },

    async createMany(values) {
      const client = requireSupabase();
      return unwrap(client.from(table).insert(values).select());
    },

    async update(id, values) {
      const client = requireSupabase();
      return unwrap(client.from(table).update(values).eq('id', id).select().single());
    },

    async delete(id) {
      const client = requireSupabase();
      return unwrap(client.from(table).delete().eq('id', id));
    },
  };
};

export const entities = Object.fromEntries(Object.keys(TABLES).map((name) => [name, createEntity(name)]));

// ---------------------------------------------------------------------------
// استدعاء دوال قاعدة البيانات (RPC)
// ---------------------------------------------------------------------------
export const callRpc = async (name, args = {}) => {
  const client = requireSupabase();
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
};

let rpcAvailability = null;

/**
 * هل ملفات الترحيل المطوّرة (دفتر الحركات والدوال الذرية) مُطبَّقة على القاعدة؟
 * تُفحص مرة واحدة لكل جلسة، وعند غيابها تعمل الواجهة بمسار بديل متوافق.
 */
export const isStockRpcAvailable = () => {
  if (!rpcAvailability) {
    rpcAvailability = callRpc('stock_api_version')
      .then(() => true)
      .catch(() => false);
  }
  return rpcAvailability;
};

// ---------------------------------------------------------------------------
// المستخدم الحالي ودوره (يُقرأ من جدول profiles وليس من بيانات قابلة للتعديل)
// ---------------------------------------------------------------------------
const LEGACY_FALLBACK_ROLE = 'admin';

export const getCurrentUser = async () => {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data?.user) return null;

  const { id, email, user_metadata: metadata } = data.user;
  let profile = null;

  const { data: profileRow, error: profileError } = await client
    .from(TABLES.Profile)
    .select('id, email, full_name, role, is_active')
    .eq('id', id)
    .maybeSingle();

  if (!profileError) profile = profileRow;

  return {
    id,
    email: email ?? profile?.email ?? null,
    full_name: profile?.full_name || metadata?.full_name || email,
    // إن لم يكن جدول المستخدمين مُنشأ بعد نرجع للسلوك القديم حتى لا يتعطل النظام.
    role: profile?.role || metadata?.role || LEGACY_FALLBACK_ROLE,
    is_active: profile?.is_active ?? true,
    has_profile: Boolean(profile),
  };
};

// ---------------------------------------------------------------------------
// الملفات (شعار النظام)
// ---------------------------------------------------------------------------
const LOGO_BUCKET = 'app-assets';
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export const validateLogoFile = (file) => {
  if (!file) return 'لم يتم اختيار أي ملف.';
  if (!LOGO_MIME_TYPES.includes(file.type)) return 'صيغة الصورة غير مدعومة (المسموح: PNG، JPG، WEBP، SVG).';
  if (file.size > LOGO_MAX_BYTES) return 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت.';
  return null;
};

export const storagePathFromPublicUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const marker = `/object/public/${LOGO_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
};

export const deleteStorageObject = async (path) => {
  if (!path) return;
  const client = requireSupabase();
  const { error } = await client.storage.from(LOGO_BUCKET).remove([path]);
  if (error) throw error;
};

export const uploadLogo = async (file) => {
  const client = requireSupabase();
  const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
  const filePath = `logos/logo-${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error } = await client.storage
    .from(LOGO_BUCKET)
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data } = client.storage.from(LOGO_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
};

// ---------------------------------------------------------------------------
// الواجهة العامة الموحّدة
// ---------------------------------------------------------------------------
export const db = {
  tables: TABLES,
  views: VIEWS,
  entities,
  rpc: callRpc,
  isStockRpcAvailable,
  selectRows,
  selectAllRows,
  countRows,
  auth: supabase
    ? {
        async me() {
          const user = await getCurrentUser();
          if (!user) throw new Error('AUTH_REQUIRED');
          return user;
        },
        async logout() {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
        },
      }
    : undefined,
  profiles: supabase
    ? {
        async list(options = {}) {
          return selectRows(TABLES.Profile, { order: 'created_date', ...options });
        },
        async updateRole(id, role) {
          const client = requireSupabase();
          return unwrap(
            client
              .from(TABLES.Profile)
              .update({ role, updated_date: new Date().toISOString() })
              .eq('id', id)
              .select()
              .single(),
          );
        },
        async setActive(id, isActive) {
          const client = requireSupabase();
          return unwrap(
            client
              .from(TABLES.Profile)
              .update({ is_active: isActive, updated_date: new Date().toISOString() })
              .eq('id', id)
              .select()
              .single(),
          );
        },
      }
    : undefined,
  storage: {
    uploadLogo,
    deleteStorageObject,
    storagePathFromPublicUrl,
    validateLogoFile,
  },
};

export default db;


