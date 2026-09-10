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
import AdminSettings from './pages/AdminSettings';
import CreateGoodsReceipt from './pages/CreateGoodsReceipt';
import CreatePurchaseOrder from './pages/CreatePurchaseOrder';
import Dashboard from './pages/Dashboard';
import EditGoodsReceipt from './pages/EditGoodsReceipt';
import EditPurchaseOrder from './pages/EditPurchaseOrder';
import GoodsReceiptDetails from './pages/GoodsReceiptDetails';
import GoodsReceipts from './pages/GoodsReceipts';
import Inventory from './pages/Inventory';
import Items from './pages/Items';
import PurchaseOrderDetails from './pages/PurchaseOrderDetails';
import PurchaseOrders from './pages/PurchaseOrders';
import Reports from './pages/Reports';
import SelectOrderForReceipt from './pages/SelectOrderForReceipt';
import __Layout from './Layout.jsx';


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