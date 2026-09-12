import React, { useState, useEffect } from 'react';
import { db as base44 } from '@/api/databaseClient';
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
  AlertTriangle,
  ShoppingCart,
  FileText,
  Settings,
  Warehouse,
  BarChart3,
  ArrowLeftRight,
  ArrowLeft,
  Boxes
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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

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
  const [orderInsights, setOrderInsights] = useState({
    statusData: [],
    receiptData: [],
    orderedQuantity: 0,
    receivedQuantity: 0
  });
  const [loading, setLoading] = useState(true);
  const [systemSettings, setSystemSettings] = useState(null);

  useEffect(() => {
    loadDashboardData();
    loadSystemSettings();
  }, []);

  const loadSystemSettings = async () => {
    try {
      const settings = await base44.entities.SystemSettings.list();
      setSystemSettings(settings[0] || null);
    } catch (error) {
      console.error('Error loading system settings:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [orders, receipts, items, orderItems] = await Promise.all([
        base44.entities.PurchaseOrder.list('-created_date', 100),
        base44.entities.GoodsReceipt.list('-created_date', 100),
        base44.entities.Item.list(),
        base44.entities.PurchaseOrderItem.list()
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
      const statusLabels = {
        pending: 'معلقة',
        partial: 'جزئية',
        completed: 'مكتملة',
        cancelled: 'ملغاة'
      };
      const statusColors = {
        pending: '#d4a853',
        partial: '#4d82b8',
        completed: '#2f8f6b',
        cancelled: '#c45b5b'
      };
      const statusData = ['pending', 'partial', 'completed', 'cancelled']
        .map(status => ({
          name: statusLabels[status],
          value: orders.filter(order => order.status === status).length,
          color: statusColors[status]
        }))
        .filter(entry => entry.value > 0);
      const orderedQuantity = orderItems.reduce((sum, item) => sum + Number(item.quantity_ordered || 0), 0);
      const receivedQuantity = orderItems.reduce((sum, item) => sum + Number(item.quantity_received || 0), 0);
      setOrderInsights({
        statusData,
        receiptData: [
          { name: 'تم استلامه', value: receivedQuantity, color: '#2f8f6b' },
          { name: 'متبقي', value: Math.max(orderedQuantity - receivedQuantity, 0), color: '#e2e8f0' }
        ],
        orderedQuantity,
        receivedQuantity
      });
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

  const quickActions = [
    { label: 'طلبات الشراء', description: 'إنشاء ومتابعة الطلبات', icon: ShoppingCart, href: 'PurchaseOrders', color: '#1e3a5f' },
    { label: 'إذن استلام', description: 'تسجيل وصول الأصناف', icon: ClipboardCheck, href: 'SelectOrderForReceipt', color: '#d4a853' },
    { label: 'دليل الأصناف', description: 'إدارة بيانات القطع', icon: FileText, href: 'Items', color: '#346b83' },
    { label: 'المخزون الحالي', description: 'عرض الأرصدة والقيم', icon: Warehouse, href: 'Inventory', color: '#2f8f6b' },
    { label: 'التقارير', description: 'تقارير وتحليلات النظام', icon: BarChart3, href: 'Reports', color: '#72558f' },
    { label: 'الإعدادات', description: 'تهيئة النظام واللوجو', icon: Settings, href: 'AdminSettings', color: '#64748b' }
  ];

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
      {/* Import route visual */}
      <section className="flex flex-col items-center justify-center gap-5 py-2 sm:flex-row sm:gap-8 lg:gap-14">
        <div className="flex min-w-0 items-center gap-3 text-center sm:flex-1 sm:justify-end sm:text-right">
          {systemSettings?.logo_url && systemSettings?.show_logo_interface ? (
            <img
              src={systemSettings.logo_url}
              alt={systemSettings.system_name || 'شعار النظام'}
              className="h-16 w-28 object-contain sm:h-20 sm:w-36"
            />
          ) : (
            <div className="flex h-16 w-28 items-center justify-center sm:h-20 sm:w-36">
              <Package className="h-12 w-12 text-[#1e3a5f]" />
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-[#1e3a5f]">{systemSettings?.system_name || 'طلبات كوريا'}</p>
            <p className="mt-1 text-xs text-slate-500">وجهتنا المحلية</p>
          </div>
        </div>

        <div className="flex w-full max-w-[260px] shrink-0 items-center gap-2 sm:w-44 lg:w-64">
          <span className="h-px flex-1 bg-gradient-to-l from-[#d4a853] to-transparent" />
          <div className="flex flex-col items-center gap-1 text-[#d4a853]">
            <ArrowLeftRight className="h-6 w-6 animate-pulse" strokeWidth={1.8} />
            <span className="text-[10px] font-semibold tracking-wide text-slate-400">استيراد مباشر</span>
          </div>
          <span className="h-px flex-1 bg-gradient-to-r from-[#d4a853] to-transparent" />
        </div>

        <div className="flex min-w-0 items-center gap-3 text-center sm:flex-1 sm:justify-start sm:text-left">
          <span className="text-5xl leading-none" role="img" aria-label="علم كوريا الجنوبية">🇰🇷</span>
          <div>
            <p className="text-sm font-bold text-[#1e3a5f]">كوريا الجنوبية</p>
            <p className="mt-1 text-xs text-slate-500">مصدر قطع الغيار</p>
          </div>
        </div>
      </section>

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

      {/* Main navigation actions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-white">
          <CardTitle className="flex items-center gap-2 text-lg text-[#1e3a5f]">
            <Boxes className="h-5 w-5 text-[#d4a853]" />
            الوصول السريع
          </CardTitle>
          <p className="text-sm text-slate-500">كل أدوات إدارة المشتريات والمخزون في مكان واحد</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map(action => (
            <Link
              key={action.href}
              to={createPageUrl(action.href)}
              className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: action.color }}>
                <action.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-[#1e3a5f]">{action.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{action.description}</span>
              </span>
              <ArrowLeft className="h-4 w-4 text-slate-300 transition-transform group-hover:-translate-x-1 group-hover:text-[#d4a853]" />
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat, index) => (
          <Link key={index} to={stat.href}>
            <Card className="h-full border-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500 font-medium">{stat.title}</p>
                    <p className="mt-2 text-2xl font-bold" style={{ color: '#1e3a5f' }}>{stat.value}</p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: stat.bgColor }}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Order analytics */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="min-w-0 border-0 shadow-sm xl:col-span-3">
          <CardHeader className="border-b">
            <CardTitle className="text-lg text-[#1e3a5f]">حالة طلبات الشراء</CardTitle>
            <p className="text-sm text-slate-500">توزيع الطلبات حسب حالتها الحالية</p>
          </CardHeader>
          <CardContent className="h-72 p-4">
            {orderInsights.statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderInsights.statusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" name="عدد الطلبات" radius={[6, 6, 0, 0]}>
                    {orderInsights.statusData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="flex h-full items-center justify-center text-sm text-slate-400">لا توجد بيانات طلبات بعد</p>}
          </CardContent>
        </Card>
        <Card className="min-w-0 border-0 shadow-sm xl:col-span-2">
          <CardHeader className="border-b">
            <CardTitle className="text-lg text-[#1e3a5f]">نسبة الاستلام</CardTitle>
            <p className="text-sm text-slate-500">إجمالي الكميات المطلوبة مقابل المستلمة</p>
          </CardHeader>
          <CardContent className="h-72 p-4">
            {orderInsights.orderedQuantity > 0 ? (
              <div className="relative h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={orderInsights.receiptData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={96} paddingAngle={3} startAngle={90} endAngle={-270}>
                      {orderInsights.receiptData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-7 text-center">
                  <div>
                    <p className="text-2xl font-bold text-[#1e3a5f]">{Math.min(100, Math.round((orderInsights.receivedQuantity / orderInsights.orderedQuantity) * 100))}%</p>
                    <p className="text-xs text-slate-500">نسبة الإنجاز</p>
                  </div>
                </div>
              </div>
            ) : <p className="flex h-full items-center justify-center text-sm text-slate-400">لا توجد كميات مسجلة بعد</p>}
          </CardContent>
        </Card>
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