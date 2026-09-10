import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";




import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Items() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    item_number: '',
    item_name: '',
    cost: ''
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await base44.entities.Item.list('-created_date');
      setItems(data);
    } catch (error) {
      toast.error('حدث خطأ في تحميل الأصناف');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const itemData = {
        ...formData,
        cost: parseFloat(formData.cost) || 0
      };

      // التحقق من عدم تكرار رقم الصنف
      const existingItems = items.filter(i => 
        i.item_number?.toLowerCase() === formData.item_number?.toLowerCase() && 
        (!editingItem || i.id !== editingItem.id)
      );
      
      if (existingItems.length > 0) {
        toast.error('رقم الصنف موجود مسبقاً، يرجى استخدام رقم مختلف');
        return;
      }

      if (editingItem) {
        await base44.entities.Item.update(editingItem.id, itemData);
        toast.success('تم تحديث الصنف بنجاح');
      } else {
        await base44.entities.Item.create(itemData);
        toast.success('تم إضافة الصنف بنجاح');
      }
      
      setDialogOpen(false);
      resetForm();
      loadItems();
    } catch (error) {
      toast.error('حدث خطأ في حفظ الصنف');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      item_number: item.item_number,
      item_name: item.item_name,
      cost: item.cost?.toString() || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (item) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
      try {
        await base44.entities.Item.delete(item.id);
        toast.success('تم حذف الصنف بنجاح');
        loadItems();
      } catch (error) {
        toast.error('حدث خطأ في حذف الصنف');
      }
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      item_number: '',
      item_name: '',
      cost: ''
    });
  };

  const filteredItems = items.filter(item =>
    item.item_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>الأصناف</h1>
          <p className="text-slate-500 mt-1">إدارة قطع الغيار والأصناف</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setDialogOpen(true); }}
          style={{ backgroundColor: '#1e3a5f' }}
          className="hover:opacity-90"
        >
          <Plus className="h-4 w-4 ml-2" />
          إضافة صنف
        </Button>
      </div>

      {/* Search with Combobox style */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="بحث برقم الصنف أو الاسم..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Items Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Package className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500">لا توجد أصناف</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: '#1e3a5f' }}>
                    <TableHead className="text-right text-white">رقم الصنف</TableHead>
                    <TableHead className="text-right text-white">اسم الصنف</TableHead>
                    <TableHead className="text-right text-white">التكلفة</TableHead>
                    <TableHead className="text-right text-white">الرصيد الحالي</TableHead>
                    <TableHead className="text-right text-white">مخزون الطلبات</TableHead>
                    <TableHead className="text-center text-white">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => (
                    <TableRow key={item.id} className="hover:bg-slate-50">
                      <TableCell><span dir="ltr" className="font-mono font-medium" style={{ display: 'inline-block', textAlign: 'left' }}>{item.item_number}</span></TableCell>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell>{(item.cost || 0).toFixed(2)} ر.س</TableCell>
                      <TableCell>
                        <span className={`font-medium ${(item.current_stock || 0) < 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {item.current_stock || 0}
                        </span>
                      </TableCell>
                      <TableCell style={{ color: '#d4a853' }} className="font-medium">{item.pending_stock || 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            className="text-slate-500 hover:text-blue-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item)}
                            className="text-slate-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: '#1e3a5f' }}>{editingItem ? 'تعديل الصنف' : 'إضافة صنف جديد'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>رقم الصنف</Label>
              <Input
                placeholder="مثال: 97701-F1500"
                value={formData.item_number}
                onChange={(e) => setFormData({...formData, item_number: e.target.value})}
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>اسم الصنف</Label>
              <Input
                placeholder="اسم الصنف"
                value={formData.item_name}
                onChange={(e) => setFormData({...formData, item_name: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>التكلفة</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.cost}
                onChange={(e) => setFormData({...formData, cost: e.target.value})}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" style={{ backgroundColor: '#1e3a5f' }} className="hover:opacity-90">
                {editingItem ? 'تحديث' : 'إضافة'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}