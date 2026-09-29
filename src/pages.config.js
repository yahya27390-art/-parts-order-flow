/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import { lazy } from 'react';

// ملاحظة: هذا الملف كان يُولَّد تلقائيًا من منصة Base44، والمشروع الآن مستقل
// يعمل على Supabase، لذا يُدار يدويًا. الاستيراد هنا "كسول" (lazy) حتى لا
// تُحمَّل كل الصفحات في الحزمة الأولى، فيقلّ زمن التحميل الأولي بشكل كبير.
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const CreateGoodsReceipt = lazy(() => import('./pages/CreateGoodsReceipt'));
const CreatePurchaseOrder = lazy(() => import('./pages/CreatePurchaseOrder'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const EditGoodsReceipt = lazy(() => import('./pages/EditGoodsReceipt'));
const EditPurchaseOrder = lazy(() => import('./pages/EditPurchaseOrder'));
const GoodsReceiptDetails = lazy(() => import('./pages/GoodsReceiptDetails'));
const GoodsReceipts = lazy(() => import('./pages/GoodsReceipts'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Items = lazy(() => import('./pages/Items'));
const PurchaseOrderDetails = lazy(() => import('./pages/PurchaseOrderDetails'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const Reports = lazy(() => import('./pages/Reports'));
const SelectOrderForReceipt = lazy(() => import('./pages/SelectOrderForReceipt'));
const __Layout = lazy(() => import('./Layout.jsx'));


export const PAGES = {
    "AdminSettings": AdminSettings,
    "CreateGoodsReceipt": CreateGoodsReceipt,
    "CreatePurchaseOrder": CreatePurchaseOrder,
    "Dashboard": Dashboard,
    "EditGoodsReceipt": EditGoodsReceipt,
    "EditPurchaseOrder": EditPurchaseOrder,
    "GoodsReceiptDetails": GoodsReceiptDetails,
    "GoodsReceipts": GoodsReceipts,
    "Inventory": Inventory,
    "Items": Items,
    "PurchaseOrderDetails": PurchaseOrderDetails,
    "PurchaseOrders": PurchaseOrders,
    "Reports": Reports,
    "SelectOrderForReceipt": SelectOrderForReceipt,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};