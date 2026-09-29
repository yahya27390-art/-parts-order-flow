/**
 * csv.js — تصدير CSV آمن (بلا اعتماديات) — النسخة السابقة كانت تكسر الأعمدة
 * التي تحتوي فاصلة أو علامة تنصيص أو سطرًا جديدًا.
 */
const toNumber = (value, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

/**
 * يبني نص CSV من مصفوفة كائنات ومصفوفة أعمدة [{ key, label }].
 */
export const buildCsv = (rows, columns, { delimiter = ',' } = {}) => {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(delimiter);
  const body = (rows || [])
    .map((row) => columns.map((column) => escapeCsvCell(row?.[column.key])).join(delimiter))
    .join('\r\n');

  return body ? `${header}\r\n${body}` : header;
};

const pad = (value) => String(value).padStart(2, '0');

export const csvFileStamp = (date = new Date()) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;

export const downloadCsv = (filename, rows, columns, options = {}) => {
  const csv = buildCsv(rows, columns, options);
  // BOM حتى تظهر العربية بشكل صحيح في Excel.
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** أرقام جاهزة للتصدير: بلا فواصل آلاف حتى تُقرأ كأرقام داخل Excel. */
export const csvNumber = (value, digits = 2) => toNumber(value).toFixed(digits);
