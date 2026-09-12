import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { db } from '@/api/databaseClient';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  FileText, 
  Settings, 
  ClipboardList,
  BarChart3,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Layout({ children, currentPageName }) {
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadSettings();
    loadUser();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsList = await db.entities.SystemSettings.list();
      if (settingsList.length > 0) {
        setSettings(settingsList[0]);
      }
    } catch (e) {
      console.log('No settings found');
    }
  };

  const loadUser = async () => {
    try {
      const currentUser = await db.auth.me();
      setUser(currentUser);
    } catch (e) {
      console.log('User not logged in');
    }
  };

  const handleLogout = () => {
    db.auth.logout();
  };

  const navigationGroups = [
    {
      id: 'procurement',
      label: 'المشتريات',
      icon: ShoppingCart,
      items: [
        { name: 'طلبات الشراء', href: createPageUrl('PurchaseOrders'), icon: ShoppingCart, page: 'PurchaseOrders' },
        { name: 'إذونات الاستلام', href: createPageUrl('GoodsReceipts'), icon: ClipboardList, page: 'GoodsReceipts' },
      ]
    },
    {
      id: 'warehouse',
      label: 'المستودع',
      icon: Package,
      items: [
        { name: 'دليل الأصناف', href: createPageUrl('Items'), icon: FileText, page: 'Items' },
        { name: 'المخزون الحالي', href: createPageUrl('Inventory'), icon: Package, page: 'Inventory' },
      ]
    },
    {
      id: 'reports',
      label: 'التقارير',
      icon: BarChart3,
      items: [
        { name: 'التقارير', href: createPageUrl('Reports'), icon: BarChart3, page: 'Reports' },
      ]
    },
    {
      id: 'admin',
      label: 'الإدارة',
      icon: ShieldCheck,
      items: [
        { name: 'لوحة التحكم', href: createPageUrl('Dashboard'), icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'الإعدادات', href: createPageUrl('AdminSettings'), icon: Settings, page: 'AdminSettings' },
      ]
    },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to={createPageUrl('Dashboard')} className="flex items-center gap-3 shrink-0">
            {settings?.logo_url && settings?.show_logo_interface ? (
              <img src={settings.logo_url} alt="Logo" className="h-9 w-9 object-contain" />
            ) : (
              <div className="brand-mark flex h-9 w-9 items-center justify-center rounded-xl">
                <Package className="h-5 w-5 text-white" />
              </div>
            )}
            <span className="font-bold text-[#1e3a5f]">
              {settings?.system_name || 'إدارة المخزون'}
            </span>
          </Link>
          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto pb-1 lg:order-2 lg:w-auto lg:flex-1 lg:justify-center">
            {navigationGroups.flatMap(group => group.items).map(item => {
              const active = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                    active ? "bg-[#1e3a5f] text-white" : "text-slate-600 hover:bg-slate-100 hover:text-[#1e3a5f]"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          {user && (
            <div className="order-2 ml-auto flex items-center gap-2 lg:order-3">
              <div className="hidden text-left sm:block">
                <p className="max-w-32 truncate text-xs font-semibold text-slate-700">{user.full_name}</p>
                <p className="max-w-32 truncate text-[10px] text-slate-400">{user.email}</p>
              </div>
              <Button variant="outline" size="icon" onClick={handleLogout} title="تسجيل الخروج">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="app-main min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="app-content">
          <div className="mb-7 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-400">إدارة المخزون</p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {navigationGroups.flatMap((group) => group.items).find((item) => item.page === currentPageName)?.name || 'لوحة التحكم'}
              </p>
            </div>
            <div className="hidden text-xs text-slate-400 sm:block">
              {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'full' }).format(new Date())}
            </div>
          </div>
          {children}
        </div>
      </main>

    </div>
  );
}