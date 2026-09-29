import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiscrepancyRows,
  buildInventoryReportRows,
  buildStatusDistribution,
  filterRowsByDateRange,
  summarizeDiscrepancies,
  summarizeFulfillment,
} from './logic.js';

test('buildDiscrepancyRows يحسب الفرق وقيمته', () => {
  const rows = buildDiscrepancyRows([
    { id: '1', order_id: 'o1', quantity_ordered: 10, quantity_received: 12, unit_cost: 5 },
    { id: '2', order_id: 'o1', quantity_ordered: 10, quantity_received: 7, unit_cost: 5 },
    { id: '3', order_id: 'o1', quantity_ordered: 10, quantity_received: 10, unit_cost: 5 },
  ]);

  assert.equal(rows[0].status, 'excess');
  assert.equal(rows[0].value_difference, 10);
  assert.equal(rows[1].status, 'shortage');
  assert.equal(rows[1].value_difference, -15);
  assert.equal(rows[2].status, 'complete');
});

test('buildDiscrepancyRows يفلتر حسب الطلب', () => {
  const rows = buildDiscrepancyRows(
    [
      { id: '1', order_id: 'o1', quantity_ordered: 1, quantity_received: 1, unit_cost: 1 },
      { id: '2', order_id: 'o2', quantity_ordered: 1, quantity_received: 1, unit_cost: 1 },
    ],
    'o2',
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, '2');
});

test('summarizeDiscrepancies يجمع الزيادات والنواقص والصافي', () => {
  const rows = buildDiscrepancyRows([
    { id: '1', order_id: 'o1', quantity_ordered: 10, quantity_received: 12, unit_cost: 5 },
    { id: '2', order_id: 'o1', quantity_ordered: 10, quantity_received: 7, unit_cost: 5 },
    { id: '3', order_id: 'o1', quantity_ordered: 10, quantity_received: 10, unit_cost: 5 },
  ]);
  const totals = summarizeDiscrepancies(rows);

  assert.equal(totals.excessValue, 10);
  assert.equal(totals.shortageValue, -15);
  assert.equal(totals.netBalance, -5);
  assert.equal(totals.excessCount, 1);
  assert.equal(totals.shortageCount, 1);
  assert.equal(totals.completeCount, 1);
});

test('filterRowsByDateRange يفلتر داخل الفترة فقط', () => {
  const rows = [
    { receipt_date: '2026-01-01T10:00:00Z' },
    { receipt_date: '2026-02-15T10:00:00Z' },
    { receipt_date: '2026-03-20T10:00:00Z' },
  ];

  const filtered = filterRowsByDateRange(rows, '2026-02-01', '2026-02-28');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].receipt_date.startsWith('2026-02-15'), true);
  assert.equal(filterRowsByDateRange(rows, '', '').length, 3);
});

test('buildInventoryReportRows يحسب قيمة المخزون', () => {
  const rows = buildInventoryReportRows([{ item_number: 'A', item_name: 'قطعة', available_stock: 4, average_cost: 2.5 }]);
  assert.equal(rows[0].stock_value, 10);
  assert.equal(rows[0].available_stock, 4);
});

test('summarizeFulfillment يجمع الكميات ونسبتها', () => {
  const summary = summarizeFulfillment([
    { quantity_ordered: 10, quantity_received: 5 },
    { quantity_ordered: 10, quantity_received: 10 },
  ]);

  assert.equal(summary.orderedQuantity, 20);
  assert.equal(summary.receivedQuantity, 15);
  assert.equal(summary.remainingQuantity, 5);
  assert.equal(summary.receivedPercent, 75);
});

test('buildStatusDistribution يوزّع الطلبات على الحالات', () => {
  const distribution = buildStatusDistribution([{ status: 'pending' }, { status: 'pending' }, { status: 'completed' }]);
  assert.deepEqual(distribution.sort((a, b) => a.status.localeCompare(b.status)), [
    { status: 'completed', value: 1 },
    { status: 'pending', value: 2 },
  ]);
});
