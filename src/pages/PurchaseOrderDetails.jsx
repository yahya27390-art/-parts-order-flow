import React, { useState, useEffect } from 'react';
import { db as base44 } from '@/api/databaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, ClipboardCheck, Printer, Package, Pencil } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export default function PurchaseOrderDetails() {
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
    }
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      const [orderData, itemsData, receiptsData, settingsData] = await Promise.all([
        base44.entities.PurchaseOrder.filter({ id: orderId }),
        base44.entities.PurchaseOrderItem.filter({ order_id: orderId }),
        base44.entities.GoodsReceipt.filter({ order_id: orderId }),
        base44.entities.SystemSettings.list()
      ]);

      setOrder(orderData[0]);
      setOrderItems(itemsData);
      setReceipts(receiptsData);
      setSettings(settingsData[0] || null);
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      partial: 'bg-blue-50 text-blue-700 border-blue-200',
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      cancelled: 'bg-red-50 text-red-700 border-red-200'
    };
    const labels = {
      pending: 'معلق',
      partial: 'جزئي',
      completed: 'مكتمل',
      cancelled: 'ملغي'
    };
    return (
      <Badge variant="outline" className={styles[status] || styles.pending}>
        {labels[status] || status}
      </Badge>
    );
  };

  const calculateProgress = (item) => {
    if (!item.quantity_ordered) return 0;
    return Math.min(100, ((item.quantity_received || 0) / item.quantity_ordered) * 100);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">لم يتم العثور على الطلب</p>
      </div>
    );
  }

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 11mm 10mm 13mm;
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
            top: 0;
            right: 0;
            width: 100%;
            padding: 0;
            background: white;
            color: #172033;
            font-size: 10px;
            line-height: 1.35;
          }

          .no-print {
            display: none !important;
          }

          .print-header {
            display: block !important;
            position: relative;
            overflow: hidden;
            border: 1px solid #cbd5e1;
            border-top: 5px solid #1e3a5f;
            border-radius: 3px;
            padding: 0;
            margin-bottom: 10px;
            background: #fff;
          }

          .print-brand-row {
            position: relative;
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            min-height: 54px;
            height: 54px;
            padding: 7px 12px;
            color: #172033;
            background: #fff;
            border-bottom: 3px solid #d4a853;
            overflow: hidden;
          }

          .print-brand-row::after {
            display: none;
          }

          .print-brand-row::before {
            content: "طلب شراء";
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            color: #1e3a5f;
            font-size: 15px;
            font-weight: 800;
            white-space: nowrap;
          }

          .print-brand {
            display: flex !important;
            align-items: center;
            gap: 8px;
            position: relative;
            z-index: 1;
          }

          .print-brand img {
            width: 36px;
            height: 36px;
            object-fit: contain;
            padding: 0;
          }

          .print-brand-name {
            color: #1e3a5f;
            font-size: 11px;
            font-weight: 800;
          }

          .print-brand-subtitle {
            color: #64748b;
            font-size: 7px;
            margin-top: 0;
          }

          .print-brand-row > .text-left {
            position: relative;
            z-index: 1;
            min-width: 72px;
            padding-right: 8px;
            border-right: 1px solid #dbe3ee;
            color: #64748b !important;
            font-size: 7px !important;
          }

          .print-brand-row > .text-left strong {
            color: #1e3a5f !important;
            display: block;
            margin-top: 0;
          }

          .print-document-title {
            display: none !important;
          }

          .print-document-title h2 {
            color: #1e3a5f;
            font-size: 17px;
            font-weight: 800;
            margin: 0;
          }

          .print-document-title p {
            color: #64748b;
            font-size: 10px;
            margin: 3px 0 0;
          }

          .print-document-meta {
            display: none !important;
          }

          .print-document-meta strong {
            color: #1e3a5f;
          }

          .print-card {
            border: 1px solid #cbd5e1 !important;
            border-radius: 3px !important;
            box-shadow: none !important;
            break-inside: avoid;
            margin-bottom: 10px;
          }

          .print-items-card {
            break-inside: auto;
          }

          .print-items-card .print-table {
            break-inside: auto;
          }

          .print-items-card .print-table thead {
            display: table-header-group;
          }

          .print-items-card .print-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-receipts-card {
            break-inside: auto;
          }

          .print-card [data-slot="card-header"] {
            position: relative;
            padding: 7px 12px !important;
            border-right: 4px solid #d4a853;
            border-bottom: 1px solid #dbe3ee;
            background: #f8fafc !important;
          }

          .print-card [data-slot="card-title"] {
            color: #1e3a5f !important;
            font-size: 11px !important;
            font-weight: 800;
          }

          .print-card [data-slot="card-content"] {
            padding: 12px !important;
          }

          .print-order-summary [data-slot="card-content"] {
            padding: 8px 12px !important;
          }

          .print-info-grid {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0 14px !important;
          }

          .print-order-summary .print-info-grid > div {
            display: block;
            min-height: 38px;
            border-bottom: 1px solid #e2e8f0;
            padding: 3px 0 4px;
          }

          .print-order-summary .print-info-grid p {
            margin: 0;
            font-size: 8px;
            color: #64748b;
          }

          .print-order-summary .print-info-grid p.mt-1 {
            margin-top: 0 !important;
            font-size: 9px;
            font-weight: 700;
            color: #172033;
          }

          .print-order-summary .print-info-grid p.text-lg {
            font-size: 11px;
          }

          .print-order-summary .mt-6 {
            margin-top: 7px !important;
            padding-top: 6px !important;
          }

          .print-order-summary .mt-6 p {
            font-size: 8px;
            margin: 0;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
          }

          .print-table th {
            background: #1e3a5f !important;
            color: white !important;
            padding: 7px 6px;
            font-weight: 700;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-table td {
            padding: 5px 6px;
            border-bottom: 1px solid #e2e8f0;
          }

          .print-table .progress {
            display: none;
          }

          .print-table tr:nth-child(even) {
            background: #f8fafc;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-footer {
            display: flex !important;
            justify-content: space-between;
            margin-top: 16px;
            padding: 7px 10px;
            border-top: 3px solid #d4a853;
            color: #475569;
            font-size: 8px;
            background: #f8fafc;
            border-bottom: 1px solid #cbd5e1;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('PurchaseOrders'))}
            className="hover:bg-slate-200"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>{order.order_number}</h1>
              {getStatusBadge(order.status)}
            </div>
            <p className="text-slate-500 mt-1">{order.supplier_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <>
              <Link to={createPageUrl(`EditPurchaseOrder?id=${order.id}`)}>
                <Button variant="outline">
                  <Pencil className="h-4 w-4 ml-2" />
                  تعديل
                </Button>
              </Link>
              <Button 
                style={{ backgroundColor: '#d4a853' }}
                className="hover:opacity-90 text-white"
                onClick={() => navigate(createPageUrl(`CreateGoodsReceipt?order_id=${order.id}`))}
              >
                <ClipboardCheck className="h-4 w-4 ml-2" />
                إذن استلام
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="print-area" dir="rtl">
        <div className="print-header hidden print:block">
          <div className="print-brand-row">
            <div className="print-brand">
            {settings?.logo_url && settings?.show_logo_print && (
              <img
                src={settings.logo_url}
                alt="شعار النظام"
              />
            )}
            <div>
              <div className="print-brand-name">
                {settings?.system_name || 'نظام إدارة المخزون'}
              </div>
              <div className="print-brand-subtitle">نظام إدارة المشتريات والمخزون</div>
            </div>
            </div>
            <div className="text-left text-xs text-slate-500">
              <div>تاريخ الطباعة</div>
              <strong className="text-slate-700">{new Date().toLocaleDateString('ar-SA')}</strong>
            </div>
          </div>
          <div className="print-document-title">
            <h2>طلب شراء</h2>
            <p>مستند رسمي لمتابعة الطلب والاستلامات</p>
          </div>
          <div className="print-document-meta">
            <span>رقم الطلب: <strong>{order.order_number}</strong></span>
            <span>المورد: <strong>{order.supplier_name}</strong></span>
          </div>
        </div>

        {/* Order Info */}
      <Card className="border-0 shadow-sm print-card print-order-summary">
          <CardHeader>
            <CardTitle>بيانات الطلب</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print-info-grid">
            <div>
              <p className="text-sm text-slate-500">تاريخ الطلب</p>
              <p className="font-medium mt-1">{new Date(order.order_date).toLocaleDateString('ar-SA')}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">المورد</p>
              <p className="font-medium mt-1">{order.supplier_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">إجمالي الطلب</p>
              <p className="font-bold text-lg mt-1" style={{ color: '#d4a853' }}>{(order.total_amount || 0).toFixed(2)} ر.س</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">عدد الاستلامات</p>
              <p className="font-medium mt-1">{receipts.length}</p>
            </div>
          </div>
          {order.notes && (
            <div className="mt-6 pt-6 border-t print-order-notes">
              <p className="text-sm text-slate-500">ملاحظات</p>
              <p className="mt-1">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card className="border-0 shadow-sm print-card print-items-card">
        <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
          <CardTitle className="text-lg text-white">أصناف الطلب</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="print-table">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-right">رقم الصنف</TableHead>
                  <TableHead className="text-right">اسم الصنف</TableHead>
                  <TableHead className="text-right">الكمية المطلوبة</TableHead>
                  <TableHead className="text-right">الكمية المستلمة</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">نسبة الاستلام</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell><span dir="ltr" className="font-mono" style={{ display: 'inline-block', textAlign: 'left' }}>{item.item_number}</span></TableCell>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell>{item.quantity_ordered}</TableCell>
                    <TableCell className={item.quantity_received >= item.quantity_ordered ? 'text-emerald-600 font-medium' : ''}>
                      {item.quantity_received || 0}
                    </TableCell>
                    <TableCell>{(item.unit_cost || 0).toFixed(2)} ر.س</TableCell>
                    <TableCell className="w-40">
                      <div className="flex items-center gap-2">
                        <Progress value={calculateProgress(item)} className="h-2 progress" />
                        <span className="text-xs text-slate-500 w-12">
                          {calculateProgress(item).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Receipts History */}
      {receipts.length > 0 && (
        <Card className="border-0 shadow-sm print-card print-receipts-card">
          <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <CardTitle className="text-lg text-white">سجل الاستلامات</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="print-table">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">رقم الإذن</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map(receipt => (
                    <TableRow key={receipt.id} className="hover:bg-slate-50 cursor-pointer">
                      <TableCell className="font-medium">{receipt.receipt_number}</TableCell>
                      <TableCell>{new Date(receipt.receipt_date).toLocaleString('ar-SA')}</TableCell>
                      <TableCell>{(receipt.total_amount || 0).toFixed(2)} ر.س</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="print-footer hidden">
        <span>{settings?.system_name || 'نظام إدارة المخزون'}</span>
        <span>طلب شراء: {order.order_number}</span>
        <span>صفحة التقرير</span>
      </div>
      </div>
    </div>
  );
}