import React, { useState, useEffect } from 'react';
import { db as base44 } from '@/api/databaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, ClipboardCheck, Printer, Package, Pencil } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export default function PurchaseOrderDetails() {
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
    }
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      const [orderData, itemsData, receiptsData] = await Promise.all([
        base44.entities.PurchaseOrder.filter({ id: orderId }),
        base44.entities.PurchaseOrderItem.filter({ order_id: orderId }),
        base44.entities.GoodsReceipt.filter({ order_id: orderId })
      ]);

      setOrder(orderData[0]);
      setOrderItems(itemsData);
      setReceipts(receiptsData);
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      partial: 'bg-blue-50 text-blue-700 border-blue-200',
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      cancelled: 'bg-red-50 text-red-700 border-red-200'
    };
    const labels = {
      pending: 'معلق',
      partial: 'جزئي',
      completed: 'مكتمل',
      cancelled: 'ملغي'
    };
    return (
      <Badge variant="outline" className={styles[status] || styles.pending}>
        {labels[status] || status}
      </Badge>
    );
  };

  const calculateProgress = (item) => {
    if (!item.quantity_ordered) return 0;
    return Math.min(100, ((item.quantity_received || 0) / item.quantity_ordered) * 100);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>{order.order_number}</h1>
              {getStatusBadge(order.status)}
            </div>
            <p className="text-slate-500 mt-1">{order.supplier_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <>
              <Link to={createPageUrl(`EditPurchaseOrder?id=${order.id}`)}>
                <Button variant="outline">
                  <Pencil className="h-4 w-4 ml-2" />
                  تعديل
                </Button>
              </Link>
              <Button 
                style={{ backgroundColor: '#d4a853' }}
                className="hover:opacity-90 text-white"
                onClick={() => navigate(createPageUrl(`CreateGoodsReceipt?order_id=${order.id}`))}
              >
                <ClipboardCheck className="h-4 w-4 ml-2" />
                إذن استلام
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Order Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-slate-500">تاريخ الطلب</p>
              <p className="font-medium mt-1">{new Date(order.order_date).toLocaleDateString('ar-SA')}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">المورد</p>
              <p className="font-medium mt-1">{order.supplier_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">إجمالي الطلب</p>
              <p className="font-bold text-lg mt-1" style={{ color: '#d4a853' }}>{(order.total_amount || 0).toFixed(2)} ر.س</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">عدد الاستلامات</p>
              <p className="font-medium mt-1">{receipts.length}</p>
            </div>
          </div>
          {order.notes && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-slate-500">ملاحظات</p>
              <p className="mt-1">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
          <CardTitle className="text-lg text-white">أصناف الطلب</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-right">رقم الصنف</TableHead>
                  <TableHead className="text-right">اسم الصنف</TableHead>
                  <TableHead className="text-right">الكمية المطلوبة</TableHead>
                  <TableHead className="text-right">الكمية المستلمة</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">نسبة الاستلام</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell><span dir="ltr" className="font-mono" style={{ display: 'inline-block', textAlign: 'left' }}>{item.item_number}</span></TableCell>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell>{item.quantity_ordered}</TableCell>
                    <TableCell className={item.quantity_received >= item.quantity_ordered ? 'text-emerald-600 font-medium' : ''}>
                      {item.quantity_received || 0}
                    </TableCell>
                    <TableCell>{(item.unit_cost || 0).toFixed(2)} ر.س</TableCell>
                    <TableCell className="w-40">
                      <div className="flex items-center gap-2">
                        <Progress value={calculateProgress(item)} className="h-2" />
                        <span className="text-xs text-slate-500 w-12">
                          {calculateProgress(item).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Receipts History */}
      {receipts.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <CardTitle className="text-lg text-white">سجل الاستلامات</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">رقم الإذن</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map(receipt => (
                    <TableRow key={receipt.id} className="hover:bg-slate-50 cursor-pointer">
                      <TableCell className="font-medium">{receipt.receipt_number}</TableCell>
                      <TableCell>{new Date(receipt.receipt_date).toLocaleString('ar-SA')}</TableCell>
                      <TableCell>{(receipt.total_amount || 0).toFixed(2)} ر.س</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}