/**
 * منطق أذونات الاستلام النقي — بناء مسودة الاستلام والتحقق منها.
 */
import { allocateReceiptQuantity } from '../inventory/logic.js';
import { buildOrderRemainingRows } from '../orders/logic.js';

const toNumber = (value, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};


/**
 * يبني صفوف مسودة الاستلام من بنود الطلب ومن الكميات المُدخلة لكل بند
 * (الكمية الافتراضية للمتبقي الكامل، وهي أسرع طريقة عمل للمستودع).
 */
export const buildReceiptDraft = (orderItems = [], { prefilled = false } = {}) =>
  buildOrderRemainingRows(orderItems).map((item) => ({
    order_item_id: item.id,
    item_id: item.item_id,
    item_number: item.item_number,
    item_name: item.item_name,
    quantity_ordered: item.quantity_ordered,
    quantity_received_before: item.quantity_received_before,
    remaining: item.remaining,
    quantity_to_receive: prefilled ? item.remaining : 0,
    unit_cost: toNumber(item.unit_cost),
  }));

export const updateDraftQuantity = (rows = [], index, quantity) =>
  (rows || []).map((row, position) =>
    position === index ? { ...row, quantity_to_receive: Math.max(0, toNumber(quantity)) } : row,
  );

export const incrementDraftQuantity = (rows = [], index, step = 1) =>
  (rows || []).map((row, position) =>
    position === index
      ? { ...row, quantity_to_receive: Math.max(0, toNumber(row.quantity_to_receive) + step) }
      : row,
  );

export const findRowIndexByItemNumber = (rows = [], code = '') => {
  const needle = String(code).trim().toLowerCase();
  if (!needle) return -1;
  return (rows || []).findIndex((row) => String(row.item_number || '').trim().toLowerCase() === needle);
};

export const summarizeReceiptDraft = (rows = []) => {
  const list = rows || [];
  const totalQuantity = list.reduce((sum, row) => sum + toNumber(row.quantity_to_receive), 0);
  const totalAmount = list.reduce((sum, row) => sum + toNumber(row.quantity_to_receive) * toNumber(row.unit_cost), 0);
  const hasExcess = list.some((row) => toNumber(row.quantity_to_receive) > toNumber(row.remaining));
  const excessQuantity = list.reduce((sum, row) => {
    const { excess } = allocateReceiptQuantity(row.quantity_to_receive, row.remaining);
    return sum + excess;
  }, 0);

  return { totalQuantity, totalAmount, hasExcess, excessQuantity, hasAnyQuantity: totalQuantity > 0 };
};

/** الصفوف الجاهزة للإرسال إلى دالة الاستلام (بدون صفوف بكمية صفر). */
export const toReceiptPayload = (rows = []) =>
  (rows || [])
    .filter((row) => toNumber(row.quantity_to_receive) > 0)
    .map((row) => ({
      order_item_id: row.order_item_id,
      quantity_received: toNumber(row.quantity_to_receive),
    }));
