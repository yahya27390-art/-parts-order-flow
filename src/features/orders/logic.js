// منطق طلبات الشراء النقي — حالته، إجمالياته، ودمج الأصناف المكررة.
const toNumber = (value, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};


export const ORDER_STATUS = { PENDING: 'pending', PARTIAL: 'partial', COMPLETED: 'completed', CANCELLED: 'cancelled' };

/** حالة الطلب تُحسب من بنوده دائمًا (مصدر واحد للحقيقة). */
export const computeOrderStatus = (items = [], currentStatus = ORDER_STATUS.PENDING) => {
  if (currentStatus === ORDER_STATUS.CANCELLED) return ORDER_STATUS.CANCELLED;

  const list = items || [];
  if (list.length === 0) return ORDER_STATUS.PENDING;

  const totalOrdered = list.reduce((sum, item) => sum + toNumber(item.quantity_ordered), 0);
  if (totalOrdered === 0) return ORDER_STATUS.PENDING;

  const allCompleted = list.every((item) => toNumber(item.quantity_received) >= toNumber(item.quantity_ordered));
  if (allCompleted) return ORDER_STATUS.COMPLETED;

  const anyReceived = list.some((item) => toNumber(item.quantity_received) > 0);
  return anyReceived ? ORDER_STATUS.PARTIAL : ORDER_STATUS.PENDING;
};

export const isOpenOrderStatus = (status) => status === ORDER_STATUS.PENDING || status === ORDER_STATUS.PARTIAL;

export const computeOrderTotals = (items = []) => {
  const list = items || [];
  const ordered = list.reduce((sum, item) => sum + toNumber(item.quantity_ordered), 0);
  const received = list.reduce((sum, item) => sum + toNumber(item.quantity_received), 0);
  const totalAmount = list.reduce((sum, item) => {
    const quantity = toNumber(item.quantity_ordered);
    const unitCost = toNumber(item.unit_cost ?? item.cost);
    return sum + toNumber(item.total_cost, quantity * unitCost);
  }, 0);

  return {
    itemsCount: list.length,
    orderedQuantity: ordered,
    receivedQuantity: received,
    remainingQuantity: Math.max(0, ordered - received),
    totalAmount,
  };
};

export const computeOrderProgress = (items = []) => {
  const { orderedQuantity, receivedQuantity } = computeOrderTotals(items);
  if (orderedQuantity <= 0) return 0;
  return Math.min(100, Math.round((receivedQuantity / orderedQuantity) * 1000) / 10);
};

/**
 * دمج الأصناف المكررة في نفس الطلب بجمع الكميات
 * (بدل السماح بتكرار الصنف الذي كان يربك الأرصدة).
 */
export const mergeDuplicateOrderItems = (items = []) => {
  const merged = new Map();

  (items || []).forEach((item) => {
    const key = item.item_id || item.item_number;
    if (!key) {
      merged.set(`__row_${merged.size}`, { ...item });
      return;
    }

    if (!merged.has(key)) {
      merged.set(key, { ...item });
      return;
    }

    const existing = merged.get(key);
    merged.set(key, {
      ...existing,
      quantity_ordered: toNumber(existing.quantity_ordered) + toNumber(item.quantity_ordered),
      unit_cost: toNumber(existing.unit_cost) || toNumber(item.unit_cost),
      total_cost: undefined,
    });
  });

  return Array.from(merged.values());
};

export const findDuplicateItemIds = (items = []) => {
  const seen = new Set();
  const duplicates = new Set();
  (items || []).forEach((item) => {
    if (!item.item_id) return;
    if (seen.has(item.item_id)) duplicates.add(item.item_id);
    seen.add(item.item_id);
  });
  return Array.from(duplicates);
};

/** بنود الطلب مع الكميات المتبقية (تستخدمها صفحة الاستلام). */
export const buildOrderRemainingRows = (orderItems = []) =>
  (orderItems || []).map((item) => {
    const ordered = toNumber(item.quantity_ordered);
    const received = toNumber(item.quantity_received);
    return {
      ...item,
      quantity_ordered: ordered,
      quantity_received_before: received,
      remaining: Math.max(0, ordered - received),
    };
  });
