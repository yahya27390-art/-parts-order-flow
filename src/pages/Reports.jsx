import React, { useState, useEffect } from 'react';
import { db as base44 } from '@/api/databaseClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileDown, Printer, ClipboardList, Package, Filter, AlertCircle, Scale } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import SupplierDiscrepanciesReport from '@/components/SupplierDiscrepanciesReport';

export default function Reports() {
  const [receipts, setReceipts] = useState([]);
  const [receiptItems, setReceiptItems] = useState([]);
  const [items, setItems] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [receiptsData, receiptItemsData, itemsData, ordersData, orderItemsData] = await Promise.all([
        base44.entities.GoodsReceipt.list('-receipt_date'),
        base44.entities.GoodsReceiptItem.list(),
        base44.entities.Item.list(),
        base44.entities.PurchaseOrder.list('-created_date'),
        base44.entities.PurchaseOrderItem.list()
      ]);
      setReceipts(receiptsData);
      setReceiptItems(receiptItemsData);
      setItems(itemsData);
      setPurchaseOrders(ordersData);
      setPurchaseOrderItems(orderItemsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReceipts = receipts.filter(receipt => {
    const receiptDate = new Date(receipt.receipt_date);
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;

    if (fromDate && receiptDate < fromDate) return false;
    if (toDate && receiptDate > toDate) return false;
    return true;
  });

  const getReceiptItems = (receiptId) => {
    return receiptItems.filter(item => item.receipt_id === receiptId);
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToCSV = (data, filename) => {
    const headers = Object.keys(data[0] || {}).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  const exportReceiptsReport = () => {
    const data = filteredReceipts.map(r => ({
      'رقم الإذن': r.receipt_number,
      'رقم الطلب': r.order_number,
      'التاريخ': new Date(r.receipt_date).toLocaleString('ar-SA'),
      'الإجمالي': r.total_amount
    }));
    exportToCSV(data, 'receipts_report');
  };

  const exportInventoryReport = () => {
    const data = items.map(i => ({
      'رقم الصنف': i.item_number,
      'اسم الصنف': i.item_name,
      'الرصيد': i.current_stock || 0,
      'متوسط التكلفة': i.average_cost || 0
    }));
    exportToCSV(data, 'inventory_report');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>التقارير</h1>
        <p className="text-slate-500 mt-1">تقارير النظام والبيانات</p>
      </div>

      <Tabs defaultValue="receipts" className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="receipts" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            إذونات الاستلام
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" />
            المخزون الحالي
          </TabsTrigger>
          <TabsTrigger value="negative" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            أصناف بالسالب
          </TabsTrigger>
          <TabsTrigger value="discrepancies" className="gap-2">
            <Scale className="h-4 w-4" />
            فروقات الموردين
          </TabsTrigger>
        </TabsList>

        {/* Receipts Report */}
        <TabsContent value="receipts" className="space-y-6">
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Filter className="h-5 w-5" />
                فلترة التقرير
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label>من تاريخ</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  مسح الفلتر
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Report Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
            <Button variant="outline" onClick={exportReceiptsReport}>
              <FileDown className="h-4 w-4 ml-2" />
              تصدير Excel
            </Button>
          </div>

          {/* Report Table */}
          <Card className="border-0 shadow-sm print:shadow-none">
            <CardHeader className="print:pb-2 border-b" style={{ backgroundColor: '#1e3a5f' }}>
              <CardTitle className="text-lg text-white">تقرير إذونات الاستلام</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredReceipts.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  لا توجد بيانات للعرض
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-right">رقم الإذن</TableHead>
                        <TableHead className="text-right">رقم الطلب</TableHead>
                        <TableHead className="text-right">تاريخ الاستلام</TableHead>
                        <TableHead className="text-right">الأصناف</TableHead>
                        <TableHead className="text-right">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReceipts.map(receipt => {
                        const items = getReceiptItems(receipt.id);
                        return (
                          <TableRow key={receipt.id}>
                            <TableCell className="font-medium">{receipt.receipt_number}</TableCell>
                            <TableCell>{receipt.order_number}</TableCell>
                            <TableCell>{new Date(receipt.receipt_date).toLocaleString('ar-SA')}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {items.slice(0, 2).map((item, idx) => (
                                  <div key={idx} className="text-slate-600">
                                    <span dir="ltr" style={{ display: 'inline-block' }}>{item.item_number}</span> ({item.quantity_received})
                                  </div>
                                ))}
                                {items.length > 2 && (
                                  <span className="text-slate-400">+{items.length - 2} أصناف أخرى</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium" style={{ color: '#d4a853' }}>{(receipt.total_amount || 0).toFixed(2)} ر.س</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Report */}
        <TabsContent value="inventory" className="space-y-6">
          {/* Report Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
            <Button variant="outline" onClick={exportInventoryReport}>
              <FileDown className="h-4 w-4 ml-2" />
              تصدير Excel
            </Button>
          </div>

          {/* Report Table */}
          <Card className="border-0 shadow-sm print:shadow-none">
            <CardHeader className="print:pb-2 border-b" style={{ backgroundColor: '#1e3a5f' }}>
              <CardTitle className="text-lg text-white">تقرير المخزون الحالي</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  لا توجد بيانات للعرض
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-right">رقم الصنف</TableHead>
                        <TableHead className="text-right">اسم الصنف</TableHead>
                        <TableHead className="text-right">الرصيد الحالي</TableHead>
                        <TableHead className="text-right">متوسط التكلفة</TableHead>
                        <TableHead className="text-right">قيمة المخزون</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell><span dir="ltr" className="font-mono" style={{ display: 'inline-block', textAlign: 'left' }}>{item.item_number}</span></TableCell>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell className="font-medium">{item.current_stock || 0}</TableCell>
                          <TableCell>{(item.average_cost || 0).toFixed(2)} ر.س</TableCell>
                          <TableCell className="font-medium">
                            {((item.current_stock || 0) * (item.average_cost || 0)).toFixed(2)} ر.س
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total Row */}
                      <TableRow className="font-bold" style={{ backgroundColor: '#f8f9fa' }}>
                        <TableCell colSpan={2}>الإجمالي</TableCell>
                        <TableCell>{items.reduce((sum, i) => sum + (i.current_stock || 0), 0)}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell style={{ color: '#d4a853' }}>
                          {items.reduce((sum, i) => sum + ((i.current_stock || 0) * (i.average_cost || 0)), 0).toFixed(2)} ر.س
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Negative Stock Report */}
        <TabsContent value="negative" className="space-y-6">
          {/* Report Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
            <Button variant="outline" onClick={() => {
              const negativeItems = items.filter(i => (i.current_stock || 0) < 0);
              const data = negativeItems.map(i => ({
                'رقم الصنف': i.item_number,
                'اسم الصنف': i.item_name,
                'الرصيد': i.current_stock || 0
              }));
              exportToCSV(data, 'negative_stock_report');
            }}>
              <FileDown className="h-4 w-4 ml-2" />
              تصدير Excel
            </Button>
          </div>

          {/* Report Table */}
          <Card className="border-0 shadow-sm print:shadow-none">
            <CardHeader className="print:pb-2 border-b" style={{ backgroundColor: '#1e3a5f' }}>
              <CardTitle className="text-lg text-white">تقرير الأصناف المستلمة بالسالب (زائدة عن الطلبات)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {items.filter(i => (i.current_stock || 0) < 0).length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>لا توجد أصناف برصيد سالب</p>
                  <p className="text-sm mt-2">الأصناف السالبة هي التي تم استلامها بكميات زائدة عن طلبات الشراء</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-right">رقم الصنف</TableHead>
                        <TableHead className="text-right">اسم الصنف</TableHead>
                        <TableHead className="text-right">الرصيد الحالي</TableHead>
                        <TableHead className="text-right">الكمية المطلوب طلبها</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.filter(i => (i.current_stock || 0) < 0).map(item => (
                        <TableRow key={item.id}>
                          <TableCell><span dir="ltr" className="font-mono" style={{ display: 'inline-block', textAlign: 'left' }}>{item.item_number}</span></TableCell>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell className="text-red-600 font-bold">{item.current_stock || 0}</TableCell>
                          <TableCell className="font-bold" style={{ color: '#d4a853' }}>{Math.abs(item.current_stock || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot>
                      <tr className="font-bold" style={{ backgroundColor: '#f8f9fa' }}>
                        <td colSpan="2" className="p-3">الإجمالي</td>
                        <td className="p-3 text-red-600">{items.filter(i => (i.current_stock || 0) < 0).reduce((sum, i) => sum + (i.current_stock || 0), 0)}</td>
                        <td className="p-3" style={{ color: '#d4a853' }}>{Math.abs(items.filter(i => (i.current_stock || 0) < 0).reduce((sum, i) => sum + (i.current_stock || 0), 0))}</td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supplier Discrepancies Report */}
        <TabsContent value="discrepancies" className="space-y-6">
          <SupplierDiscrepanciesReport orders={purchaseOrders} orderItems={purchaseOrderItems} />
        </TabsContent>
      </Tabs>
    </div>
  );
}