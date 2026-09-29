/**
 * inventory/api.js — قراءة المخزون من عرض التجميع على الخادم + حركات المخزون.
 */
import { TABLES, VIEWS, selectRows, countRows, selectAllRows, callRpc } from '@/api/supabaseClient';
import { getStockStatus } from './logic';
import { LOW_STOCK_THRESHOLD } from '@/lib/labels';
import { toNumber } from '@/lib/format';

export const inventoryQueryKey = (params = {}) => ['inventory', params];
export const inventorySummaryKey = () => ['inventory', 'summary'];
export const stockMovementsQueryKey = (params = {}) => ['stock-movements', params];

/**
 * يقرأ المخزون من العرض التجميعي، ومع غياب العرض (قبل الترحيل) يقرأ جدول الأصناف
 * ويحوّل الحقول لأسماء موحّدة، فلا تتأثر الصفحات بذلك.
 */
const mapInventoryRow = (row) => ({
  ...row,
  available_stock: Number(row.available_stock ?? row.current_stock ?? 0),
  on_order_stock: Number(row.on_order_stock ?? row.pending_stock ?? 0),
  average_cost: Number(row.average_cost ?? 0),
  stock_value: Number(row.stock_value ?? Number(row.current_stock ?? 0) * Number(row.average_cost ?? 0)),
});

const readFromFallbackTable = async (params) => {
  const result = await selectRows(TABLES.Item, {
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    searchColumns: ['item_number', 'item_name'],
    filters: { brand: params.brand },
    order: params.order,
  });

  let rows = result.rows.map(mapInventoryRow);

  if (params.status && params.status !== 'all') {
    rows = rows.filter((row) => getStockStatus(row.available_stock, LOW_STOCK_THRESHOLD) === params.status);
  }

  return { ...result, rows };
};

export const listInventoryPage = async (params = {}) => {
  const normalized = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 25,
    search: params.search ?? '',
    brand: params.brand ?? '',
    status: params.status && params.status !== 'all' ? params.status : '',
    order: params.order ?? 'item_number',
  };

  try {
    const result = await selectRows(VIEWS.Inventory, {
      page: normalized.page,
      pageSize: normalized.pageSize,
      search: normalized.search,
      searchColumns: ['item_number', 'item_name'],
      filters: {
        brand: normalized.brand,
        ...(normalized.status ? { stock_status: normalized.status } : {}),
      },
      order: normalized.order,
    });

    return { ...result, rows: result.rows.map(mapInventoryRow) };
  } catch {
    // العرض غير متاح (لم يُطبَّق الترحيل) — نقرأ من جدول الأصناف مباشرة.
    return readFromFallbackTable(normalized);
  }
};

/**
 * ملخّص المخزون: **طلب واحد** عبر دالة التجميع على الخادم.
 * كان سابقًا مسحًا متعدد الصفحات (8 طلبات × ~300ms) وهو أحد أسباب البطء.
 * وعند غياب الدالة نستخدم مسارًا بديلًا بعدّادات مباشرة + مسح واحد.
 */
export const getInventorySummary = async () => {
  try {
    const stats = await callRpc('get_inventory_stats', { p_low_threshold: LOW_STOCK_THRESHOLD });
    if (stats) {
      return {
        itemsCount: Number(stats.items_count ?? 0),
        totalQuantity: Number(stats.total_quantity ?? 0),
        totalValue: Number(stats.total_value ?? 0),
        lowStockCount: Number(stats.low_count ?? 0),
        outOfStockCount: Number(stats.out_count ?? 0),
        negativeCount: Number(stats.negative_count ?? 0),
        okCount: Number(stats.ok_count ?? 0),
        fromAggregate: true,
      };
    }
  } catch {
    /* ننتقل للمسار البديل */
  }

  const [itemsCount, negativeCount, lowCount, outCount, rows] = await Promise.all([
    countRows(TABLES.Item),
    countRows(TABLES.Item, { current_stock: { lt: 0 } }),
    countRows(TABLES.Item, { current_stock: { gt: 0, lt: LOW_STOCK_THRESHOLD } }),
    countRows(TABLES.Item, { current_stock: 0 }),
    selectAllRows(TABLES.Item, { columns: 'current_stock, average_cost', order: 'item_number' }),
  ]);

  return {
    itemsCount,
    negativeCount,
    lowStockCount: lowCount,
    outOfStockCount: outCount,
    okCount: Math.max(0, itemsCount - negativeCount - lowCount - outCount),
    totalQuantity: rows.reduce((sum, row) => sum + toNumber(row.current_stock), 0),
    totalValue: rows.reduce((sum, row) => sum + toNumber(row.current_stock) * toNumber(row.average_cost), 0),
    fromAggregate: false,
  };
};

/** قائمة أصناف بحالة رصيد محددة — استعلام واحد مفلتر على الخادم. */
export const listStockByStatus = async (status, { limit = 200 } = {}) => {
  const result = await selectRows(VIEWS.Inventory, {
    filters: { stock_status: status },
    pageSize: limit,
    order: 'item_number',
  });

  return result.rows.map(mapInventoryRow);
};


export const listStockMovements = ({ page = 1, pageSize = 25, itemId = '', itemSearch = '', type = '' } = {}) =>
  selectRows(TABLES.StockMovement, {
    page,
    pageSize,
    filters: { item_id: itemId, movement_type: type },
    search: itemSearch,
    searchColumns: ['note'],
    order: '-created_date',
  });

export const countStockMovements = () => countRows(TABLES.StockMovement);
