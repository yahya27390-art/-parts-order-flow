import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { db as base44 } from '@/api/databaseClient';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  FileText, 
  Settings, 
  Menu, 
  X,
  ClipboardList,
  BarChart3,
  LogOut,
  User,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    loadSettings();
    loadUser();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsList = await base44.entities.SystemSettings.list();
      if (settingsList.length > 0) {
        setSettings(settingsList[0]);
      }
    } catch (e) {
      console.log('No settings found');
    }
  };

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (e) {
      console.log('User not logged in');
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
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

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isGroupActive = (group) => {
    return group.items.some(item => item.page === currentPageName);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-100">
      <style>{`
        :root {
          --navy: #1e3a5f;
          --navy-dark: #152a45;
          --navy-light: #2d4a6f;
          --gold: #d4a853;
          --gold-light: #e6c17a;
          --gold-dark: #b8923f;
        }
        * {
          font-family: 'Tajawal', 'Inter', sans-serif;
        }
        .bg-navy { background-color: var(--navy); }
        .bg-navy-dark { background-color: var(--navy-dark); }
        .bg-navy-light { background-color: var(--navy-light); }
        .text-navy { color: var(--navy); }
        .text-gold { color: var(--gold); }
        .bg-gold { background-color: var(--gold); }
        .border-gold { border-color: var(--gold); }
        .hover\\:bg-navy-light:hover { background-color: var(--navy-light); }
      `}</style>
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 right-0 z-50 h-full w-72 bg-navy-dark shadow-xl transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )} style={{ backgroundColor: '#152a45' }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              {settings?.logo_url && settings?.show_logo_interface ? (
                <img src={settings.logo_url} alt="Logo" className="h-10 w-10 object-contain" />
              ) : (
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#d4a853' }}>
                  <Package className="h-5 w-5 text-white" />
                </div>
              )}
              <span className="font-bold text-lg text-white">
                {settings?.system_name || 'إدارة المخزون'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:bg-white/10"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Grouped Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navigationGroups.map((group) => {
              const isActive = isGroupActive(group);
              const isExpanded = expandedGroups[group.id] || isActive;
              return (
                <div key={group.id} className="mb-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
                      isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                    )}
                    style={isActive ? { backgroundColor: 'rgba(212, 168, 83, 0.15)' } : {}}
                  >
                    <div className="flex items-center gap-2">
                      <group.icon className="h-4 w-4" />
                      <span>{group.label}</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded ? "rotate-180" : "")} />
                  </button>
                  
                  {isExpanded && (
                    <div className="mt-1 space-y-0.5 mr-3 border-r-2 border-white/10 pr-1">
                      {group.items.map((item) => {
                        const isItemActive = currentPageName === item.page;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                              isItemActive 
                                ? "text-white shadow-lg" 
                                : "text-slate-300 hover:text-white hover:bg-white/10"
                            )}
                            style={isItemActive ? { backgroundColor: '#d4a853' } : {}}
                          >
                            <item.icon className={cn("h-4 w-4", isItemActive ? "text-white" : "text-slate-400")} />
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User section */}
          {user && (
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#d4a853' }}>
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-red-400 hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:mr-72">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 backdrop-blur-lg border-b border-slate-200 lg:hidden" style={{ backgroundColor: '#1e3a5f' }}>
          <div className="flex items-center justify-between px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="text-white hover:bg-white/10"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-bold text-white">
              {settings?.system_name || 'إدارة المخزون'}
            </span>
            <div className="w-10" />
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8 bg-slate-100 min-h-screen">
          {children}
        </main>
      </div>

    </div>
  );
}