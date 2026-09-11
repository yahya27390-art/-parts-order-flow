import React, { useState, useEffect } from 'react';
import { db as base44 } from '@/api/databaseClient';
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
import { Plus, Trash2, ArrowRight, Save, Search, Check } from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CreatePurchaseOrder() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [orderData, setOrderData] = useState({
    order_number: '',
    order_date: new Date().toISOString().split('T')[0],
    supplier_name: 'مورد كوري',
    notes: ''
  });
  const [orderItems, setOrderItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(null);

  useEffect(() => {
    loadItems();
    generateOrderNumber();
  }, []);

  const loadItems = async () => {
    try {
      const data = await base44.entities.Item.list();
      setItems(data);
    } catch (error) {
      toast.error('حدث خطأ في تحميل الأصناف');
    }
  };

  const generateOrderNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setOrderData(prev => ({ ...prev, order_number: `PO-${year}${month}-${random}` }));
  };

  const addOrderItem = () => {
    setOrderItems([...orderItems, {
      item_id: '',
      item_number: '',
      item_name: '',
      quantity_ordered: 1,
      unit_cost: 0
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

    setSaving(true);
    try {
      // Create order
      const order = await base44.entities.PurchaseOrder.create({
        ...orderData,
        total_amount: calculateTotal(),
        status: 'pending'
      });

      // Create order items and update stock
      for (const item of orderItems) {
        await base44.entities.PurchaseOrderItem.create({
          order_id: order.id,
          item_id: item.item_id,
          item_number: item.item_number,
          item_name: item.item_name,
          quantity_ordered: item.quantity_ordered,
          quantity_received: 0,
          unit_cost: item.unit_cost,
          total_cost: item.quantity_ordered * item.unit_cost
        });

        // Add to current stock when creating purchase order
        const existingItem = items.find(i => i.id === item.item_id);
        if (existingItem) {
          const currentStock = existingItem.current_stock || 0;
          const oldAvgCost = existingItem.average_cost || item.unit_cost;
          
          // Calculate new average cost
          const totalOldValue = currentStock * oldAvgCost;
          const totalNewValue = item.quantity_ordered * item.unit_cost;
          const newTotalQty = currentStock + item.quantity_ordered;
          const newAvgCost = newTotalQty > 0 ? (totalOldValue + totalNewValue) / newTotalQty : item.unit_cost;

          await base44.entities.Item.update(item.item_id, {
            current_stock: currentStock + item.quantity_ordered,
            pending_stock: (existingItem.pending_stock || 0) + item.quantity_ordered,
            average_cost: newAvgCost
          });
        }
      }

      toast.success('تم إنشاء طلب الشراء وإضافة الكميات للمخزون');
      navigate(createPageUrl('PurchaseOrders'));
    } catch (error) {
      toast.error('حدث خطأ في إنشاء الطلب');
    } finally {
      setSaving(false);
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
                          <Popover open={openCombobox === index} onOpenChange={(open) => setOpenCombobox(open ? index : null)}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
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
                                          <span dir="ltr" className="text-xs text-slate-500 font-mono" style={{ display: 'inline-block', textAlign: 'left' }}>{i.item_number}</span>
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
                          {(item.quantity_ordered * item.unit_cost).toFixed(2)} ر.س
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