import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Save, Package, ScanLine, ExternalLink } from 'lucide-react';
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/lib/AuthContext';
import { useOrderDetail } from '@/features/orders/hooks';
import { useCreateGoodsReceipt } from '@/features/receipts/hooks';
import { buildReceiptDraft, findRowIndexByItemNumber, summarizeReceiptDraft, updateDraftQuantity, incrementDraftQuantity } from '@/features/receipts/logic';
import { toDateTimeInputValue } from '@/lib/format';
import { generateReceiptNumber } from '@/lib/documentNumbers';

export default function CreateGoodsReceipt() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order_id');

  const { data: orderDetail, isLoading } = useOrderDetail(orderId);
  const createReceipt = useCreateGoodsReceipt();

  const order = orderDetail?.order ?? null;

  const [receiptData, setReceiptData] = useState({
    receipt_number: generateReceiptNumber(new Date()),
    receipt_date: toDateTimeInputValue(new Date()),
    notes: '',
  });
  const [receiptItems, setReceiptItems] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showExcessConfirm, setShowExcessConfirm] = useState(false);

  useEffect(() => {
    if (orderDetail?.items?.length) {
      setReceiptItems(buildReceiptDraft(orderDetail.items));
    }
  }, [orderDetail]);

  const loading = Boolean(orderId) && isLoading;
  const saving = createReceipt.isPending;
  const summary = summarizeReceiptDraft(receiptItems);

  const updateReceiptItem = (index, quantity) =>
    setReceiptItems((current) => updateDraftQuantity(current, index, quantity));

  // إدخال سريع بالباركود: كل قراءة تزيد الكمية بمقدار واحد.
  const handleBarcodeSubmit = (event) => {
    event.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const index = findRowIndexByItemNumber(receiptItems, code);
    if (index === -1) {
      toast.error(`لم يتم العثور على صنف برقم: ${code}`);
      setBarcodeInput('');
      return;
    }

    setReceiptItems((current) => incrementDraftQuantity(current, index, 1));
    toast.success(`تم إضافة: ${receiptItems[index].item_name}`);
    setBarcodeInput('');
  };

  const calculateTotal = () => summary.totalAmount;
  const hasItemsToReceive = () => summary.hasAnyQuantity;

  const processReceipt = async () => {
    try {
      await createReceipt.mutateAsync({
        orderId,
        receipt: receiptData,
        rows: receiptItems,
        actorName: user?.full_name || user?.email || '',
      });
      navigate(createPageUrl('GoodsReceipts'));
    } catch {
      /* رسالة الخطأ تظهر من الـ hook */
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!summary.hasAnyQuantity) {
      toast.error('يجب تحديد كمية لصنف واحد على الأقل');
      return;
    }

    if (summary.hasExcess) {
      setShowExcessConfirm(true);
      return;
    }

    await processReceipt();
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl('GoodsReceipts'))}
          className="hover:bg-slate-200"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>إذن استلام جديد</h1>
          <p className="text-slate-500 mt-1">طلب رقم: {order.order_number} - {order.supplier_name}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.open(createPageUrl(`PurchaseOrderDetails?id=${orderId}`), '_blank')}
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          عرض الطلب
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Receipt Details */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <CardTitle className="text-lg text-white">بيانات الإذن</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
            <div className="space-y-2">
              <Label>رقم إذن الاستلام</Label>
              <Input
                value={receiptData.receipt_number}
                onChange={(e) => setReceiptData({...receiptData, receipt_number: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ ووقت الاستلام</Label>
              <Input
                type="datetime-local"
                value={receiptData.receipt_date}
                onChange={(e) => setReceiptData({...receiptData, receipt_date: e.target.value})}
                required
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={receiptData.notes}
                onChange={(e) => setReceiptData({...receiptData, notes: e.target.value})}
                placeholder="ملاحظات إضافية..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Barcode Fast Entry */}
        <Card className="border-0 shadow-sm" style={{ backgroundColor: '#f0f7ff' }}>
          <CardContent className="p-4">
            <form onSubmit={handleBarcodeSubmit} className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label className="flex items-center gap-2" style={{ color: '#1e3a5f' }}>
                  <ScanLine className="h-4 w-4" />
                  إدخال سريع بالباركود
                </Label>
                <Input
                  placeholder="امسح أو اكتب رقم الصنف ثم اضغط Enter..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  dir="ltr"
                  className="text-left font-mono"
                  autoFocus
                />
              </div>
              <Button type="submit" variant="outline">
                إضافة
              </Button>
            </form>
            <p className="text-xs text-slate-500 mt-2">
              استخدم قارئ الباركود أو اكتب رقم الصنف (مثل: 97701-F1500) ثم Enter لإضافة الكمية تلقائياً
            </p>
          </CardContent>
        </Card>

        {/* Items to Receive */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <CardTitle className="text-lg text-white">الأصناف المستلمة (سيتم خصمها من المخزون)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">رقم الصنف</TableHead>
                    <TableHead className="text-right">اسم الصنف</TableHead>
                    <TableHead className="text-right">المطلوب</TableHead>
                    <TableHead className="text-right">المستلم سابقاً</TableHead>
                    <TableHead className="text-right">المتبقي</TableHead>
                    <TableHead className="text-right">الكمية المستلمة</TableHead>
                    <TableHead className="text-right">السعر</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptItems.map((item, index) => (
                    <TableRow key={item.order_item_id}>
                      <TableCell><span dir="ltr" className="font-mono" style={{ display: 'inline-block', textAlign: 'left' }}>{item.item_number}</span></TableCell>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell>{item.quantity_ordered}</TableCell>
                      <TableCell>{item.quantity_received_before}</TableCell>
                      <TableCell className={item.remaining > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
                        {item.remaining}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={item.quantity_to_receive}
                          onChange={(e) => updateReceiptItem(index, parseInt(e.target.value) || 0)}
                          className={`w-24 ${item.quantity_to_receive > item.remaining ? 'border-amber-500 bg-amber-50' : ''}`}
                        />
                        {item.quantity_to_receive > item.remaining && (
                          <span className="text-xs text-amber-600 block mt-1">زائد: +{item.quantity_to_receive - item.remaining}</span>
                        )}
                      </TableCell>
                      <TableCell>{(item.unit_cost || 0).toFixed(2)} ر.س</TableCell>
                      <TableCell className="font-medium">
                        {(item.quantity_to_receive * item.unit_cost).toFixed(2)} ر.س
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end p-4 border-t">
              <div className="text-lg font-bold">
                الإجمالي: <span style={{ color: '#d4a853' }}>{calculateTotal().toFixed(2)} ر.س</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl('GoodsReceipts'))}
          >
            إلغاء
          </Button>
          <Button 
            type="submit" 
            disabled={saving || !hasItemsToReceive()}
            style={{ backgroundColor: '#1e3a5f' }}
            className="hover:opacity-90"
          >
            <Save className="h-4 w-4 ml-2" />
            {saving ? 'جاري الحفظ...' : 'حفظ إذن الاستلام'}
          </Button>
        </div>
      </form>

      {/* Excess Quantity Confirmation Dialog */}
      <AlertDialog open={showExcessConfirm} onOpenChange={setShowExcessConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>الكمية المدخلة أكبر من المطلوبة</AlertDialogTitle>
            <AlertDialogDescription>
              يوجد صنف أو أكثر بكمية مستلمة تتجاوز الكمية المطلوبة. سيتم إضافة الزيادة مباشرة إلى رصيد المخزون المتاح. هل أنت متأكد من المتابعة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowExcessConfirm(false);
                await processReceipt();
              }}
              style={{ backgroundColor: '#1e3a5f' }}
            >
              نعم، تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}