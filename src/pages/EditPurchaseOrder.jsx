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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2, ArrowRight, Save, Search, Check, AlertCircle } from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function EditPurchaseOrder() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [order, setOrder] = useState(null);
  const [orderData, setOrderData] = useState({
    order_number: '',
    order_date: '',
    supplier_name: '',
    notes: ''
  });
  const [orderItems, setOrderItems] = useState([]);
  const [originalOrderItems, setOriginalOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  useEffect(() => {
    if (orderId) {
      loadData();
    }
  }, [orderId]);

  const loadData = async () => {
    try {
      const [itemsData, orderData, orderItemsData] = await Promise.all([
        base44.entities.Item.list(),
        base44.entities.PurchaseOrder.filter({ id: orderId }),
        base44.entities.PurchaseOrderItem.filter({ order_id: orderId })
      ]);

      setItems(itemsData);
      
      if (orderData[0]) {
        setOrder(orderData[0]);
        setOrderData({
          order_number: orderData[0].order_number,
          order_date: orderData[0].order_date,
          supplier_name: orderData[0].supplier_name,
          notes: orderData[0].notes || ''
        });
      }

      const mappedItems = orderItemsData.map(item => ({
        id: item.id,
        item_id: item.item_id,
        item_number: item.item_number,
        item_name: item.item_name,
        quantity_ordered: item.quantity_ordered,
        quantity_received: item.quantity_received || 0,
        unit_cost: item.unit_cost,
        original_quantity: item.quantity_ordered
      }));
      
      setOrderItems(mappedItems);
      setOriginalOrderItems(orderItemsData);
    } catch (error) {
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const addOrderItem = () => {
    setOrderItems([...orderItems, {
      id: null,
      item_id: '',
      item_number: '',
      item_name: '',
      quantity_ordered: 1,
      quantity_received: 0,
      unit_cost: 0,
      original_quantity: 0
    }]);
  };

  const updateOrderItem = (index, field, value) => {
    const updated = [...orderItems];
    updated[index][field] = value;

    if (field === 'item_id' && value) {
      const selectedItem = items.find(i => i.id === value);
      if (selectedItem) {
        updated[index].item_number = selectedItem.item_number;
        updated[index].item_name = selectedItem.item_name;
        updated[index].unit_cost = selectedItem.cost || 0;
      }
      // Check for duplicate item in other rows
      const existingIndex = orderItems.findIndex((it, i) => i !== index && it.item_id === value);
      if (existingIndex !== -1) {
        toast.warning(`الصنف "${selectedItem?.item_name}" مكرر - سيتم دمجه مع الصنف الموجود وجمع الكميات`);
        const mergedQuantity = (orderItems[existingIndex].quantity_ordered || 0) + (updated[index].quantity_ordered || 0);
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity_ordered: mergedQuantity
        };
        updated.splice(index, 1);
        setOrderItems(updated);
        return;
      }
    }

    setOrderItems(updated);
  };

  const removeOrderItem = (index) => {
    const item = orderItems[index];
    if (item.quantity_received > 0) {
      toast.error('لا يمكن حذف صنف تم استلام جزء منه');
      return;
    }
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_cost), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (orderItems.length === 0) {
      toast.error('يجب إضافة صنف واحد على الأقل');
      return;
    }

    // Validate quantities
    for (const item of orderItems) {
      if (item.quantity_ordered < item.quantity_received) {
        toast.error(`لا يمكن تقليل الكمية المطلوبة عن الكمية المستلمة للصنف ${item.item_name}`);
        return;
      }
    }

    setSaving(true);
    try {
      // Update order
      await base44.entities.PurchaseOrder.update(orderId, {
        ...orderData,
        total_amount: calculateTotal()
      });

      // Process items
      for (const item of orderItems) {
        if (item.id) {
          // Update existing item
          const originalItem = originalOrderItems.find(o => o.id === item.id);
          const quantityDiff = item.quantity_ordered - (originalItem?.quantity_ordered || 0);

          await base44.entities.PurchaseOrderItem.update(item.id, {
            item_id: item.item_id,
            item_number: item.item_number,
            item_name: item.item_name,
            quantity_ordered: item.quantity_ordered,
            unit_cost: item.unit_cost,
            total_cost: item.quantity_ordered * item.unit_cost
          });

          // Update stock if quantity changed
          if (quantityDiff !== 0) {
            const itemData = await base44.entities.Item.filter({ id: item.item_id });
            if (itemData[0]) {
              const currentStock = itemData[0].current_stock || 0;
              const pendingStock = itemData[0].pending_stock || 0;
              await base44.entities.Item.update(item.item_id, {
                current_stock: currentStock + quantityDiff,
                pending_stock: pendingStock + quantityDiff
              });
            }
          }
        } else {
          // Create new item
          await base44.entities.PurchaseOrderItem.create({
            order_id: orderId,
            item_id: item.item_id,
            item_number: item.item_number,
            item_name: item.item_name,
            quantity_ordered: item.quantity_ordered,
            quantity_received: 0,
            unit_cost: item.unit_cost,
            total_cost: item.quantity_ordered * item.unit_cost
          });

          // Add to stock
          const itemData = await base44.entities.Item.filter({ id: item.item_id });
          if (itemData[0]) {
            const currentStock = itemData[0].current_stock || 0;
            const pendingStock = itemData[0].pending_stock || 0;
            await base44.entities.Item.update(item.item_id, {
              current_stock: currentStock + item.quantity_ordered,
              pending_stock: pendingStock + item.quantity_ordered
            });
          }
        }
      }

      // Delete removed items
      for (const original of originalOrderItems) {
        if (!orderItems.find(i => i.id === original.id)) {
          await base44.entities.PurchaseOrderItem.delete(original.id);
          
          // Remove from stock
          const itemData = await base44.entities.Item.filter({ id: original.item_id });
          if (itemData[0]) {
            const currentStock = itemData[0].current_stock || 0;
            const pendingStock = itemData[0].pending_stock || 0;
            await base44.entities.Item.update(original.item_id, {
              current_stock: Math.max(0, currentStock - original.quantity_ordered),
              pending_stock: Math.max(0, pendingStock - original.quantity_ordered)
            });
          }
        }
      }

      toast.success('تم تحديث طلب الشراء بنجاح');
      navigate(createPageUrl(`PurchaseOrderDetails?id=${orderId}`));
    } catch (error) {
      toast.error('حدث خطأ في تحديث الطلب');
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
          onClick={() => navigate(createPageUrl(`PurchaseOrderDetails?id=${orderId}`))}
          className="hover:bg-slate-200"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>تعديل طلب الشراء</h1>
          <p className="text-slate-500 mt-1">{order.order_number}</p>
        </div>
      </div>

      <Alert className="border-amber-200 bg-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          تنبيه: تعديل الكميات سيؤثر على رصيد المخزون تلقائياً
        </AlertDescription>
      </Alert>

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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">الصنف</TableHead>
                    <TableHead className="text-right">رقم الصنف</TableHead>
                    <TableHead className="text-right">الكمية</TableHead>
                    <TableHead className="text-right">المستلم</TableHead>
                    <TableHead className="text-right">السعر</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="min-w-[250px]">
                        <Popover open={openCombobox === index} onOpenChange={(open) => setOpenCombobox(open ? index : null)}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                              disabled={item.quantity_received > 0}
                            >
                              {item.item_id 
                                ? items.find(i => i.id === item.item_id)?.item_name || 'اختر صنف'
                                : 'اختر صنف'}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="ابحث عن صنف..." className="text-right" />
                              <CommandList>
                                <CommandEmpty>لا توجد نتائج</CommandEmpty>
                                <CommandGroup>
                                  {items.map((i) => (
                                    <CommandItem
                                      key={i.id}
                                      value={`${i.item_number} ${i.item_name}`}
                                      onSelect={() => {
                                        updateOrderItem(index, 'item_id', i.id);
                                        setOpenCombobox(null);
                                      }}
                                      className="flex items-center justify-between"
                                    >
                                      <div className="flex flex-col">
                                        <span>{i.item_name}</span>
                                        <span className="text-xs text-slate-500" dir="ltr" style={{ textAlign: 'left' }}>{i.item_number}</span>
                                      </div>
                                      <Check
                                        className={cn(
                                          "h-4 w-4",
                                          item.item_id === i.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <span dir="ltr" style={{ display: 'inline-block', textAlign: 'left' }}>{item.item_number}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={item.quantity_received || 1}
                          value={item.quantity_ordered}
                          onChange={(e) => updateOrderItem(index, 'quantity_ordered', parseInt(e.target.value) || 1)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="text-slate-500">{item.quantity_received}</TableCell>
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
                        {(item.quantity_ordered * item.unit_cost).toFixed(2)} ر.س
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOrderItem(index)}
                          className="text-red-500 hover:text-red-600"
                          disabled={item.quantity_received > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {orderItems.length > 0 && (
              <div className="flex justify-end mt-4 pt-4 border-t">
                <div className="text-lg font-bold">
                  الإجمالي: <span style={{ color: '#d4a853' }}>{calculateTotal().toFixed(2)} ر.س</span>
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
            onClick={() => navigate(createPageUrl(`PurchaseOrderDetails?id=${orderId}`))}
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