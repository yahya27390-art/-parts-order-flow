import React, { useState } from 'react';
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
import { Plus, Trash2, ArrowRight, Save } from 'lucide-react';
import { toast } from "sonner";
import ItemCombobox from '@/components/ItemCombobox';
import { useCreatePurchaseOrder } from '@/features/orders/hooks';
import { mergeDuplicateOrderItems } from '@/features/orders/logic';
import { formatCurrency, toDateInputValue, toNumber } from '@/lib/format';
import { generateOrderNumber } from '@/lib/documentNumbers';

const EMPTY_ROW = { item_id: '', item_number: '', item_name: '', quantity_ordered: 1, unit_cost: 0 };

export default function CreatePurchaseOrder() {
  const navigate = useNavigate();
  const createOrder = useCreatePurchaseOrder();

  const [orderData, setOrderData] = useState({
    order_number: generateOrderNumber(new Date()),
    order_date: toDateInputValue(new Date()),
    supplier_name: 'مورد كوري',
    notes: '',
  });
  const [orderItems, setOrderItems] = useState([]);

  const saving = createOrder.isPending;

  const total = orderItems.reduce(
    (sum, item) => sum + toNumber(item.quantity_ordered) * toNumber(item.unit_cost),
    0,
  );

  const addOrderItem = () => setOrderItems((current) => [...current, { ...EMPTY_ROW }]);

  /** اختيار صنف مع دمج السطور المكررة تلقائيًا في سطر واحد. */
  const handleSelectItem = (index, selectedItem) => {
    setOrderItems((current) => {
      const next = current.map((row, position) =>
        position === index
          ? {
              ...row,
              item_id: selectedItem.id,
              item_number: selectedItem.item_number,
              item_name: selectedItem.item_name,
              unit_cost: toNumber(selectedItem.cost),
            }
          : row,
      );

      const duplicate = next.some((row, position) => position !== index && row.item_id === selectedItem.id);
      if (duplicate) {
        toast.warning(`الصنف "${selectedItem.item_name}" مكرر — تم دمج الكميات في سطر واحد`);
        return mergeDuplicateOrderItems(next);
      }

      return next;
    });
  };

  const updateOrderItem = (index, field, value) =>
    setOrderItems((current) =>
      current.map((row, position) => (position === index ? { ...row, [field]: value } : row)),
    );

  const removeOrderItem = (index) =>
    setOrderItems((current) => current.filter((_, position) => position !== index));

  const handleSubmit = async (event) => {
    event.preventDefault();

    const itemsToSave = mergeDuplicateOrderItems(orderItems).filter((item) => item.item_id);
    
    if (itemsToSave.length === 0) {
      toast.error('يجب إضافة صنف واحد على الأقل');
      return;
    }

    try {
      await createOrder.mutateAsync({ order: orderData, items: itemsToSave });
      navigate(createPageUrl('PurchaseOrders'));
    } catch {
      /* رسالة الخطأ تظهر من الـ hook */
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>طلب شراء جديد</h1>
          <p className="text-slate-500 mt-1">إنشاء طلب شراء من المورد</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Details */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <CardTitle className="text-lg text-white">بيانات الطلب</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            <div className="space-y-2">
              <Label>رقم الطلب</Label>
              <Input
                value={orderData.order_number}
                onChange={(e) => setOrderData({...orderData, order_number: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الطلب</Label>
              <Input
                type="date"
                value={orderData.order_date}
                onChange={(e) => setOrderData({...orderData, order_date: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>اسم المورد</Label>
              <Input
                value={orderData.supplier_name}
                onChange={(e) => setOrderData({...orderData, supplier_name: e.target.value})}
                required
              />
            </div>
            <div className="md:col-span-3 space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={orderData.notes}
                onChange={(e) => setOrderData({...orderData, notes: e.target.value})}
                placeholder="ملاحظات إضافية..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white">أصناف الطلب</CardTitle>
              <Button 
                type="button" 
                size="sm" 
                onClick={addOrderItem}
                style={{ backgroundColor: '#d4a853' }}
                className="hover:opacity-90 text-white"
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة صنف
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {orderItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                اضغط على "إضافة صنف" لإضافة أصناف للطلب
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-right">الصنف</TableHead>
                      <TableHead className="text-right">رقم الصنف</TableHead>
                      <TableHead className="text-right">الكمية</TableHead>
                      <TableHead className="text-right">السعر</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="min-w-[250px]">
                          <ItemCombobox
                            value={item.item_id}
                            valueLabel={item.item_name}
                            onSelect={(selected) => handleSelectItem(index, selected)}
                          />
                        </TableCell>
                        <TableCell><span dir="ltr" className="font-mono text-sm" style={{ display: 'inline-block', textAlign: 'left' }}>{item.item_number}</span></TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity_ordered}
                            onChange={(e) => updateOrderItem(index, 'quantity_ordered', parseInt(e.target.value) || 1)}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => updateOrderItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(toNumber(item.quantity_ordered) * toNumber(item.unit_cost))}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOrderItem(index)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {orderItems.length > 0 && (
              <div className="flex justify-end mt-4 pt-4 border-t">
                <div className="text-lg font-bold">
                  الإجمالي: <span style={{ color: '#d4a853' }}>{formatCurrency(total)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl('PurchaseOrders'))}
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
            {saving ? 'جاري الحفظ...' : 'حفظ الطلب'}
          </Button>
        </div>
      </form>
    </div>
  );
}