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
import { ArrowRight, Save, ClipboardList, AlertCircle } from 'lucide-react';
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function EditGoodsReceipt() {
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [originalItems, setOriginalItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const receiptId = urlParams.get('id');

  useEffect(() => {
    if (receiptId) {
      loadReceiptDetails();
    }
    loadUser();
  }, [receiptId]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser?.role !== 'admin') {
        toast.error('غير مسموح: يتطلب صلاحيات مدير');
        navigate(createPageUrl('GoodsReceipts'));
        return;
      }
      setUser(currentUser);
    } catch (e) {
      navigate(createPageUrl('GoodsReceipts'));
    }
  };

  const loadReceiptDetails = async () => {
    try {
      const [receiptData, itemsData] = await Promise.all([
        base44.entities.GoodsReceipt.filter({ id: receiptId }),
        base44.entities.GoodsReceiptItem.filter({ receipt_id: receiptId })
      ]);

      if (receiptData[0]) {
        setReceipt(receiptData[0]);
        setReceiptItems(itemsData.map(item => ({
          ...item,
          new_quantity: item.quantity_received
        })));
        setOriginalItems(itemsData);
      }
    } catch (error) {
      toast.error('حدث خطأ في تحميل بيانات الإذن');
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = (index, quantity) => {
    const updated = [...receiptItems];
    updated[index].new_quantity = Math.max(0, quantity);
    setReceiptItems(updated);
  };

  const calculateTotal = () => {
    return receiptItems.reduce((sum, item) => sum + ((item.new_quantity || 0) * (item.unit_cost || 0)), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setSaving(true);
    try {
      // Update receipt
      await base44.entities.GoodsReceipt.update(receiptId, {
        receipt_date: receipt.receipt_date,
        notes: receipt.notes,
        total_amount: calculateTotal(),
        last_modified_by: user?.full_name || user?.email || '',
        last_modified_at: new Date().toISOString()
      });

      // Update each item and adjust stock
      for (let i = 0; i < receiptItems.length; i++) {
        const item = receiptItems[i];
        const originalItem = originalItems[i];
        const quantityDiff = (item.new_quantity || 0) - (originalItem.quantity_received || 0);

        // Update receipt item
        await base44.entities.GoodsReceiptItem.update(item.id, {
          quantity_received: item.new_quantity,
          total_cost: item.new_quantity * item.unit_cost
        });

        // Adjust stock based on difference (excess adds to available stock)
        if (quantityDiff !== 0) {
          const itemData = await base44.entities.Item.filter({ id: item.item_id });
          if (itemData[0]) {
            const currentStock = itemData[0].current_stock || 0;
            // If quantity increased, deduct more from stock
            // If quantity decreased, add back to stock
            await base44.entities.Item.update(item.item_id, {
              current_stock: currentStock - quantityDiff
            });
          }

          // Update order item received quantity
          if (item.order_item_id) {
            const orderItemData = await base44.entities.PurchaseOrderItem.filter({ id: item.order_item_id });
            if (orderItemData[0]) {
              const currentReceived = orderItemData[0].quantity_received || 0;
              await base44.entities.PurchaseOrderItem.update(item.order_item_id, {
                quantity_received: Math.max(0, currentReceived + quantityDiff)
              });
            }
          }
        }
      }

      toast.success('تم تحديث إذن الاستلام بنجاح');
      navigate(createPageUrl(`GoodsReceiptDetails?id=${receiptId}`));
    } catch (error) {
      toast.error('حدث خطأ في تحديث الإذن');
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

  if (!receipt) {
    return (
      <div className="text-center py-16">
        <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">لم يتم العثور على إذن الاستلام</p>
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
          onClick={() => navigate(createPageUrl(`GoodsReceiptDetails?id=${receiptId}`))}
          className="hover:bg-slate-200"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>تعديل إذن الاستلام</h1>
          <p className="text-slate-500 mt-1">{receipt.receipt_number}</p>
        </div>
      </div>

      <Alert className="border-amber-200 bg-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          تنبيه: تعديل الكميات سيؤثر على رصيد المخزون تلقائياً
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Receipt Details */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <CardTitle className="text-lg text-white">بيانات الإذن</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
            <div className="space-y-2">
              <Label>رقم إذن الاستلام</Label>
              <Input value={receipt.receipt_number} disabled className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label>رقم الطلب</Label>
              <Input value={receipt.order_number} disabled className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label>تاريخ ووقت الاستلام</Label>
              <Input
                type="datetime-local"
                value={receipt.receipt_date?.slice(0, 16)}
                onChange={(e) => setReceipt({...receipt, receipt_date: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={receipt.notes || ''}
                onChange={(e) => setReceipt({...receipt, notes: e.target.value})}
                placeholder="ملاحظات إضافية..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <CardTitle className="text-lg text-white">الأصناف</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">رقم الصنف</TableHead>
                    <TableHead className="text-right">اسم الصنف</TableHead>
                    <TableHead className="text-right">الكمية السابقة</TableHead>
                    <TableHead className="text-right">الكمية الجديدة</TableHead>
                    <TableHead className="text-right">السعر</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptItems.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell><span dir="ltr" className="font-mono" style={{ display: 'inline-block', textAlign: 'left' }}>{item.item_number}</span></TableCell>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell className="text-slate-500">{originalItems[index]?.quantity_received || 0}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={item.new_quantity}
                          onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>{(item.unit_cost || 0).toFixed(2)} ر.س</TableCell>
                      <TableCell className="font-medium">
                        {((item.new_quantity || 0) * (item.unit_cost || 0)).toFixed(2)} ر.س
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
        <div className="flex justify-start gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl(`GoodsReceiptDetails?id=${receiptId}`))}
          >
            إلغاء
          </Button>
          <Button 
            type="submit" 
            disabled={saving}
            style={{ backgroundColor: '#1e3a5f' }}
            className="hover:opacity-90"
          >
            <Save className="h-4 w-4 ml-2" />
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </Button>
        </div>
      </form>
    </div>
  );
}