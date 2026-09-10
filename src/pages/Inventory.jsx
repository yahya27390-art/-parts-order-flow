import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Package, AlertCircle } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await base44.entities.Item.list('-created_date');
      setItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.item_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockCount = items.filter(i => (i.current_stock || 0) < 5).length;
  const totalValue = items.reduce((sum, i) => sum + ((i.current_stock || 0) * (i.average_cost || 0)), 0);

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
        <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>المخزون</h1>
        <p className="text-slate-500 mt-1">عرض الرصيد الحالي للأصناف</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">إجمالي الأصناف</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#1e3a5f' }}>{items.length}</p>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#1e3a5f' }}>
                <Package className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">قيمة المخزون</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#d4a853' }}>{totalValue.toFixed(2)} ر.س</p>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#d4a853' }}>
                <Package className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">أصناف منخفضة</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{lowStockCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-100">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="بحث برقم الصنف أو الاسم..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Inventory Table */}
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
                    <TableHead className="text-right text-white">الرصيد المتاح</TableHead>
                    <TableHead className="text-right text-white">متوسط التكلفة</TableHead>
                    <TableHead className="text-right text-white">قيمة المخزون</TableHead>
                    <TableHead className="text-right text-white">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => {
                    const stock = item.current_stock || 0;
                    const avgCost = item.average_cost || 0;
                    const value = stock * avgCost;
                    const isLowStock = stock < 5;

                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50">
                        <TableCell><span dir="ltr" className="font-mono font-medium" style={{ display: 'inline-block', textAlign: 'left' }}>{item.item_number}</span></TableCell>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>
                          <span className={`font-bold ${isLowStock ? 'text-red-600' : 'text-emerald-600'}`}>
                            {stock}
                          </span>
                        </TableCell>
                        <TableCell>{avgCost.toFixed(2)} ر.س</TableCell>
                        <TableCell className="font-medium">{value.toFixed(2)} ر.س</TableCell>
                        <TableCell>
                          {isLowStock ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              منخفض
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              متاح
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}