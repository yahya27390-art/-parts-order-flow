/**
 * inventory/api.js — قراءة المخزون من عرض التجميع على الخادم + حركات المخزون.
 */
import { db, TABLES, VIEWS, selectRows, countRows, selectAllRows } from '@/api/supabaseClient';
import { getStockStatus } from './logic';
import { LOW_STOCK_THRESHOLD } from '@/lib/labels';

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

/** بيانات بطاقات الملخّص في صفحة المخزون ولوحة التحكم (بدون نقل كل الصفوف). */
export const getInventorySummary = async () => {
  try {
    const rows = await selectAllRows(VIEWS.Inventory, { order: 'item_number' });
    const items = rows.map(mapInventoryRow);

    return {
      itemsCount: items.length,
      totalValue: items.reduce((sum, item) => sum + item.available_stock * item.average_cost, 0),
      totalQuantity: items.reduce((sum, item) => sum + item.available_stock, 0),
      lowStockCount: items.filter((item) => getStockStatus(item.available_stock, LOW_STOCK_THRESHOLD) === 'low').length,
      outOfStockCount: items.filter((item) => getStockStatus(item.available_stock, LOW_STOCK_THRESHOLD) === 'out').length,
      negativeCount: items.filter((item) => getStockStatus(item.available_stock, LOW_STOCK_THRESHOLD) === 'negative').length,
      fromView: true,
    };
  } catch {
    const rows = await selectAllRows(TABLES.Item, { order: 'item_number' });
    const items = rows.map(mapInventoryRow);

    return {
      itemsCount: items.length,
      totalValue: items.reduce((sum, item) => sum + item.available_stock * item.average_cost, 0),
      totalQuantity: items.reduce((sum, item) => sum + item.available_stock, 0),
      lowStockCount: items.filter((item) => getStockStatus(item.available_stock, LOW_STOCK_THRESHOLD) === 'low').length,
      outOfStockCount: items.filter((item) => getStockStatus(item.available_stock, LOW_STOCK_THRESHOLD) === 'out').length,
      negativeCount: items.filter((item) => getStockStatus(item.available_stock, LOW_STOCK_THRESHOLD) === 'negative').length,
      fromView: false,
    };
  }
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
