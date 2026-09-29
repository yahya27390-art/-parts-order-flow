/**
 * receipts/api.js — كل عمليات أذونات الاستلام.
 */
import { db, TABLES, selectRows, selectAllRows, callRpc, isStockRpcAvailable, withColumnFallback } from '@/api/supabaseClient';
import { goodsReceiptSchema, firstValidationError } from '@/lib/schemas';
import { toNumber } from '@/lib/format';
import { generateReceiptNumber } from '@/lib/documentNumbers';
import { allocateReceiptQuantity, computeAverageCost } from '@/features/inventory/logic';
import { computeOrderStatus } from '@/features/orders/logic';
import { toReceiptPayload } from './logic';

export const receiptsQueryKey = (params = {}) => ['receipts', params];
export const receiptDetailQueryKey = (id) => ['receipt', id];

const RECEIPT_SEARCH_COLUMNS = ['receipt_number', 'order_number'];

export const listReceiptsPage = ({
  page = 1,
  pageSize = 25,
  search = '',
  from = '',
  to = '',
  includeVoided = false,
  order = '-created_date',
} = {}) => {
  const baseFilters = from || to
    ? { receipt_date: { gte: from || undefined, lte: to ? `${to}T23:59:59` : undefined } }
    : {};
  const filters = includeVoided ? baseFilters : { ...baseFilters, voided_at: null };

  return withColumnFallback(
    (appliedFilters) =>
      selectRows(TABLES.GoodsReceipt, {
        page,
        pageSize,
        search,
        searchColumns: RECEIPT_SEARCH_COLUMNS,
        filters: appliedFilters,
        order,
      }),
    filters,
    'voided_at',
  );
};

export const listRecentReceipts = (limit = 5) =>
  withColumnFallback(
    (filters) => selectRows(TABLES.GoodsReceipt, { pageSize: limit, order: '-created_date', filters }),
    { voided_at: null },
    'voided_at',
  );

export const countReceipts = (filters = {}) => db.entities.GoodsReceipt.count(filters);

export const countReceiptsSince = (isoDate) =>
  withColumnFallback(
    (filters) => db.entities.GoodsReceipt.count(filters),
    { receipt_date: { gte: isoDate }, voided_at: null },
    'voided_at',
  );

export const getReceiptDetail = async (receiptId) => {
  const [receipts, items] = await Promise.all([
    db.entities.GoodsReceipt.filter({ id: receiptId }),
    selectAllRows(TABLES.GoodsReceiptItem, { filters: { receipt_id: receiptId }, order: 'created_date' }),
  ]);

  return { receipt: receipts[0] ?? null, items };
};

// ---------------------------------------------------------------------------
// المسار البديل (بدون دوال قاعدة البيانات)
// ---------------------------------------------------------------------------
const legacyReceiveGoods = async ({ receipt, items }) => {
  const orderItems = await selectAllRows(TABLES.PurchaseOrderItem, { filters: { order_id: receipt.order_id } });
  const orderItemsById = new Map(orderItems.map((item) => [item.id, item]));

  const [{ order_number } = {}] = await db.entities.PurchaseOrder.filter({ id: receipt.order_id });

  const totalAmount = items.reduce((sum, entry) => sum + toNumber(entry.quantity_received) * toNumber(orderItemsById.get(entry.order_item_id)?.unit_cost), 0);

  const created = await db.entities.GoodsReceipt.create({
    receipt_number: receipt.receipt_number || generateReceiptNumber(receipt.receipt_date),
    order_id: receipt.order_id,
    order_number: order_number ?? '',
    receipt_date: receipt.receipt_date,
    total_amount: totalAmount,
    notes: receipt.notes || null,
    last_modified_by: receipt.last_modified_by || '',
    last_modified_at: new Date().toISOString(),
  });

  const touchedItemIds = new Set();

  for (const entry of items) {
    const orderItem = orderItemsById.get(entry.order_item_id);
    if (!orderItem) throw new Error('ORDER_ITEM_NOT_FOUND');

    const quantity = toNumber(entry.quantity_received);
    const unitCost = toNumber(orderItem.unit_cost);
    const remaining = Math.max(0, toNumber(orderItem.quantity_ordered) - toNumber(orderItem.quantity_received));
    const { normal, excess } = allocateReceiptQuantity(quantity, remaining);

    await db.entities.GoodsReceiptItem.create({
      receipt_id: created.id,
      order_item_id: orderItem.id,
      item_id: orderItem.item_id,
      item_number: orderItem.item_number,
      item_name: orderItem.item_name,
      quantity_received: quantity,
      unit_cost: unitCost,
      total_cost: quantity * unitCost,
    });

    await db.entities.PurchaseOrderItem.update(orderItem.id, {
      quantity_received: toNumber(orderItem.quantity_received) + quantity,
    });

    const [item] = await db.entities.Item.filter({ id: orderItem.item_id });
    if (item) {
      await db.entities.Item.update(item.id, {
        current_stock: toNumber(item.current_stock) + normal + excess,
        pending_stock: Math.max(0, toNumber(item.pending_stock) - normal),
        average_cost: computeAverageCost({
          currentQuantity: toNumber(item.current_stock),
          currentAverageCost: item.average_cost,
          incomingQuantity: normal + excess,
          incomingUnitCost: unitCost,
        }),
      });
      touchedItemIds.add(item.id);
    }
  }

  const refreshed = await selectAllRows(TABLES.PurchaseOrderItem, { filters: { order_id: receipt.order_id } });
  await db.entities.PurchaseOrder.update(receipt.order_id, { status: computeOrderStatus(refreshed) });

  return { id: created.id, receipt_number: created.receipt_number, total_amount: totalAmount, usedRpc: false, touchedItemIds: Array.from(touchedItemIds) };
};

