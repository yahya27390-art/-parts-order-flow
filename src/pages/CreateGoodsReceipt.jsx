import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
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

export default function CreateGoodsReceipt() {
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [receiptData, setReceiptData] = useState({
    receipt_number: '',
    receipt_date: new Date().toISOString().slice(0, 16),
    notes: ''
  });
  const [receiptItems, setReceiptItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showExcessConfirm, setShowExcessConfirm] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order_id');

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
      generateReceiptNumber();
    }
    loadUser();
  }, [orderId]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (e) {}
  };

  const loadOrderDetails = async () => {
    try {
      const [orderData, itemsData] = await Promise.all([
        base44.entities.PurchaseOrder.filter({ id: orderId }),
        base44.entities.PurchaseOrderItem.filter({ order_id: orderId })
      ]);

      setOrder(orderData[0]);
      setOrderItems(itemsData);
      
      // Initialize receipt items with remaining quantities
      const initialItems = itemsData.map(item => ({
        order_item_id: item.id,
        item_id: item.item_id,
        item_number: item.item_number,
        item_name: item.item_name,
        quantity_ordered: item.quantity_ordered,
        quantity_received_before: item.quantity_received || 0,
        remaining: item.quantity_ordered - (item.quantity_received || 0),
        quantity_to_receive: 0,
        unit_cost: item.unit_cost
      }));
      setReceiptItems(initialItems);
    } catch (error) {
      toast.error('حدث خطأ في تحميل بيانات الطلب');
    } finally {
      setLoading(false);
    }
  };

  const generateReceiptNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setReceiptData(prev => ({ ...prev, receipt_number: `GR-${year}${month}${day}-${random}` }));
  };

  const updateReceiptItem = (index, quantity) => {
    const updated = [...receiptItems];
    // السماح بأي كمية بما فيها الزائدة عن المطلوب
    updated[index].quantity_to_receive = Math.max(0, quantity);
    setReceiptItems(updated);
  };

  // Barcode / fast entry handler
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const index = receiptItems.findIndex(item => 
      item.item_number?.toLowerCase() === code.toLowerCase()
    );

    if (index === -1) {
      toast.error(`لم يتم العثور على صنف برقم: ${code}`);
      setBarcodeInput('');
      return;
    }

    // Increment quantity for matched item
    const updated = [...receiptItems];
    updated[index].quantity_to_receive = (updated[index].quantity_to_receive || 0) + 1;
    setReceiptItems(updated);
    toast.success(`تم إضافة: ${updated[index].item_name}`);
    setBarcodeInput('');
  };

  const calculateTotal = () => {
    return receiptItems.reduce((sum, item) => sum + (item.quantity_to_receive * item.unit_cost), 0);
  };

  const hasItemsToReceive = () => {
    return receiptItems.some(item => item.quantity_to_receive > 0);
  };

  const hasExcessItems = () => {
    return receiptItems.some(item => item.quantity_to_receive > item.remaining);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!hasItemsToReceive()) {
      toast.error('يجب تحديد كمية لصنف واحد على الأقل');
      return;
    }

    if (hasExcessItems()) {
      setShowExcessConfirm(true);
      return;
    }

    await processReceipt();
  };

  const processReceipt = async () => {
    setSaving(true);
    try {
      // Create goods receipt
      const receipt = await base44.entities.GoodsReceipt.create({
        ...receiptData,
        order_id: orderId,
        order_number: order.order_number,
        total_amount: calculateTotal(),
        last_modified_by: user?.full_name || user?.email || '',
        last_modified_at: new Date().toISOString()
      });

      // Process each item - DEDUCT from stock
      let allItemsCompleted = true;
      for (const item of receiptItems) {
        if (item.quantity_to_receive > 0) {
          // Create receipt item
          await base44.entities.GoodsReceiptItem.create({
            receipt_id: receipt.id,
            order_item_id: item.order_item_id,
            item_id: item.item_id,
            item_number: item.item_number,
            item_name: item.item_name,
            quantity_received: item.quantity_to_receive,
            unit_cost: item.unit_cost,
            total_cost: item.quantity_to_receive * item.unit_cost
          });

          // Update order item received quantity
          const newReceived = item.quantity_received_before + item.quantity_to_receive;
          await base44.entities.PurchaseOrderItem.update(item.order_item_id, {
            quantity_received: newReceived
          });

          // Check if item is complete
          if (newReceived < item.quantity_ordered) {
            allItemsCompleted = false;
          }

          // Deduct normal portion from stock, ADD excess portion to available stock
          const itemData = await base44.entities.Item.filter({ id: item.item_id });
          if (itemData[0]) {
            const currentStock = itemData[0].current_stock || 0;
            const pendingStock = itemData[0].pending_stock || 0;
            const normalPortion = Math.min(item.quantity_to_receive, item.remaining);
            const excessPortion = Math.max(0, item.quantity_to_receive - item.remaining);

            await base44.entities.Item.update(item.item_id, {
              current_stock: currentStock - normalPortion + excessPortion,
              pending_stock: Math.max(0, pendingStock - normalPortion)
            });
          }
        } else if (item.remaining > 0) {
          allItemsCompleted = false;
        }
      }

      // Update order status
      await base44.entities.PurchaseOrder.update(orderId, {
        status: allItemsCompleted ? 'completed' : 'partial'
      });

      toast.success('تم تسجيل إذن الاستلام بنجاح');
      navigate(createPageUrl('GoodsReceipts'));
    } catch (error) {
      toast.error('حدث خطأ في تسجيل الاستلام');
      console.error(error);
    } finally {
      setSaving(false);
    }
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