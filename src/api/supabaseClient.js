import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
    })
  : null;

const tables = {
  Item: 'items',
  PurchaseOrder: 'purchase_orders',
  PurchaseOrderItem: 'purchase_order_items',
  GoodsReceipt: 'goods_receipts',
  GoodsReceiptItem: 'goods_receipt_items',
  SystemSettings: 'system_settings'
};

const mapError = (error) => {
  if (error) throw error;
};

const createEntity = (entityName) => {
  const table = tables[entityName];

  return {
    async list(order = '-created_date', limit) {
      if (!supabase) throw new Error('Supabase configuration is missing.');
      const descending = order.startsWith('-');
      const column = descending ? order.slice(1) : order;
      let query = supabase.from(table).select('*').order(column, { ascending: !descending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      mapError(error);
      return data ?? [];
    },
    async filter(filters) {
      if (!supabase) throw new Error('Supabase configuration is missing.');
      let query = supabase.from(table).select('*');
      Object.entries(filters).forEach(([column, value]) => {
        query = query.eq(column, value);
      });
      const { data, error } = await query;
      mapError(error);
      return data ?? [];
    },
    async create(values) {
      if (!supabase) throw new Error('Supabase configuration is missing.');
      const { data, error } = await supabase.from(table).insert(values).select().single();
      mapError(error);
      return data;
    },
    async update(id, values) {
      if (!supabase) throw new Error('Supabase configuration is missing.');
      const { data, error } = await supabase.from(table).update(values).eq('id', id).select().single();
      mapError(error);
      return data;
    },
    async delete(id) {
      if (!supabase) throw new Error('Supabase configuration is missing.');
      const { error } = await supabase.from(table).delete().eq('id', id);
      mapError(error);
    }
  };
};

export const db = {
  entities: Object.fromEntries(Object.keys(tables).map((name) => [name, createEntity(name)])),
  auth: supabase
    ? {
      async me() {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data.user) throw new Error('No authenticated user.');

        return {
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || data.user.email,
          role: data.user.user_metadata?.role || 'admin'
        };
      },
      async logout() {
        const { error } = await supabase.auth.signOut();
        mapError(error);
      }
    }
    : undefined,
  storage: {
    async uploadLogo(file) {
      if (!supabase) throw new Error('Supabase configuration is missing.');
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const filePath = `logos/logo-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('app-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      mapError(uploadError);

      const { data } = supabase.storage.from('app-assets').getPublicUrl(filePath);
      return data.publicUrl;
    }
  }
};