// ---------------------------------------------------------------------------
// الواجهة العامة
// ---------------------------------------------------------------------------
export const createGoodsReceipt = async ({ orderId, receipt, rows, actorName = '' }) => {
  const items = toReceiptPayload(rows);

  const validation = goodsReceiptSchema.safeParse({
    order_id: orderId,
    receipt,
    items: rows.map((row) => ({ order_item_id: row.order_item_id, quantity_received: toNumber(row.quantity_to_receive) })),
  });
  if (!validation.success) throw new Error(firstValidationError(validation));

  const payload = {
    receipt: {
      ...receipt,
      order_id: orderId,
      receipt_number: String(receipt.receipt_number || '').trim() || generateReceiptNumber(receipt.receipt_date),
      total_amount: rows.reduce((sum, row) => sum + toNumber(row.quantity_to_receive) * toNumber(row.unit_cost), 0),
      last_modified_by: actorName,
    },
    items,
  };

  if (await isStockRpcAvailable()) {
    const result = await callRpc('receive_goods', { p_receipt: payload.receipt, p_items: payload.items });
    return { ...result, usedRpc: true };
  }

  return legacyReceiveGoods(payload);
};

export const updateGoodsReceipt = async ({ receiptId, receipt, rows, actorName = '' }) => {
  const items = (rows || []).map((row) => ({
    id: row.id,
    quantity_received: toNumber(row.quantity_to_receive ?? row.quantity_received),
  }));

  if (await isStockRpcAvailable()) {
    const result = await callRpc('update_goods_receipt', {
      p_receipt_id: receiptId,
      p_receipt: { ...receipt, last_modified_by: actorName },
      p_items: items,
    });
    return { ...result, usedRpc: true };
  }

  // المسار البديل: تعديل الكميات مع تصحيح الرصيد بالفرق.
  let total = 0;
  for (const row of rows) {
    const nextQuantity = toNumber(row.quantity_to_receive);
    const previousQuantity = toNumber(row.quantity_received);
    const delta = nextQuantity - previousQuantity;
    const unitCost = toNumber(row.unit_cost);

    await db.entities.GoodsReceiptItem.update(row.id, {
      quantity_received: nextQuantity,
      total_cost: nextQuantity * unitCost,
    });

    if (delta !== 0) {
      const [item] = await db.entities.Item.filter({ id: row.item_id });
      if (item) {
        await db.entities.Item.update(item.id, {
          current_stock: toNumber(item.current_stock) + delta,
          average_cost: computeAverageCost({
            currentQuantity: toNumber(item.current_stock),
            currentAverageCost: item.average_cost,
            incomingQuantity: Math.max(delta, 0),
            incomingUnitCost: unitCost,
          }),
        });
      }

      if (row.order_item_id) {
        const [orderItem] = await db.entities.PurchaseOrderItem.filter({ id: row.order_item_id });
        if (orderItem) {
          await db.entities.PurchaseOrderItem.update(orderItem.id, {
            quantity_received: Math.max(0, toNumber(orderItem.quantity_received) + delta),
          });
        }
      }
    }

    total += nextQuantity * unitCost;
  }

  await db.entities.GoodsReceipt.update(receiptId, {
    receipt_date: receipt.receipt_date,
    notes: receipt.notes || null,
    total_amount: total,
    last_modified_by: actorName,
    last_modified_at: new Date().toISOString(),
  });

  const currentReceipt = await getReceiptDetail(receiptId);
  if (currentReceipt?.receipt?.order_id) {
    const orderItems = await selectAllRows(TABLES.PurchaseOrderItem, {
      filters: { order_id: currentReceipt.receipt.order_id },
    });
    await db.entities.PurchaseOrder.update(currentReceipt.receipt.order_id, { status: computeOrderStatus(orderItems) });
  }

  return { id: receiptId, total_amount: total, usedRpc: false };
};

export const voidGoodsReceipt = async ({ receiptId, reason = '' }) => {
  if (await isStockRpcAvailable()) {
    const result = await callRpc('void_goods_receipt', { p_receipt_id: receiptId, p_reason: reason || null });
    return { ...result, usedRpc: true };
  }

  const { items, receipt } = await getReceiptDetail(receiptId);
  if (!receipt) throw new Error('RECEIPT_NOT_FOUND');

  for (const row of items) {
    const [item] = await db.entities.Item.filter({ id: row.item_id });
    if (item) {
      await db.entities.Item.update(item.id, {
        current_stock: Math.max(0, toNumber(item.current_stock) - toNumber(row.quantity_received)),
      });
    }

    if (row.order_item_id) {
      const [orderItem] = await db.entities.PurchaseOrderItem.filter({ id: row.order_item_id });
      if (orderItem) {
        await db.entities.PurchaseOrderItem.update(orderItem.id, {
          quantity_received: Math.max(0, toNumber(orderItem.quantity_received) - toNumber(row.quantity_received)),
        });
      }
    }
  }

  await db.entities.GoodsReceipt.update(receiptId, {
    voided_at: new Date().toISOString(),
    void_reason: reason || null,
    last_modified_at: new Date().toISOString(),
  });

  const orderItems = await selectAllRows(TABLES.PurchaseOrderItem, { filters: { order_id: receipt.order_id } });
  await db.entities.PurchaseOrder.update(receipt.order_id, { status: computeOrderStatus(orderItems) });

  return { id: receiptId, voided: true, usedRpc: false };
};

