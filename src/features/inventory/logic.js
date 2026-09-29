/**
 * منطق المخزون النقي (بلا React وبلا شبكة) — قابل للاختبار مباشرة.
 *
 * القواعد المعتمدة:
 *  - "الرصيد المتاح" (current_stock) يزيد عند الاستلام الفعلي فقط.
 *  - إنشاء طلب شراء لا يغيّر الرصيد المتاح، بل يزيد "مخزون الطلبات" فقط.
 *  - الكمية الزائدة عن المطلوب تُضاف كاملة للرصيد المتاح.
 *  - متوسط التكلفة = متوسط مرجّح على الكميات الداخلة.
 */
// منطق المخزون النقي (بلا React وبلا شبكة وبلا اعتماديات خارجية) — قابل للاختبار بـ node --test
const toNumber = (value, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};


/** توزيع الكمية المستلمة إلى الجزء المطلوب والجزء الزائد. */
export const allocateReceiptQuantity = (quantity, remaining) => {
  const received = Math.max(0, toNumber(quantity));
  const pending = Math.max(0, toNumber(remaining));
  const normal = Math.min(received, pending);
  const excess = Math.max(0, received - pending);
  return { normal, excess, total: received };
};

/** حساب متوسط التكلفة المرجّح بعد إضافة كمية بسعر جديد. */
export const computeAverageCost = ({ currentQuantity = 0, currentAverageCost = 0, incomingQuantity = 0, incomingUnitCost = 0 }) => {
  const qty = Math.max(0, toNumber(currentQuantity));
  const avg = Math.max(0, toNumber(currentAverageCost));
  const incoming = Math.max(0, toNumber(incomingQuantity));
  const unitCost = Math.max(0, toNumber(incomingUnitCost));

  const newQuantity = qty + incoming;
  if (newQuantity <= 0) return 0;
  if (incoming <= 0 || unitCost <= 0) return avg;

  return (qty * avg + incoming * unitCost) / newQuantity;
};

/** تطبيق استلام على أرصدة صنف (المسار البديل عند غياب دوال القاعدة). */
export const applyReceiptToStock = (item, quantityReceived) => {
  const ordered = toNumber(item.quantity_ordered);
  const alreadyReceived = toNumber(item.quantity_received);
  const remaining = Math.max(0, ordered - alreadyReceived);
  const { normal, excess } = allocateReceiptQuantity(quantityReceived, remaining);

  const currentStock = toNumber(item.current_stock);
  const pendingStock = Math.max(0, toNumber(item.pending_stock) - normal);
  const averageCost = computeAverageCost({
    currentQuantity: currentStock,
    currentAverageCost: item.average_cost,
    incomingQuantity: normal + excess,
    incomingUnitCost: item.unit_cost,
  });

  return {
    receiving: normal + excess,
    normal,
    excess,
    current_stock: currentStock + normal + excess,
    pending_stock: pendingStock,
    average_cost: averageCost,
    quantity_received: alreadyReceived + normal + excess,
  };
};

/** تصنيف الرصيد إلى حالات تُستخدم في الشاشات والتقارير. */
export const getStockStatus = (availableStock, threshold = 5) => {
  const stock = toNumber(availableStock);
  if (stock < 0) return 'negative';
  if (stock === 0) return 'out';
  if (stock < threshold) return 'low';
  return 'ok';
};

/** ملخّص المخزون: العدد، القيمة، والمنخفض. */
export const summarizeStock = (rows = [], threshold = 5) => {
  const list = rows || [];
  const totalQuantity = list.reduce((sum, row) => sum + toNumber(row.available_stock ?? row.current_stock), 0);
  const totalValue = list.reduce((sum, row) => {
    const qty = toNumber(row.available_stock ?? row.current_stock);
    const cost = toNumber(row.average_cost);
    return sum + qty * cost;
  }, 0);

  return {
    itemsCount: list.length,
    totalQuantity,
    totalValue,
    lowStockCount: list.filter((row) => getStockStatus(row.available_stock ?? row.current_stock, threshold) === 'low').length,
    outOfStockCount: list.filter((row) => getStockStatus(row.available_stock ?? row.current_stock, threshold) === 'out').length,
    negativeCount: list.filter((row) => getStockStatus(row.available_stock ?? row.current_stock, threshold) === 'negative').length,
  };
};
