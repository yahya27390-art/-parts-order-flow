import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_STATUS,
  buildOrderRemainingRows,
  computeOrderProgress,
  computeOrderStatus,
  computeOrderTotals,
  findDuplicateItemIds,
  isOpenOrderStatus,
  mergeDuplicateOrderItems,
} from './logic.js';

test('computeOrderStatus يحسب الحالة من الكميات', () => {
  assert.equal(computeOrderStatus([{ quantity_ordered: 10, quantity_received: 0 }]), ORDER_STATUS.PENDING);
  assert.equal(computeOrderStatus([{ quantity_ordered: 10, quantity_received: 4 }]), ORDER_STATUS.PARTIAL);
  assert.equal(computeOrderStatus([{ quantity_ordered: 10, quantity_received: 10 }]), ORDER_STATUS.COMPLETED);
  assert.equal(
    computeOrderStatus([
      { quantity_ordered: 10, quantity_received: 10 },
      { quantity_ordered: 5, quantity_received: 2 },
    ]),
    ORDER_STATUS.PARTIAL,
  );
});

test('لا تتغير حالة الطلب الملغي', () => {
  assert.equal(computeOrderStatus([{ quantity_ordered: 1, quantity_received: 1 }], ORDER_STATUS.CANCELLED), ORDER_STATUS.CANCELLED);
});

test('computeOrderStatus يعيد pending لطلب بلا بنود', () => {
  assert.equal(computeOrderStatus([]), ORDER_STATUS.PENDING);
  assert.equal(computeOrderStatus(null), ORDER_STATUS.PENDING);
});

test('computeOrderTotals يجمع الكميات والمبالغ', () => {
  const totals = computeOrderTotals([
    { quantity_ordered: 3, quantity_received: 1, unit_cost: 10 },
    { quantity_ordered: 2, quantity_received: 2, unit_cost: 5 },
  ]);

  assert.equal(totals.orderedQuantity, 5);
  assert.equal(totals.receivedQuantity, 3);
  assert.equal(totals.remainingQuantity, 2);
  assert.equal(totals.totalAmount, 40);
  assert.equal(totals.itemsCount, 2);
});

test('computeOrderProgress يحسب النسبة', () => {
  assert.equal(computeOrderProgress([{ quantity_ordered: 4, quantity_received: 1, unit_cost: 1 }]), 25);
  assert.equal(computeOrderProgress([]), 0);
});

test('mergeDuplicateOrderItems يدمج نفس الصنف ويجمع الكميات', () => {
  const merged = mergeDuplicateOrderItems([
    { item_id: 'a', item_number: 'A1', item_name: 'قطعة', quantity_ordered: 2, unit_cost: 10 },
    { item_id: 'b', item_number: 'B1', item_name: 'قطعة أخرى', quantity_ordered: 1, unit_cost: 7 },
    { item_id: 'a', item_number: 'A1', item_name: 'قطعة', quantity_ordered: 3, unit_cost: 10 },
  ]);

  assert.equal(merged.length, 2);
  const first = merged.find((item) => item.item_id === 'a');
  assert.equal(first.quantity_ordered, 5);
  assert.equal(merged.find((item) => item.item_id === 'b').quantity_ordered, 1);
});

test('mergeDuplicateOrderItems يحافظ على السطور بدون صنف', () => {
  const merged = mergeDuplicateOrderItems([{ item_id: '', item_number: '', quantity_ordered: 1 }, { item_id: '', quantity_ordered: 2 }]);
  assert.equal(merged.length, 2);
});

test('findDuplicateItemIds يرصد التكرار', () => {
  assert.deepEqual(findDuplicateItemIds([{ item_id: 'a' }, { item_id: 'a' }, { item_id: 'b' }]), ['a']);
  assert.deepEqual(findDuplicateItemIds([]), []);
});

test('buildOrderRemainingRows يحسب المتبقي', () => {
  const rows = buildOrderRemainingRows([{ id: 'x', quantity_ordered: 10, quantity_received: 3, unit_cost: 2 }]);
  assert.equal(rows[0].remaining, 7);
  assert.equal(rows[0].quantity_received_before, 3);
});

test('isOpenOrderStatus يميّز الطلبات المفتوحة', () => {
  assert.equal(isOpenOrderStatus(ORDER_STATUS.PENDING), true);
  assert.equal(isOpenOrderStatus(ORDER_STATUS.PARTIAL), true);
  assert.equal(isOpenOrderStatus(ORDER_STATUS.COMPLETED), false);
  assert.equal(isOpenOrderStatus(ORDER_STATUS.CANCELLED), false);
});
