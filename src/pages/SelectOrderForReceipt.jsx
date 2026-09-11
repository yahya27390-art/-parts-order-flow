import React, { useState, useEffect } from 'react';
import { db as base44 } from '@/api/databaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Search, ShoppingCart, ArrowLeft, Eye } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";

export default function SelectOrderForReceipt() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await base44.entities.PurchaseOrder.list('-created_date');
      // Filter only pending or partial orders
      const pendingOrders = data.filter(o => o.status === 'pending' || o.status === 'partial');
      setOrders(pendingOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      partial: 'bg-blue-50 text-blue-700 border-blue-200'
    };
    const labels = {
      pending: 'معلق',
      partial: 'جزئي'
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const filteredOrders = orders.filter(order =>
    order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl('GoodsReceipts'))}
          className="hover:bg-slate-200"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>اختر طلب الشراء</h1>
          <p className="text-slate-500 mt-1">اختر الطلب لتسجيل إذن الاستلام</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="بحث برقم الطلب..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Orders Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ShoppingCart className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500">لا توجد طلبات معلقة للاستلام</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: '#1e3a5f' }}>
                    <TableHead className="text-right text-white">رقم الطلب</TableHead>
                    <TableHead className="text-right text-white">التاريخ</TableHead>
                    <TableHead className="text-right text-white">المورد</TableHead>
                    <TableHead className="text-right text-white">الإجمالي</TableHead>
                    <TableHead className="text-right text-white">الحالة</TableHead>
                    <TableHead className="text-center text-white">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map(order => (
                    <TableRow key={order.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{new Date(order.order_date).toLocaleDateString('ar-SA')}</TableCell>
                      <TableCell>{order.supplier_name}</TableCell>
                      <TableCell style={{ color: '#d4a853' }} className="font-medium">{(order.total_amount || 0).toFixed(2)} ر.س</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Link to={createPageUrl(`PurchaseOrderDetails?id=${order.id}`)}>
                            <Button variant="outline" size="icon" title="عرض الطلب">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link to={createPageUrl(`CreateGoodsReceipt?order_id=${order.id}`)}>
                            <Button size="sm" style={{ backgroundColor: '#d4a853' }} className="hover:opacity-90 text-white">
                              استلام
                              <ArrowLeft className="h-4 w-4 mr-2" />
                            </Button>
                          </Link>
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
    </div>
  );
}