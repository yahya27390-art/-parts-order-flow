import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsv, csvNumber, escapeCsvCell } from './csv.js';

test('escapeCsvCell يحيط القيم التي تحتوي فاصلة أو تنصيصًا أو سطرًا جديدًا', () => {
  assert.equal(escapeCsvCell('عادي'), 'عادي');
  assert.equal(escapeCsvCell('قطعة, كبيرة'), '"قطعة, كبيرة"');
  assert.equal(escapeCsvCell('وصف "مهم"'), '"وصف ""مهم"""');
  assert.equal(escapeCsvCell('سطر\nثاني'), '"سطر\nثاني"');
});

test('escapeCsvCell يتعامل مع القيم الفارغة والأرقام', () => {
  assert.equal(escapeCsvCell(null), '');
  assert.equal(escapeCsvCell(undefined), '');
  assert.equal(escapeCsvCell(0), '0');
  assert.equal(escapeCsvCell(12.5), '12.5');
});

test('buildCsv يبني رأسًا وصفوفًا بالترتيب الصحيح', () => {
  const csv = buildCsv(
    [{ item_number: 'A-1', item_name: 'قطعة, أولى' }],
    [
      { key: 'item_number', label: 'رقم الصنف' },
      { key: 'item_name', label: 'اسم الصنف' },
    ],
  );

  assert.equal(csv, 'رقم الصنف,اسم الصنف\r\nA-1,"قطعة, أولى"');
});

test('buildCsv يعيد الرأس فقط عند عدم وجود صفوف', () => {
  assert.equal(buildCsv([], [{ key: 'a', label: 'أ' }]), 'أ');
});

test('csvNumber ينسّق الأرقام بلا فواصل آلاف', () => {
  assert.equal(csvNumber(1234.5), '1234.50');
  assert.equal(csvNumber('7'), '7.00');
  assert.equal(csvNumber(null), '0.00');
});
