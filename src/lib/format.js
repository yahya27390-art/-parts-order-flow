/**
 * format.js — تنسيق موحّد للأرقام والتواريخ والعملة (بدل تكرار .toFixed في الصفحات).
 */
export const CURRENCY_SUFFIX = 'ر.س';

export const toNumber = (value, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const formatNumber = (value, digits = 2) =>
  toNumber(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const formatQuantity = (value) => {
  const parsed = toNumber(value);
  return Number.isInteger(parsed) ? String(parsed) : formatNumber(parsed, 3);
};

export const formatCurrency = (value, { withSuffix = true } = {}) =>
  `${formatNumber(value)}${withSuffix ? ` ${CURRENCY_SUFFIX}` : ''}`;

export const formatCurrencyCompact = (value) => {
  const parsed = toNumber(value);
  if (Math.abs(parsed) >= 1_000_000) return `${formatNumber(parsed / 1_000_000, 1)} م ${CURRENCY_SUFFIX}`;
  if (Math.abs(parsed) >= 1_000) return `${formatNumber(parsed / 1_000, 1)} ألف ${CURRENCY_SUFFIX}`;
  return formatCurrency(parsed);
};

export const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value, options = { dateStyle: 'medium' }) => {
  const date = parseDate(value);
  if (!date) return '-';
  try {
    return new Intl.DateTimeFormat('ar-SA', options).format(date);
  } catch {
    return date.toLocaleDateString('ar-SA');
  }
};

export const formatDateTime = (value) =>
  formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });

export const formatLongDate = (value) => formatDate(value, { dateStyle: 'full' });

export const toDateInputValue = (value) => {
  const date = parseDate(value) ?? new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

export const toDateTimeInputValue = (value) => {
  const date = parseDate(value) ?? new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

export const monthPeriodKey = (value) => {
  const date = parseDate(value) ?? new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
};
