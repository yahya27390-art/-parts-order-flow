import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReceiptDraft,
  findRowIndexByItemNumber,
  incrementDraftQuantity,
  summarizeReceiptDraft,
  toReceiptPayload,
  updateDraftQuantity,
} from './logic.js';

const ORDER_ITEMS = [
  { id: 'oi-1', item_id: 'it-1', item_number: 'ABC-1', item_name: 'قطعة أولى', quantity_ordered: 10, quantity_received: 2, unit_cost: 5 },
  { id: 'oi-2', item_id: 'it-2', item_number: 'XYZ-2', item_name: 'قطعة ثانية', quantity_ordered: 4, quantity_received: 4, unit_cost: 3 },
];

test('buildReceiptDraft يبني مسودة بكميات صفرية افتراضيًا', () => {
  const draft = buildReceiptDraft(ORDER_ITEMS);
  assert.equal(draft.length, 2);
  assert.equal(draft[0].remaining, 8);
  assert.equal(draft[0].quantity_to_receive, 0);
  assert.equal(draft[1].remaining, 0);
});

test('buildReceiptDraft مع prefilled يعبّي المتبقي كاملًا', () => {
  const draft = buildReceiptDraft(ORDER_ITEMS, { prefilled: true });
  assert.equal(draft[0].quantity_to_receive, 8);
  assert.equal(draft[1].quantity_to_receive, 0);
});

test('updateDraftQuantity لا يقبل قيمًا سالبة', () => {
  const updated = updateDraftQuantity(buildReceiptDraft(ORDER_ITEMS), 0, -5);
  assert.equal(updated[0].quantity_to_receive, 0);
});

test('incrementDraftQuantity يزيد الكمية (مسار الباركود)', () => {
  const rows = incrementDraftQuantity(incrementDraftQuantity(buildReceiptDraft(ORDER_ITEMS), 0), 0);
  assert.equal(rows[0].quantity_to_receive, 2);
});

test('findRowIndexByItemNumber يطابق رقم الصنف بدون حساسية لحالة الأحرف', () => {
  const draft = buildReceiptDraft(ORDER_ITEMS);
  assert.equal(findRowIndexByItemNumber(draft, 'abc-1'), 0);
  assert.equal(findRowIndexByItemNumber(draft, ' XYZ-2 '), 1);
  assert.equal(findRowIndexByItemNumber(draft, 'missing'), -1);
  assert.equal(findRowIndexByItemNumber(draft, ''), -1);
});

test('summarizeReceiptDraft يرصد الزيادة والإجمالي', () => {
  const rows = updateDraftQuantity(buildReceiptDraft(ORDER_ITEMS), 0, 12);
  const summary = summarizeReceiptDraft(rows);

  assert.equal(summary.hasAnyQuantity, true);
  assert.equal(summary.hasExcess, true);
  assert.equal(summary.excessQuantity, 4);
  assert.equal(summary.totalQuantity, 12);
  assert.equal(summary.totalAmount, 60);
});

test('toReceiptPayload يستبعد الصفوف بدون كمية', () => {
  const rows = updateDraftQuantity(buildReceiptDraft(ORDER_ITEMS), 0, 3);
  assert.deepEqual(toReceiptPayload(rows), [{ order_item_id: 'oi-1', quantity_received: 3 }]);
});
