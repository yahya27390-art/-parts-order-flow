/**
 * منطق التقارير النقي — الفروقات، الفلترة الزمنية، وملخّصات التقارير.
 */
const toNumber = (value, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};


/** يبني صفوف تقرير فروقات المورد من بيانات الطلبات. */
export const buildDiscrepancyRows = (orderItems = [], orderId = null) =>
  (orderItems || [])
    .filter((item) => (orderId ? item.order_id === orderId : true))
    .map((item) => {
      const ordered = toNumber(item.quantity_ordered);
      const received = toNumber(item.quantity_received ?? item.quantity_received_before);
      const unitCost = toNumber(item.unit_cost);
      const difference = received - ordered;

      return {
        ...item,
        quantity_ordered: ordered,
        quantity_received: received,
        difference,
        value_difference: difference * unitCost,
        status: difference > 0 ? 'excess' : difference < 0 ? 'shortage' : 'complete',
      };
    });

export const summarizeDiscrepancies = (rows = []) => {
  const list = rows || [];
  const excessValue = list
    .filter((row) => row.difference > 0)
    .reduce((sum, row) => sum + toNumber(row.value_difference), 0);
  const shortageValue = list
    .filter((row) => row.difference < 0)
    .reduce((sum, row) => sum + toNumber(row.value_difference), 0);

  return {
    excessValue,
    shortageValue,
    netBalance: excessValue + shortageValue,
    excessCount: list.filter((row) => row.difference > 0).length,
    shortageCount: list.filter((row) => row.difference < 0).length,
    completeCount: list.filter((row) => row.difference === 0).length,
  };
};

export const filterRowsByDateRange = (rows = [], from, to, field = 'receipt_date') => {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (!fromDate && !toDate) return rows || [];

  const endDate = toDate ? new Date(toDate.getTime()) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);

  return (rows || []).filter((row) => {
    const value = parseDate(row?.[field]);
    if (!value) return false;
    if (fromDate && value < fromDate) return false;
    if (endDate && value > endDate) return false;
    return true;
  });
};

/** تجميع قيمة المخزون ومؤشراته من صفوف عرض v_inventory أو جدول الأصناف. */
export const buildInventoryReportRows = (rows = []) =>
  (rows || []).map((row) => {
    const quantity = toNumber(row.available_stock ?? row.current_stock);
    const averageCost = toNumber(row.average_cost);
    return {
      item_number: row.item_number,
      item_name: row.item_name,
      available_stock: quantity,
      on_order_stock: toNumber(row.on_order_stock ?? row.pending_stock),
      average_cost: averageCost,
      stock_value: quantity * averageCost,
    };
  });

/** تجميع الكميات المطلوبة/المستلمة لحساب إنجاز المشتريات. */
export const summarizeFulfillment = (orderItems = []) => {
  const orderedQuantity = (orderItems || []).reduce((sum, item) => sum + toNumber(item.quantity_ordered), 0);
  const receivedQuantity = (orderItems || []).reduce((sum, item) => sum + toNumber(item.quantity_received), 0);

  return {
    orderedQuantity,
    receivedQuantity,
    remainingQuantity: Math.max(0, orderedQuantity - receivedQuantity),
    receivedPercent: orderedQuantity > 0 ? Math.round((receivedQuantity / orderedQuantity) * 1000) / 10 : 0,
  };
};

/** توزيع الطلبات على الحالات (لمخططات لوحة التحكم). */
export const buildStatusDistribution = (orders = []) => {
  const counts = (orders || []).reduce((accumulator, order) => {
    const status = order.status || 'pending';
    accumulator[status] = (accumulator[status] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts).map(([status, value]) => ({ status, value }));
};
