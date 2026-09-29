/**
 * orders/api.js — كل عمليات طلبات الشراء.
 *
 * المسار الأساسي: دوال قاعدة البيانات الذرية (RPC) التي تنفّذ العملية كاملة
 * داخل معاملة واحدة. وإن لم تكن ملفات الترحيل مُطبَّقة بعد، يعمل النظام
 * بمسار بديل مكافئ منطقيًا (بدون ذرية كاملة) حتى لا يتعطل العمل.
 */
import { db, TABLES, selectRows, selectAllRows, callRpc, isStockRpcAvailable } from '@/api/supabaseClient';
import { purchaseOrderSchema, firstValidationError } from '@/lib/schemas';
import { toNumber } from '@/lib/format';
import { generateOrderNumber } from '@/lib/documentNumbers';
import { mergeDuplicateOrderItems, computeOrderStatus, computeOrderTotals, ORDER_STATUS } from './logic';

export const ordersQueryKey = (params = {}) => ['orders', params];
export const openOrdersQueryKey = () => ['orders', 'open'];
export const orderDetailQueryKey = (id) => ['order', id];

const ORDER_SEARCH_COLUMNS = ['order_number', 'supplier_name'];
const MAX_DETAIL_ROWS = 100;

export const listOrdersPage = ({ page = 1, pageSize = 25, search = '', status = '', order = '-created_date' } = {}) =>
  selectRows(TABLES.PurchaseOrder, {
    page,
    pageSize,
    search,
    searchColumns: ORDER_SEARCH_COLUMNS,
    filters: { status },
    order,
  });

export const listOpenOrders = () =>
  selectRows(TABLES.PurchaseOrder, {
    filters: { status: [ORDER_STATUS.PENDING, ORDER_STATUS.PARTIAL] },
    pageSize: MAX_DETAIL_ROWS,
    order: '-order_date',
  });

export const listRecentOrders = (limit = 5) =>
  selectRows(TABLES.PurchaseOrder, { pageSize: limit, order: '-created_date' });

export const countOrders = (filters = {}) => db.entities.PurchaseOrder.count(filters);

export const getOrderDetail = async (orderId) => {
  const [orders, items, receipts] = await Promise.all([
    db.entities.PurchaseOrder.filter({ id: orderId }),
    selectAllRows(TABLES.PurchaseOrderItem, { filters: { order_id: orderId }, order: 'created_date' }),
    selectAllRows(TABLES.GoodsReceipt, { filters: { order_id: orderId }, order: '-receipt_date' }),
  ]);

  return {
    order: orders[0] ?? null,
    items,
    receipts: (receipts || []).filter((receipt) => !receipt.voided_at),
    voidedReceipts: (receipts || []).filter((receipt) => receipt.voided_at),
  };
};

// ---------------------------------------------------------------------------
// المسار البديل (يعمل بدون دوال قاعدة البيانات) — يحافظ على نفس قواعد الأرصدة
// ---------------------------------------------------------------------------
const adjustPendingStock = async (itemId, delta) => {
  if (!itemId || delta === 0) return;

  const [item] = await db.entities.Item.filter({ id: itemId });
  if (!item) return;

  await db.entities.Item.update(itemId, {
    pending_stock: Math.max(0, toNumber(item.pending_stock) + delta),
  });
};

const legacyCreatePurchaseOrder = async ({ order, items }) => {
  const totals = computeOrderTotals(items);

  const created = await db.entities.PurchaseOrder.create({
    order_number: order.order_number,
    order_date: order.order_date,
    supplier_name: order.supplier_name,
    notes: order.notes || null,
    status: ORDER_STATUS.PENDING,
    total_amount: totals.totalAmount,
  });

  for (const item of items) {
    const quantity = toNumber(item.quantity_ordered);
    const unitCost = toNumber(item.unit_cost);

    await db.entities.PurchaseOrderItem.create({
      order_id: created.id,
      item_id: item.item_id,
      item_number: item.item_number,
      item_name: item.item_name,
      quantity_ordered: quantity,
      quantity_received: 0,
      unit_cost: unitCost,
      total_cost: quantity * unitCost,
    });

    // إنشاء الطلب لا يغيّر الرصيد المتاح، بل يزيد مخزون الطلبات فقط.
    await adjustPendingStock(item.item_id, quantity);
  }

  return {
    id: created.id,
    order_number: created.order_number,
    total_amount: totals.totalAmount,
    usedRpc: false,
  };
};

