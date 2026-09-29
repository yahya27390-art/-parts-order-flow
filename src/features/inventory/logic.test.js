import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateReceiptQuantity,
  applyReceiptToStock,
  computeAverageCost,
  getStockStatus,
  summarizeStock,
} from './logic.js';

test('allocateReceiptQuantity يفصل المطلوب عن الزائد', () => {
  assert.deepEqual(allocateReceiptQuantity(5, 10), { normal: 5, excess: 0, total: 5 });
  assert.deepEqual(allocateReceiptQuantity(10, 10), { normal: 10, excess: 0, total: 10 });
  assert.deepEqual(allocateReceiptQuantity(13, 10), { normal: 10, excess: 3, total: 13 });
  assert.deepEqual(allocateReceiptQuantity(5, 0), { normal: 0, excess: 5, total: 5 });
});

test('allocateReceiptQuantity يتعامل مع القيم الفارغة والسلبية', () => {
  assert.deepEqual(allocateReceiptQuantity(null, null), { normal: 0, excess: 0, total: 0 });
  assert.deepEqual(allocateReceiptQuantity(-3, -5), { normal: 0, excess: 0, total: 0 });
  assert.deepEqual(allocateReceiptQuantity('4', '2'), { normal: 2, excess: 2, total: 4 });
});

test('computeAverageCost يحسب المتوسط المرجّح', () => {
  assert.equal(computeAverageCost({ currentQuantity: 10, currentAverageCost: 20, incomingQuantity: 10, incomingUnitCost: 30 }), 25);
  assert.equal(computeAverageCost({ currentQuantity: 0, currentAverageCost: 0, incomingQuantity: 5, incomingUnitCost: 12 }), 12);
  assert.equal(computeAverageCost({ currentQuantity: 5, currentAverageCost: 10, incomingQuantity: 0, incomingUnitCost: 0 }), 10);
  assert.equal(computeAverageCost({}), 0);
});

test('الاستلام يزيد الرصيد المتاح فقط ولا يخصمه', () => {
  const item = { quantity_ordered: 10, quantity_received: 0, current_stock: 0, pending_stock: 10, unit_cost: 5, average_cost: 0 };
  const result = applyReceiptToStock(item, 10);

  assert.equal(result.current_stock, 10, 'الرصيد المتاح يجب أن يزيد بالكمية المستلمة');
  assert.equal(result.pending_stock, 0);
  assert.equal(result.average_cost, 5);
  assert.equal(result.quantity_received, 10);
});

test('الاستلام الجزئي ينقص مخزون الطلبات بمقدار المطلوب فقط والزائد يبقى في المتاح', () => {
  const item = { quantity_ordered: 10, quantity_received: 0, current_stock: 2, pending_stock: 10, unit_cost: 4, average_cost: 4 };
  const result = applyReceiptToStock(item, 12);

  assert.equal(result.normal, 10);
  assert.equal(result.excess, 2);
  assert.equal(result.current_stock, 14);
  assert.equal(result.pending_stock, 0);
});

test('getStockStatus يصنّف الأرصدة', () => {
  assert.equal(getStockStatus(0), 'out');
  assert.equal(getStockStatus(3), 'low');
  assert.equal(getStockStatus(5), 'ok');
  assert.equal(getStockStatus(-2), 'negative');
});

test('summarizeStock يجمّع القيمة والمنخفض', () => {
  const summary = summarizeStock([
    { available_stock: 10, average_cost: 5 },
    { available_stock: 0, average_cost: 100 },
    { available_stock: 2, average_cost: 10 },
  ]);

  assert.equal(summary.itemsCount, 3);
  assert.equal(summary.totalQuantity, 12);
  assert.equal(summary.totalValue, 70);
  assert.equal(summary.lowStockCount, 1);
  assert.equal(summary.outOfStockCount, 1);
  assert.equal(summary.negativeCount, 0);
});
