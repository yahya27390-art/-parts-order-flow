/**
 * reports/api.js — قراءات التقارير ولوحة التحكم.
 *
 * تعتمد على عروض التجميع (v_order_fulfillment / v_inventory) وعلى العدّاد
 * count (head-only) بدل تنزيل الجداول كاملة إلى المتصفح.
 */
import { db, TABLES, VIEWS, selectAllRows, withColumnFallback } from '@/api/supabaseClient';
import { buildDiscrepancyRows, summarizeDiscrepancies, filterRowsByDateRange } from './logic';
import { toNumber, parseDate } from '@/lib/format';
import { getStockStatus } from '@/features/inventory/logic';
import { LOW_STOCK_THRESHOLD } from '@/lib/labels';
import { ORDER_STATUS } from '@/features/orders/logic';

export const dashboardQueryKey = () => ['dashboard'];
export const reportsQueryKey = (params = {}) => ['reports', params];
export const discrepancyQueryKey = (orderId) => ['reports', 'discrepancies', orderId];

const startOfTodayIso = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

/** مخزون مُلخّص: يُستخدم للوحة التحكم وتقرير المخزون. */
const readInventoryRows = async () => {
  try {
    const rows = await selectAllRows(VIEWS.Inventory, { order: 'item_number' });
    return rows.map((row) => ({
      ...row,
      available_stock: toNumber(row.available_stock ?? row.current_stock),
      on_order_stock: toNumber(row.on_order_stock ?? row.pending_stock),
      average_cost: toNumber(row.average_cost),
      stock_value: toNumber(row.stock_value),
    }));
  } catch {
    const rows = await selectAllRows(TABLES.Item, { order: 'item_number' });
    return rows.map((row) => ({
      ...row,
      available_stock: toNumber(row.current_stock),
      on_order_stock: toNumber(row.pending_stock),
      average_cost: toNumber(row.average_cost),
      stock_value: toNumber(row.current_stock) * toNumber(row.average_cost),
    }));
  }
};

/** صفوف إنجاز الطلبات (صف واحد لكل طلب) — لا تُنزّل بنود الطلبات كلها. */
const readFulfillmentRows = async () => {
  try {
    const rows = await selectAllRows(VIEWS.OrderFulfillment, { order: '-order_date' });
    return rows.map((row) => ({
      ...row,
      ordered_quantity: toNumber(row.ordered_quantity),
      received_quantity: toNumber(row.received_quantity),
      remaining_quantity: toNumber(row.remaining_quantity),
      total_amount: toNumber(row.total_amount),
    }));
  } catch {
    const rows = await selectAllRows(TABLES.PurchaseOrder, { order: '-order_date' });
    return rows.map((row) => ({
      ...row,
      ordered_quantity: 0,
      received_quantity: 0,
      remaining_quantity: 0,
      total_amount: toNumber(row.total_amount),
    }));
  }
};

