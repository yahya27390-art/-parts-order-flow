import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileDown, Printer, TrendingUp, TrendingDown, Scale, Package, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function SupplierDiscrepanciesReport({ orders, orderItems }) {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [hideComplete, setHideComplete] = useState(true);

  const ordersWithItems = orders.filter(o =>
    orderItems.some(oi => oi.order_id === o.id)
  );

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  const discrepancies = useMemo(() => {
    if (!selectedOrderId) return [];
    return orderItems
      .filter(oi => oi.order_id === selectedOrderId)
      .map(oi => {
        const ordered = oi.quantity_ordered || 0;
        const received = oi.quantity_received || 0;
        const diff = received - ordered;
        const unitCost = oi.unit_cost || 0;
        return {
          ...oi,
          difference: diff,
          value_difference: diff * unitCost,
          status: diff > 0 ? 'excess' : diff < 0 ? 'shortage' : 'complete'
        };
      })
      .filter(d => !hideComplete || d.status !== 'complete');
  }, [selectedOrderId, orderItems, hideComplete]);

  const totals = useMemo(() => {
    const allItems = selectedOrderId
      ? orderItems.filter(oi => oi.order_id === selectedOrderId).map(oi => {
          const ordered = oi.quantity_ordered || 0;
          const received = oi.quantity_received || 0;
          const diff = received - ordered;
          return { difference: diff, value_difference: diff * (oi.unit_cost || 0) };
        })
      : [];
    const excessValue = allItems
      .filter(d => d.difference > 0)
      .reduce((sum, d) => sum + d.value_difference, 0);
    const shortageValue = allItems
      .filter(d => d.difference < 0)
      .reduce((sum, d) => sum + d.value_difference, 0);
    return {
      excessValue,
      shortageValue,
      netBalance: excessValue + shortageValue
    };
  }, [selectedOrderId, orderItems]);

  const handlePrint = () => window.print();

  const exportToCSV = () => {
    const data = discrepancies.map(d => ({
      'رقم القطعة': d.item_number,
      'الوصف': d.item_name,
      'المطلوب': d.quantity_ordered,
      'المستلم': d.quantity_received || 0,
      'الفرق': d.difference,
      'الحالة': d.status === 'excess' ? 'زيادة' : d.status === 'shortage' ? 'نقص' : 'مكتمل',
      'تكلفة الوحدة': d.unit_cost || 0,
      'الفرق المالي': d.value_difference.toFixed(2)
    }));
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'supplier_discrepancies.csv';
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Order selector */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <Scale className="h-5 w-5" />
            فلترة التقرير
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2 min-w-[250px] flex-1">
              <Label>اختر طلب الشراء</Label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر طلب..." />
                </SelectTrigger>
                <SelectContent>
                  {ordersWithItems.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_number} - {o.supplier_name} ({new Date(o.order_date).toLocaleDateString('ar-SA')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => setHideComplete(!hideComplete)}
            >
              {hideComplete ? <><Eye className="h-4 w-4 ml-2" /> إظهار المكتمل</> : <><EyeOff className="h-4 w-4 ml-2" /> إخفاء المكتمل</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!selectedOrderId ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">اختر طلب شراء لعرض الفروقات</p>
        </div>
      ) : discrepancies.length === 0 ? (
        <div className="text-center py-16">
          <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">
            {hideComplete ? 'لا توجد فروقات لهذا الطلب (الكميات متطابقة)' : 'لا توجد أصناف لهذا الطلب'}
          </p>
        </div>
      ) : (
        <>
          {/* Report Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              <FileDown className="h-4 w-4 ml-2" />
              تصدير Excel
            </Button>
          </div>

          {/* Order info */}
          {selectedOrder && (
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="bg-slate-100 px-4 py-2 rounded-lg">
                <span className="text-slate-500">طلب رقم: </span>
                <span className="font-medium" style={{ color: '#1e3a5f' }}>{selectedOrder.order_number}</span>
              </div>
              <div className="bg-slate-100 px-4 py-2 rounded-lg">
                <span className="text-slate-500">المورد: </span>
                <span className="font-medium" style={{ color: '#1e3a5f' }}>{selectedOrder.supplier_name}</span>
              </div>
              <div className="bg-slate-100 px-4 py-2 rounded-lg">
                <span className="text-slate-500">التاريخ: </span>
                <span className="font-medium" style={{ color: '#1e3a5f' }}>{new Date(selectedOrder.order_date).toLocaleDateString('ar-SA')}</span>
              </div>
            </div>
          )}

          {/* Discrepancies Table */}
          <Card className="border-0 shadow-sm print:shadow-none">
            <CardHeader className="print:pb-2 border-b" style={{ backgroundColor: '#1e3a5f' }}>
              <CardTitle className="text-lg text-white">تفاصيل الفروقات</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-right">رقم القطعة</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">المطلوب</TableHead>
                      <TableHead className="text-right">المستلم</TableHead>
                      <TableHead className="text-right">الفرق</TableHead>
                      <TableHead className="text-right">حالة القطعة</TableHead>
                      <TableHead className="text-right">تكلفة الوحدة</TableHead>
                      <TableHead className="text-right">الفرق المالي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discrepancies.map(d => (
                      <TableRow key={d.id} className={d.difference > 0 ? 'bg-emerald-50/50' : d.difference < 0 ? 'bg-red-50/50' : ''}>
                        <TableCell><span dir="ltr" className="font-mono" style={{ display: 'inline-block', textAlign: 'left' }}>{d.item_number}</span></TableCell>
                        <TableCell>{d.item_name}</TableCell>
                        <TableCell>{d.quantity_ordered}</TableCell>
                        <TableCell>{d.quantity_received || 0}</TableCell>
                        <TableCell className={`font-bold ${d.difference > 0 ? 'text-emerald-600' : d.difference < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {d.difference > 0 ? `+${d.difference}` : d.difference}
                        </TableCell>
                        <TableCell>
                          {d.status === 'excess' && (
                            <span className="px-2.5 py-1 text-xs font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">زيادة</span>
                          )}
                          {d.status === 'shortage' && (
                            <span className="px-2.5 py-1 text-xs font-medium rounded-full border bg-red-50 text-red-700 border-red-200">نقص</span>
                          )}
                          {d.status === 'complete' && (
                            <span className="px-2.5 py-1 text-xs font-medium rounded-full border bg-slate-100 text-slate-600 border-slate-200">مكتمل</span>
                          )}
                        </TableCell>
                        <TableCell>{(d.unit_cost || 0).toFixed(2)} ر.س</TableCell>
                        <TableCell className={`font-medium ${d.value_difference > 0 ? 'text-emerald-600' : d.value_difference < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {d.value_difference > 0 ? '+' : ''}{d.value_difference.toFixed(2)} ر.س
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(to left, #d1fae5, white)' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">إجمالي قيمة الزيادات</p>
                    <p className="text-xl font-bold text-emerald-700">{totals.excessValue.toFixed(2)} ر.س</p>
                    <p className="text-xs text-slate-400">المورد يطالبك به</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(to left, #fee2e2, white)' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-red-500">
                    <TrendingDown className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">إجمالي قيمة النواقص</p>
                    <p className="text-xl font-bold text-red-700">{Math.abs(totals.shortageValue).toFixed(2)} ر.س</p>
                    <p className="text-xs text-slate-400">أنت تطالب المورد به</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm" style={{ background: totals.netBalance >= 0 ? 'linear-gradient(to left, #dbeafe, white)' : 'linear-gradient(to left, #fff3cd, white)' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: totals.netBalance >= 0 ? '#1e3a5f' : '#d4a853' }}>
                    <Scale className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">الصافي (الرصيد)</p>
                    <p className="text-xl font-bold" style={{ color: totals.netBalance >= 0 ? '#1e3a5f' : '#d4a853' }}>
                      {totals.netBalance > 0 ? '+' : ''}{totals.netBalance.toFixed(2)} ر.س
                    </p>
                    <p className="text-xs text-slate-400">
                      {totals.netBalance > 0 ? 'لصالح الشركة' : totals.netBalance < 0 ? 'لصالح المورد' : 'متعادل'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}