import React, { useState } from 'react';
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
import { useInventoryReport, useNegativeStockReport, useReceiptsReport, useSupplierDiscrepancies } from '@/features/reports/hooks';
import { useOrdersPage } from '@/features/orders/hooks';
import { downloadCsv, csvFileStamp, csvNumber } from '@/lib/csv';
import { formatCurrency, formatNumber, formatQuantity } from '@/lib/format';

export default function Reports() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [discrepancyOrderId, setDiscrepancyOrderId] = useState('');

  const { data: receiptsReport, isLoading: loadingReceipts } = useReceiptsReport({ from: dateFrom, to: dateTo });
  const { data: inventoryRows, isLoading: loadingInventory } = useInventoryReport();
  const { data: negativeRows, isLoading: loadingNegative } = useNegativeStockReport();
  const { data: ordersPage } = useOrdersPage({ pageSize: 100 });
  const { data: discrepancyRows } = useSupplierDiscrepancies(discrepancyOrderId || null);

  const receipts = receiptsReport?.receipts ?? [];
  const receiptItems = receiptsReport?.items ?? [];
  const items = inventoryRows ?? [];
  const negativeItems = negativeRows ?? [];
  const purchaseOrders = ordersPage?.rows ?? [];

  const loading = loadingReceipts || loadingInventory || loadingNegative;

  // الفلترة الزمنية تتم على الخادم حسب الفترة المحددة.
  const filteredReceipts = receipts;

  const getReceiptItems = (receiptId) => {
    return receiptItems.filter(item => item.receipt_id === receiptId);
  };

  const handlePrint = () => {
    window.print();
  };

  const exportReceiptsReport = () => {
    downloadCsv(
      `receipts-report-${csvFileStamp()}`,
      filteredReceipts,
      [
        { key: 'receipt_number', label: 'رقم الإذن' },
        { key: 'order_number', label: 'رقم الطلب' },
        { key: 'receipt_date', label: 'التاريخ' },
        { key: 'total_amount', label: 'الإجمالي' },
      ],
    );
  };

  const exportInventoryReport = () => {
    downloadCsv(
      `inventory-report-${csvFileStamp()}`,
      items.map((item) => ({
        item_number: item.item_number,
        item_name: item.item_name,
        available_stock: csvNumber(item.available_stock),
        on_order_stock: csvNumber(item.on_order_stock),
        average_cost: csvNumber(item.average_cost),
        stock_value: csvNumber(item.stock_value),
      })),
      [
        { key: 'item_number', label: 'رقم الصنف' },
        { key: 'item_name', label: 'اسم الصنف' },
        { key: 'available_stock', label: 'الرصيد المتاح' },
        { key: 'on_order_stock', label: 'مخزون الطلبات' },
        { key: 'average_cost', label: 'متوسط التكلفة' },
        { key: 'stock_value', label: 'قيمة المخزون' },
      ],
    );
  };

  const exportNegativeStockReport = () => {
    downloadCsv(
      `negative-stock-${csvFileStamp()}`,
      negativeItems.map((item) => ({
        item_number: item.item_number,
        item_name: item.item_name,
        available_stock: csvNumber(item.available_stock),
      })),
      [
        { key: 'item_number', label: 'رقم الصنف' },
        { key: 'item_name', label: 'اسم الصنف' },
        { key: 'available_stock', label: 'الرصيد' },
      ],
    );
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
                          <TableCell className="font-medium">{formatQuantity(item.available_stock)}</TableCell>
                          <TableCell>{formatCurrency(item.average_cost)}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(item.stock_value)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total Row */}
                      <TableRow className="font-bold" style={{ backgroundColor: '#f8f9fa' }}>
                        <TableCell colSpan={2}>الإجمالي</TableCell>
                        <TableCell>{formatNumber(items.reduce((sum, i) => sum + Number(i.available_stock || 0), 0), 0)}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell style={{ color: '#d4a853' }}>
                          {formatCurrency(items.reduce((sum, i) => sum + Number(i.stock_value || 0), 0))}
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
            <Button variant="outline" onClick={exportNegativeStockReport}>
              <FileDown className="h-4 w-4 ml-2" />
              تصدير Excel
            </Button>
          </div>

          {/* Report Table */}
          <Card className="border-0 shadow-sm print:shadow-none">
            <CardHeader className="print:pb-2 border-b" style={{ backgroundColor: '#1e3a5f' }}>
              <CardTitle className="text-lg text-white">تقرير الأرصدة السالبة (تحتاج مراجعة وتسوية)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {negativeItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>لا توجد أصناف برصيد سالب</p>
                  <p className="text-sm mt-2">الرصيد السالب يدل على خلل في البيانات ويجب تسويته من صفحة الأصناف</p>
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
                      {negativeItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell><span dir="ltr" className="font-mono" style={{ display: 'inline-block', textAlign: 'left' }}>{item.item_number}</span></TableCell>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell className="text-red-600 font-bold">{formatQuantity(item.available_stock)}</TableCell>
                          <TableCell className="font-bold" style={{ color: '#d4a853' }}>{formatQuantity(Math.abs(item.available_stock))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot>
                      <tr className="font-bold" style={{ backgroundColor: '#f8f9fa' }}>
                        <td colSpan="2" className="p-3">الإجمالي</td>
                        <td className="p-3 text-red-600">{formatQuantity(negativeItems.reduce((sum, i) => sum + Number(i.available_stock || 0), 0))}</td>
                        <td className="p-3" style={{ color: '#d4a853' }}>{formatQuantity(Math.abs(negativeItems.reduce((sum, i) => sum + Number(i.available_stock || 0), 0)))}</td>
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
          <SupplierDiscrepanciesReport
            orders={purchaseOrders}
            orderId={discrepancyOrderId}
            onOrderChange={setDiscrepancyOrderId}
            rows={discrepancyRows ?? []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}