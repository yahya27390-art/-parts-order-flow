/**
 * items/api.js — كل عمليات دليل الأصناف والرصيد في مكان واحد.
 */
import { db, TABLES, selectRows, callRpc, isStockRpcAvailable } from '@/api/supabaseClient';
import { itemSchema, firstValidationError } from '@/lib/schemas';
import { toNumber } from '@/lib/format';

export const itemsQueryKey = (params = {}) => ['items', params];
export const itemQueryKey = (id) => ['item', id];

const ITEM_SEARCH_COLUMNS = ['item_number', 'item_name'];

export const listItemsPage = ({ page = 1, pageSize = 25, search = '', brand = '', order = 'item_number' } = {}) =>
  selectRows(TABLES.Item, {
    page,
    pageSize,
    search,
    searchColumns: ITEM_SEARCH_COLUMNS,
    filters: { brand },
    order,
  });

/** بحث سريع محدود النتائج (يستخدمه اختيار الصنف في الطلبات). */
export const searchItems = (term = '', { limit = 30, page = 1 } = {}) =>
  selectRows(TABLES.Item, {
    page,
    pageSize: limit,
    search: term,
    searchColumns: ITEM_SEARCH_COLUMNS,
    order: 'item_number',
  });

export const getItemById = async (id) => {
  const [row] = await db.entities.Item.filter({ id });
  return row ?? null;
};

export const countItems = (filters = {}) => db.entities.Item.count(filters);

export const normalizeItemPayload = (values) => ({
  item_number: String(values.item_number || '').trim(),
  item_name: String(values.item_name || '').trim(),
  brand: values.brand || 'other',
  cost: toNumber(values.cost),
});

export const createItem = async (values) => {
  const validation = itemSchema.safeParse(values);
  if (!validation.success) throw new Error(firstValidationError(validation));

  return db.entities.Item.create(normalizeItemPayload(validation.data));
};

export const updateItem = async (id, values) => {
  const validation = itemSchema.safeParse(values);
  if (!validation.success) throw new Error(firstValidationError(validation));

  return db.entities.Item.update(id, normalizeItemPayload(validation.data));
};

export const deleteItem = async (id) => db.entities.Item.delete(id);

/**
 * تسوية رصيد صنف: تُسجَّل الفروق كحركة مخزون موثّقة عند توفر دوال القاعدة،
 * وإلا تُحدَّث قيمة الرصيد مباشرة (المسار البديل).
 */
export const adjustItemStock = async ({ item_id, new_quantity, note = '' }) => {
  const quantity = toNumber(new_quantity);

  if (await isStockRpcAvailable()) {
    return callRpc('adjust_item_stock', {
      p_item_id: item_id,
      p_new_quantity: quantity,
      p_note: note || null,
    });
  }

  const item = await getItemById(item_id);
  if (!item) throw new Error('ITEM_NOT_FOUND');

  const updated = await db.entities.Item.update(item_id, { current_stock: quantity });
  return { item_id, current_stock: quantity, delta: quantity - toNumber(item.current_stock), item: updated };
};

/** حركات المخزون لصنف (سجل التدقيق). */
export const listItemMovements = (item_id, { page = 1, pageSize = 10 } = {}) =>
  selectRows(TABLES.StockMovement, {
    page,
    pageSize,
    filters: { item_id },
    order: '-created_date',
  });