export const getDashboardData = async () => {
  const todayIso = startOfTodayIso();

  const [totalOrders, openOrdersCount, receiptsToday, recentOrders, recentReceipts, inventoryRows, fulfillmentRows] =
    await Promise.all([
      db.entities.PurchaseOrder.count(),
      db.entities.PurchaseOrder.count({ status: [ORDER_STATUS.PENDING, ORDER_STATUS.PARTIAL] }),
      withColumnFallback(
        (filters) => db.entities.GoodsReceipt.count(filters),
        { receipt_date: { gte: todayIso }, voided_at: null },
        'voided_at',
      ),
      db.entities.PurchaseOrder.list('-created_date', 5),
      db.entities.GoodsReceipt.list('-created_date', 5),
      readInventoryRows(),
      readFulfillmentRows(),
    ]);

  const overdueLimit = new Date();
  overdueLimit.setDate(overdueLimit.getDate() - 20);

  const openFulfillments = fulfillmentRows.filter(
    (row) => row.status === ORDER_STATUS.PENDING || row.status === ORDER_STATUS.PARTIAL,
  );

  const overdueOrders = openFulfillments.filter((row) => {
    const orderDate = parseDate(row.order_date);
    return orderDate ? orderDate < overdueLimit : false;
  });

  const orderedQuantity = fulfillmentRows.reduce((sum, row) => sum + row.ordered_quantity, 0);
  const receivedQuantity = fulfillmentRows.reduce((sum, row) => sum + row.received_quantity, 0);

  const statusData = Object.values(ORDER_STATUS)
    .map((status) => ({ status, value: fulfillmentRows.filter((row) => row.status === status).length }))
    .filter((entry) => entry.value > 0);

  return {
    stats: {
      totalOrders,
      openOrders: openOrdersCount,
      receiptsToday,
      totalItems: inventoryRows.length,
      inventoryValue: inventoryRows.reduce((sum, row) => sum + row.stock_value, 0),
      lowStockItems: inventoryRows.filter(
        (row) => getStockStatus(row.available_stock, LOW_STOCK_THRESHOLD) === 'low',
      ).length,
      outOfStockItems: inventoryRows.filter(
        (row) => getStockStatus(row.available_stock, LOW_STOCK_THRESHOLD) === 'out',
      ).length,
    },
    recentOrders,
    recentReceipts: recentReceipts.filter((receipt) => !receipt.voided_at),
    overdueOrders,
    insights: {
      statusData,
      orderedQuantity,
      receivedQuantity,
      remainingQuantity: Math.max(0, orderedQuantity - receivedQuantity),
    },
  };
};

/** تقرير إذونات الاستلام مع بنوده (يُفلتر على الخادم حسب الفترة). */
export const getReceiptsReport = async ({ from = '', to = '', limit = 200 } = {}) => {
  const filters = {
    ...(from || to ? { receipt_date: { gte: from || undefined, lte: to ? `${to}T23:59:59` : undefined } } : {}),
    voided_at: null,
  };

  const receipts = await withColumnFallback(
    (appliedFilters) => selectAllRows(TABLES.GoodsReceipt, { filters: appliedFilters, order: '-receipt_date' }),
    filters,
    'voided_at',
  );

  const trimmed = receipts.slice(0, limit);

  if (trimmed.length === 0) {
    return { receipts: [], items: [] };
  }

  const items = await selectAllRows(TABLES.GoodsReceiptItem, {
    filters: { receipt_id: trimmed.map((receipt) => receipt.id) },
    order: 'created_date',
  });

  return { receipts: trimmed, items };
};

export const getInventoryReport = readInventoryRows;

export const getNegativeStockItems = async () =>
  (await readInventoryRows())
    .filter((row) => getStockStatus(row.available_stock, LOW_STOCK_THRESHOLD) === 'negative')
    .sort((left, right) => left.available_stock - right.available_stock);

/** فروقات الموردين لطلب واحد (أو لكل الطلبات). */
export const getSupplierDiscrepancies = async (orderId = null) => {
  try {
    const rows = await selectAllRows(VIEWS.SupplierDiscrepancies, {
      filters: orderId ? { order_id: orderId } : {},
      order: 'item_number',
    });

    return rows.map((row) => ({
      ...row,
      quantity_ordered: toNumber(row.quantity_ordered),
      quantity_received: toNumber(row.quantity_received),
      difference: toNumber(row.quantity_difference),
      value_difference: toNumber(row.value_difference),
      status: row.discrepancy_status,
      unit_cost: toNumber(row.unit_cost),
    }));
  } catch {
    const orderItems = await selectAllRows(TABLES.PurchaseOrderItem, { order: 'created_date' });
    return buildDiscrepancyRows(orderItems, orderId);
  }
};

export const getDiscrepancySummary = (rows = []) => summarizeDiscrepancies(rows);

export { filterRowsByDateRange };