const legacyUpdatePurchaseOrder = async ({ orderId, order, items }) => {
  const existingItems = await selectAllRows(TABLES.PurchaseOrderItem, { filters: { order_id: orderId } });
  const existingById = new Map(existingItems.map((item) => [item.id, item]));
  const keepIds = new Set();
  const totals = computeOrderTotals(items);

  await db.entities.PurchaseOrder.update(orderId, {
    order_number: order.order_number,
    order_date: order.order_date,
    supplier_name: order.supplier_name,
    notes: order.notes || null,
    total_amount: totals.totalAmount,
  });

  for (const item of items) {
    const quantity = toNumber(item.quantity_ordered);
    const unitCost = toNumber(item.unit_cost);

    if (item.id && existingById.has(item.id)) {
      const existing = existingById.get(item.id);
      keepIds.add(item.id);

      await db.entities.PurchaseOrderItem.update(item.id, {
        item_id: item.item_id,
        item_number: item.item_number,
        item_name: item.item_name,
        quantity_ordered: quantity,
        unit_cost: unitCost,
        total_cost: quantity * unitCost,
      });

      await adjustPendingStock(existing.item_id, quantity - toNumber(existing.quantity_ordered));
    } else {
      const created = await db.entities.PurchaseOrderItem.create({
        order_id: orderId,
        item_id: item.item_id,
        item_number: item.item_number,
        item_name: item.item_name,
        quantity_ordered: quantity,
        quantity_received: 0,
        unit_cost: unitCost,
        total_cost: quantity * unitCost,
      });

      keepIds.add(created.id);
      await adjustPendingStock(item.item_id, quantity);
    }
  }

  for (const existing of existingItems) {
    if (keepIds.has(existing.id)) continue;

    if (toNumber(existing.quantity_received) > 0) {
      throw new Error('CANNOT_DELETE_RECEIVED_ITEM');
    }

    await db.entities.PurchaseOrderItem.delete(existing.id);
    await adjustPendingStock(existing.item_id, -toNumber(existing.quantity_ordered));
  }

  const refreshed = await selectAllRows(TABLES.PurchaseOrderItem, { filters: { order_id: orderId } });
  const status = computeOrderStatus(refreshed);
  await db.entities.PurchaseOrder.update(orderId, { status });

  return { id: orderId, status, total_amount: totals.totalAmount, usedRpc: false };
};

// ---------------------------------------------------------------------------
// الواجهة العامة
// ---------------------------------------------------------------------------
const buildOrderPayload = (order) => ({
  order_number: String(order.order_number || '').trim() || generateOrderNumber(order.order_date),
  order_date: order.order_date,
  supplier_name: String(order.supplier_name || '').trim(),
  notes: String(order.notes || '').trim() || null,
});

const buildItemPayload = (items) =>
  mergeDuplicateOrderItems(items).map((item) => ({
    id: item.id || null,
    item_id: item.item_id,
    item_number: item.item_number,
    item_name: item.item_name,
    quantity_ordered: toNumber(item.quantity_ordered),
    unit_cost: toNumber(item.unit_cost),
  }));

export const createPurchaseOrder = async ({ order, items }) => {
  const validation = purchaseOrderSchema.safeParse({ order, items });
  if (!validation.success) throw new Error(firstValidationError(validation));

  const payload = { order: buildOrderPayload(validation.data.order), items: buildItemPayload(validation.data.items) };

  if (await isStockRpcAvailable()) {
    const result = await callRpc('create_purchase_order', { p_order: payload.order, p_items: payload.items });
    return { ...result, usedRpc: true };
  }

  return legacyCreatePurchaseOrder(payload);
};

export const updatePurchaseOrder = async ({ orderId, order, items }) => {
  const validation = purchaseOrderSchema.safeParse({ order, items });
  if (!validation.success) throw new Error(firstValidationError(validation));

  const payload = { order: buildOrderPayload(validation.data.order), items: buildItemPayload(validation.data.items) };

  if (await isStockRpcAvailable()) {
    const result = await callRpc('update_purchase_order', {
      p_order_id: orderId,
      p_order: payload.order,
      p_items: payload.items,
    });
    return { ...result, usedRpc: true };
  }

  return legacyUpdatePurchaseOrder({ orderId, ...payload });
};

export const cancelPurchaseOrder = async ({ orderId, reason = '' }) => {
  if (await isStockRpcAvailable()) {
    const result = await callRpc('cancel_purchase_order', { p_order_id: orderId, p_reason: reason || null });
    return { ...result, usedRpc: true };
  }

  const items = await selectAllRows(TABLES.PurchaseOrderItem, { filters: { order_id: orderId } });
  for (const item of items) {
    const remaining = Math.max(0, toNumber(item.quantity_ordered) - toNumber(item.quantity_received));
    await adjustPendingStock(item.item_id, -remaining);
  }

  await db.entities.PurchaseOrder.update(orderId, {
    status: ORDER_STATUS.CANCELLED,
    notes: reason ? `${reason}` : null,
  });

  return { id: orderId, status: ORDER_STATUS.CANCELLED, usedRpc: false };
};

export const deletePurchaseOrder = async (orderId) => {
  if (await isStockRpcAvailable()) {
    const result = await callRpc('delete_purchase_order', { p_order_id: orderId });
    return { ...result, usedRpc: true };
  }

  const items = await selectAllRows(TABLES.PurchaseOrderItem, { filters: { order_id: orderId } });
  const receivedItems = items.filter((item) => toNumber(item.quantity_received) > 0);
  if (receivedItems.length > 0) throw new Error('ORDER_HAS_RECEIPTS');

  for (const item of items) {
    await adjustPendingStock(item.item_id, -toNumber(item.quantity_ordered));
  }

  await Promise.all(items.map((item) => db.entities.PurchaseOrderItem.delete(item.id)));
  await db.entities.PurchaseOrder.delete(orderId);

  return { id: orderId, deleted: true, usedRpc: false };
};


