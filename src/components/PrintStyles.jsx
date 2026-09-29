import React from 'react';

/**
 * أنماط الطباعة المشتركة (كانت مكرّرة بنسخ مختلفة في ٤ صفحات).
 * الاستخدام: ضع <PrintStyles /> داخل الصفحة، وأضف className="print-area"
 * على العنصر المطلوب طباعته، و className="no-print" على ما لا يُطبع.
 */
export default function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page {
          size: A4 portrait;
          margin: 12mm 10mm;
        }

        body {
          background: #fff !important;
        }

        body * {
          visibility: hidden;
        }

        .print-area,
        .print-area * {
          visibility: visible;
        }

        .print-area {
          position: absolute;
          inset-inline: 0;
          top: 0;
          width: 100%;
          padding: 0;
          background: #fff;
        }

        .no-print {
          display: none !important;
        }

        .print-header {
          border-bottom: 3px double #1e3a5f;
          padding-bottom: 16px;
          margin-bottom: 16px;
        }

        .print-area table {
          width: 100%;
          border-collapse: collapse;
        }

        .print-area th,
        .print-area td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          font-size: 11px;
        }

        .print-area thead {
          background: #1e3a5f !important;
          color: #fff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .print-footer {
          margin-top: 24px;
          border-top: 1px solid #cbd5e1;
          padding-top: 8px;
          font-size: 10px;
          color: #475569;
        }
      }
    `}</style>
  );
}
