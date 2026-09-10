import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, 
  ClipboardCheck, 
  ArrowUpLeft,
  Clock,
  AlertCircle,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalReceipts: 0,
    todayReceipts: 0,
    totalItems: 0,
    lowStockItems: 0,
    inventoryValue: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentReceipts, setRecentReceipts] = useState([]);
  const [overdueOrders, setOverdueOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [orders, receipts, items] = await Promise.all([
        base44.entities.PurchaseOrder.list('-created_date', 100),
        base44.entities.GoodsReceipt.list('-created_date', 100),
        base44.entities.Item.list()
      ]);

      const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'partial');
      const lowStock = items.filter(i => (i.current_stock || 0) < 5);
      const inventoryValue = items.reduce((sum, i) => sum + ((i.current_stock || 0) * (i.average_cost || 0)), 0);

      // Today's receipts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayReceipts = receipts.filter(r => new Date(r.receipt_date) >= today);

      // Overdue/partial orders (older than 20 days)
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      const overdue = orders.filter(o => 
        (o.status === 'pending' || o.status === 'partial') && 
        new Date(o.order_date) < twentyDaysAgo
      );

      setStats({
        totalOrders: orders.length,
        pendingOrders: pendingOrders.length,
        totalReceipts: receipts.length,
        todayReceipts: todayReceipts.length,
        totalItems: items.length,
        lowStockItems: lowStock.length,
        inventoryValue
      });

      setRecentOrders(orders.slice(0, 5));
      setRecentReceipts(receipts.slice(0, 5));
      setOverdueOrders(overdue);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'طلبات مفتوحة',
      value: stats.pendingOrders,
      icon: Clock,
      bgColor: '#d4a853',
      href: createPageUrl('PurchaseOrders')
    },
    {
      title: 'إذونات اليوم',
      value: stats.todayReceipts,
      icon: ClipboardCheck,
      bgColor: '#1e3a5f',
      href: createPageUrl('GoodsReceipts')
    },
    {
      title: 'قيمة المخزون',
      value: `${stats.inventoryValue.toFixed(0)} ر.س`,
      icon: TrendingUp,
      bgColor: '#2d4a6f',
      href: createPageUrl('Inventory')
    },
    {
      title: 'إجمالي الأصناف',
      value: stats.totalItems,
      icon: Package,
      bgColor: '#152a45',
      href: createPageUrl('Items')
    }
  ];

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
      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>لوحة التحكم</h1>
          <p className="text-slate-500 mt-1">مؤشرات الأداء والتنبيهات</p>
        </div>
        <Link
          to={createPageUrl('SelectOrderForReceipt')}
          className="flex items-center gap-2 px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 text-white font-medium"
          style={{ backgroundColor: '#d4a853' }}
        >
          <ClipboardCheck className="h-5 w-5" />
          <span>إذن استلام</span>
        </Link>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Link key={index} to={stat.href}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500 font-medium">{stat.title}</p>
                    <p className="text-2xl font-bold mt-2" style={{ color: '#1e3a5f' }}>{stat.value}</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: stat.bgColor }}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        {stats.lowStockItems > 0 && (
          <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(to left, #fef3c7, white)' }}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: '#d4a853' }}>
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: '#1e3a5f' }}>تنبيه المخزون المنخفض</h3>
                  <p className="text-sm text-slate-500">يوجد {stats.lowStockItems} صنف برصيد منخفض</p>
                </div>
                <Link 
                  to={createPageUrl('Inventory')} 
                  className="mr-auto text-sm font-medium hover:underline"
                  style={{ color: '#d4a853' }}
                >
                  عرض التفاصيل
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overdue Orders Alert */}
        {overdueOrders.length > 0 && (
          <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(to left, #fee2e2, white)' }}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-500">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-700">طلبات متأخرة</h3>
                  <p className="text-sm text-slate-500">يوجد {overdueOrders.length} طلب لم يكتمل منذ أكثر من 20 يوماً</p>
                </div>
                <a 
                  href="#overdue"
                  className="mr-auto text-sm font-medium hover:underline text-red-600"
                >
                  عرض التفاصيل
                </a>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Overdue Orders Table */}
      {overdueOrders.length > 0 && (
        <Card className="border-0 shadow-sm" id="overdue">
          <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              طلبات لم تكتمل منذ فترة طويلة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">رقم الطلب</TableHead>
                    <TableHead className="text-right">المورد</TableHead>
                    <TableHead className="text-right">تاريخ الطلب</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الأيام المنقضية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueOrders.map(order => {
                    const days = Math.floor((new Date() - new Date(order.order_date)) / (1000 * 60 * 60 * 24));
                    return (
                      <TableRow key={order.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = createPageUrl(`PurchaseOrderDetails?id=${order.id}`)}>
                        <TableCell className="font-medium" style={{ color: '#1e3a5f' }}>{order.order_number}</TableCell>
                        <TableCell>{order.supplier_name}</TableCell>
                        <TableCell>{new Date(order.order_date).toLocaleDateString('ar-SA')}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${days > 30 ? 'text-red-600' : 'text-amber-600'}`}>{days} يوم</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4 border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-white">آخر الطلبات</CardTitle>
              <Link 
                to={createPageUrl('PurchaseOrders')} 
                className="text-sm font-medium flex items-center gap-1 text-white/80 hover:text-white"
              >
                عرض الكل
                <ArrowUpLeft className="h-4 w-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {recentOrders.length === 0 ? (
              <p className="text-center text-slate-400 py-8">لا توجد طلبات بعد</p>
            ) : (
              recentOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div>
                    <p className="font-medium" style={{ color: '#1e3a5f' }}>{order.order_number}</p>
                    <p className="text-sm text-slate-500">{order.supplier_name}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Receipts */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4 border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-white">آخر الاستلامات</CardTitle>
              <Link 
                to={createPageUrl('GoodsReceipts')} 
                className="text-sm font-medium flex items-center gap-1 text-white/80 hover:text-white"
              >
                عرض الكل
                <ArrowUpLeft className="h-4 w-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {recentReceipts.length === 0 ? (
              <p className="text-center text-slate-400 py-8">لا توجد استلامات بعد</p>
            ) : (
              recentReceipts.map(receipt => (
                <div key={receipt.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div>
                    <p className="font-medium" style={{ color: '#1e3a5f' }}>{receipt.receipt_number}</p>
                    <p className="text-sm text-slate-500">طلب رقم: {receipt.order_number}</p>
                  </div>
                  <span className="text-sm text-slate-500">
                    {new Date(receipt.receipt_date).toLocaleDateString('ar-SA')}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}