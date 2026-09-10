import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";


import { ArrowRight, Printer, ClipboardList, Pencil, Clock, User } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";

export default function GoodsReceiptDetails() {
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const receiptId = urlParams.get('id');

  useEffect(() => {
    if (receiptId) {
      loadReceiptDetails();
    }
    loadUser();
    loadSettings();
  }, [receiptId]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (e) {}
  };

  const loadSettings = async () => {
    try {
      const settingsList = await base44.entities.SystemSettings.list();
      if (settingsList.length > 0) {
        setSettings(settingsList[0]);
      }
    } catch (e) {}
  };

  const loadReceiptDetails = async () => {
    try {
      const [receiptData, itemsData] = await Promise.all([
        base44.entities.GoodsReceipt.filter({ id: receiptId }),
        base44.entities.GoodsReceiptItem.filter({ receipt_id: receiptId })
      ]);

      setReceipt(receiptData[0]);
      setReceiptItems(itemsData);
    } catch (error) {
      console.error('Error loading receipt:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isAdmin = user?.role === 'admin';

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="text-center py-16">
        <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">لم يتم العثور على إذن الاستلام</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          
          body * {
            visibility: hidden;
          }
          
          .print-area, .print-area * {
            visibility: visible;
          }
          
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            background: white;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-header {
            border-bottom: 3px double #1e3a5f;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          
          .print-table {
            width: 100%;
            border-collapse: collapse;
          }
          
          .print-table th {
            background-color: #1e3a5f !important;
            color: white !important;
            padding: 12px 8px;
            font-weight: 600;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .print-table td {
            padding: 10px 8px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .print-table tr:nth-child(even) {
            background-color: #f8fafc;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .print-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
          }
        }
      `}</style>

      {/* Screen Header - Hidden on Print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
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
            <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>{receipt.receipt_number}</h1>
            <p className="text-slate-500 mt-1">طلب رقم: {receipt.order_number}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>
          {isAdmin && (
            <Link to={createPageUrl(`EditGoodsReceipt?id=${receipt.id}`)}>
              <Button style={{ backgroundColor: '#d4a853' }} className="hover:opacity-90 text-white">
                <Pencil className="h-4 w-4 ml-2" />
                تعديل
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Printable Area */}
      <div className="print-area" dir="rtl">
        {/* Print Header */}
        <div className="print-header hidden print:block">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {settings?.logo_url && settings?.show_logo_print && (
                <img src={settings.logo_url} alt="Logo" className="h-16 w-16 object-contain" />
              )}
              <div>
                <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>
                  {settings?.system_name || 'نظام إدارة المخزون'}
                </h1>
                <p className="text-slate-500 text-sm">إذن استلام بضاعة</p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-sm text-slate-500">التاريخ</p>
              <p className="font-bold">{new Date().toLocaleDateString('ar-SA')}</p>
            </div>
          </div>
        </div>

        {/* Receipt Info */}
        <Card className="border-0 shadow-sm print:shadow-none print:border print:border-slate-200">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print:grid-cols-4">
              <div>
                <p className="text-sm text-slate-500">رقم الإذن</p>
                <p className="font-bold mt-1" style={{ color: '#1e3a5f' }}>{receipt.receipt_number}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">رقم الطلب</p>
                <p className="font-medium mt-1">{receipt.order_number}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">تاريخ ووقت الاستلام</p>
                <p className="font-medium mt-1">{new Date(receipt.receipt_date).toLocaleString('ar-SA')}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">إجمالي الإذن</p>
                <p className="font-bold text-lg mt-1" style={{ color: '#d4a853' }}>{(receipt.total_amount || 0).toFixed(2)} ر.س</p>
              </div>
            </div>
            
            {receipt.notes && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-slate-500">ملاحظات</p>
                <p className="mt-1">{receipt.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt Items */}
        <Card className="border-0 shadow-sm mt-6 print:shadow-none print:border print:border-slate-200">
          <CardHeader className="border-b print:bg-white" style={{ backgroundColor: '#1e3a5f' }}>
            <CardTitle className="text-lg text-white print:text-slate-800">الأصناف المستلمة</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full print-table">
                <thead>
                  <tr style={{ backgroundColor: '#1e3a5f' }}>
                    <th className="text-right text-white p-3 print:bg-slate-800">م</th>
                    <th className="text-right text-white p-3 print:bg-slate-800">رقم الصنف</th>
                    <th className="text-right text-white p-3 print:bg-slate-800">اسم الصنف</th>
                    <th className="text-right text-white p-3 print:bg-slate-800">الكمية</th>
                    <th className="text-right text-white p-3 print:bg-slate-800">سعر الوحدة</th>
                    <th className="text-right text-white p-3 print:bg-slate-800">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptItems.map((item, index) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="p-3 text-center">{index + 1}</td>
                      <td className="p-3">
                        <span dir="ltr" style={{ display: 'inline-block', textAlign: 'left', fontFamily: 'monospace' }}>{item.item_number}</span>
                      </td>
                      <td className="p-3">{item.item_name}</td>
                      <td className="p-3 font-medium">{item.quantity_received}</td>
                      <td className="p-3">{(item.unit_cost || 0).toFixed(2)} ر.س</td>
                      <td className="p-3 font-bold">{(item.total_cost || 0).toFixed(2)} ر.س</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <td colSpan="3" className="p-3 font-bold text-left">الإجمالي</td>
                    <td className="p-3 font-bold">{receiptItems.reduce((sum, i) => sum + i.quantity_received, 0)}</td>
                    <td className="p-3">-</td>
                    <td className="p-3 font-bold" style={{ color: '#d4a853' }}>{(receipt.total_amount || 0).toFixed(2)} ر.س</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Last Modified Info - Screen Only */}
        {receipt.last_modified_by && (
          <Card className="border-0 shadow-sm mt-6 no-print">
            <CardContent className="p-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <User className="h-4 w-4" />
                  <span>آخر تعديل بواسطة: <strong className="text-slate-700">{receipt.last_modified_by}</strong></span>
                </div>
                {receipt.last_modified_at && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(receipt.last_modified_at).toLocaleString('ar-SA')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Print Footer */}
        <div className="print-footer hidden print:block mt-10">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-sm text-slate-500 mb-8">المستلم</p>
              <div className="border-t border-slate-300 pt-2">
                <p className="text-sm">التوقيع: ________________</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-8">أمين المستودع</p>
              <div className="border-t border-slate-300 pt-2">
                <p className="text-sm">التوقيع: ________________</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-8">المدير</p>
              <div className="border-t border-slate-300 pt-2">
                <p className="text-sm">التوقيع: ________________</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
            <p>تم إنشاء هذا المستند بواسطة {settings?.system_name || 'نظام إدارة المخزون'}</p>
            <p>تاريخ الطباعة: {new Date().toLocaleString('ar-SA')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}