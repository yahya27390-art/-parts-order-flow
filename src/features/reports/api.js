/**
 * reports/api.js — قراءات التقارير ولوحة التحكم.
 *
 * تعتمد على عروض التجميع (v_order_fulfillment / v_inventory) وعلى العدّاد
 * count (head-only) بدل تنزيل الجداول كاملة إلى المتصفح.
 */
import { db, TABLES, VIEWS, selectRows, selectAllRows, callRpc, withColumnFallback } from '@/api/supabaseClient';
import { buildDiscrepancyRows, summarizeDiscrepancies, filterRowsByDateRange } from './logic';
import { toNumber } from '@/lib/format';
import { LOW_STOCK_THRESHOLD } from '@/lib/labels';
import { ORDER_STATUS } from '@/features/orders/logic';
import { getInventorySummary, listStockByStatus } from '@/features/inventory/api';

export const dashboardQueryKey = () => ['dashboard'];
export const reportsQueryKey = (params = {}) => ['reports', params];
export const discrepancyQueryKey = (orderId) => ['reports', 'discrepancies', orderId];

/** مخزون مُلخّص: يُستخدم لتقرير المخزون (يحتاج الصفوف نفسها للعرض). */
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

const OVERDUE_DAYS = 20;

/** مسار بديل لإحصاءات الطلبات عند غياب دالة التجميع. */
const fallbackPurchaseStats = async () => {
  const [total, pending, partial, completed, cancelled, items] = await Promise.all([
    db.entities.PurchaseOrder.count(),
    db.entities.PurchaseOrder.count({ status: 'pending' }),
    db.entities.PurchaseOrder.count({ status: 'partial' }),
    db.entities.PurchaseOrder.count({ status: 'completed' }),
    db.entities.PurchaseOrder.count({ status: 'cancelled' }),
    selectAllRows(TABLES.PurchaseOrderItem, { columns: 'quantity_ordered, quantity_received' }),
  ]);

  return {
    orders: {
      total_orders: total,
      pending_orders: pending,
      partial_orders: partial,
      completed_orders: completed,
      cancelled_orders: cancelled,
      open_orders: pending + partial,
      overdue_orders: 0,
    },
    ordered_quantity: items.reduce((sum, row) => sum + toNumber(row.quantity_ordered), 0),
    received_quantity: items.reduce((sum, row) => sum + toNumber(row.quantity_received), 0),
    receipts_today: 0,
    receipts_total: 0,
  };
};

const toNumberSafe = (value) => toNumber(value);

export const getDashboardData = async () => {
  const overdueDate = new Date();
  overdueDate.setDate(overdueDate.getDate() - OVERDUE_DAYS);
  const overdueIso = overdueDate.toISOString().slice(0, 10);

  // طلبات قليلة ومتوازية: دالتا تجميع على الخادم + قائمتان قصيرتان + قائمة المتأخرة.
  const [purchaseStatsRaw, inventoryStatsRaw, recentOrders, recentReceipts, overduePage] = await Promise.all([
    callRpc('get_purchase_stats', { p_overdue_days: OVERDUE_DAYS }).catch(() => null),
    callRpc('get_inventory_stats', { p_low_threshold: LOW_STOCK_THRESHOLD }).catch(() => null),
    db.entities.PurchaseOrder.list('-created_date', 5),
    db.entities.GoodsReceipt.list('-created_date', 5),
    selectRows(VIEWS.OrderFulfillment, {
      filters: { status: [ORDER_STATUS.PENDING, ORDER_STATUS.PARTIAL], order_date: { lt: overdueIso } },
      pageSize: 20,
      order: 'order_date',
    }).catch(() => ({ rows: [] })),
  ]);

  const purchaseStats = purchaseStatsRaw ?? (await fallbackPurchaseStats());
  const inventoryStats = inventoryStatsRaw ?? (await getInventorySummary());

  const orders = purchaseStats.orders ?? {};
  const orderedQuantity = toNumberSafe(purchaseStats.ordered_quantity);
  const receivedQuantity = toNumberSafe(purchaseStats.received_quantity);

  const statusData = [
    { status: ORDER_STATUS.PENDING, value: toNumberSafe(orders.pending_orders) },
    { status: ORDER_STATUS.PARTIAL, value: toNumberSafe(orders.partial_orders) },
    { status: ORDER_STATUS.COMPLETED, value: toNumberSafe(orders.completed_orders) },
    { status: ORDER_STATUS.CANCELLED, value: toNumberSafe(orders.cancelled_orders) },
  ].filter((entry) => entry.value > 0);

  return {
    stats: {
      totalOrders: toNumberSafe(orders.total_orders),
      openOrders: toNumberSafe(orders.open_orders),
      receiptsToday: toNumberSafe(purchaseStats.receipts_today),
      totalItems: toNumberSafe(inventoryStats.itemsCount ?? inventoryStats.items_count),
      inventoryValue: toNumberSafe(inventoryStats.totalValue ?? inventoryStats.total_value),
      lowStockItems: toNumberSafe(inventoryStats.lowStockCount ?? inventoryStats.low_count),
      outOfStockItems: toNumberSafe(inventoryStats.outOfStockCount ?? inventoryStats.out_count),
      negativeItems: toNumberSafe(inventoryStats.negativeCount ?? inventoryStats.negative_count),
    },
    recentOrders,
    recentReceipts: recentReceipts.filter((receipt) => !receipt.voided_at),
    overdueOrders: overduePage.rows ?? [],
    insights: {
      statusData,
      orderedQuantity,
      receivedQuantity,
      remainingQuantity: Math.max(0, orderedQuantity - receivedQuantity),
    },
  };
};

/** تقرير إذونات الاستلام مع بنوده (يُفلتر على الخادم حسب الفترة). */
export const getReceiptsReport = async ({ from = '', to = '', limit = 60 } = {}) => {
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

export const getNegativeStockItems = async () => {
  const rows = await listStockByStatus('negative', { limit: 200 });
  return rows.sort((left, right) => left.available_stock - right.available_stock);
};

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

