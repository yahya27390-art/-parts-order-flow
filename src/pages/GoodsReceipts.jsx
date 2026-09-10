import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
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
import { Plus, Search, Eye, ClipboardList } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";

export default function GoodsReceipts() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadReceipts();
  }, []);

  const loadReceipts = async () => {
    try {
      const data = await base44.entities.GoodsReceipt.list('-created_date');
      setReceipts(data);
    } catch (error) {
      console.error('Error loading receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReceipts = receipts.filter(receipt =>
    receipt.receipt_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.order_number?.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>إذونات الاستلام</h1>
          <p className="text-slate-500 mt-1">سجل استلام البضائع</p>
        </div>
        <Link to={createPageUrl('SelectOrderForReceipt')}>
          <Button style={{ backgroundColor: '#d4a853' }} className="hover:opacity-90 text-white">
            <Plus className="h-4 w-4 ml-2" />
            إذن استلام جديد
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="بحث برقم الإذن أو الطلب..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Receipts Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filteredReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardList className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500">لا توجد إذونات استلام</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: '#1e3a5f' }}>
                    <TableHead className="text-right text-white">رقم الإذن</TableHead>
                    <TableHead className="text-right text-white">رقم الطلب</TableHead>
                    <TableHead className="text-right text-white">تاريخ الاستلام</TableHead>
                    <TableHead className="text-right text-white">الإجمالي</TableHead>
                    <TableHead className="text-right text-white">آخر تعديل</TableHead>
                    <TableHead className="text-center text-white">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map(receipt => (
                    <TableRow key={receipt.id} className="hover:bg-slate-50">
                      <TableCell><span dir="ltr" className="font-medium" style={{ display: 'inline-block', textAlign: 'left' }}>{receipt.receipt_number}</span></TableCell>
                      <TableCell>{receipt.order_number}</TableCell>
                      <TableCell>{new Date(receipt.receipt_date).toLocaleString('ar-SA')}</TableCell>
                      <TableCell style={{ color: '#d4a853' }} className="font-medium">{(receipt.total_amount || 0).toFixed(2)} ر.س</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {receipt.last_modified_by ? (
                          <div>
                            <div>{receipt.last_modified_by}</div>
                            <div className="text-xs">{receipt.last_modified_at ? new Date(receipt.last_modified_at).toLocaleString('ar-SA') : ''}</div>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Link to={createPageUrl(`GoodsReceiptDetails?id=${receipt.id}`)}>
                            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-blue-600">
                              <Eye className="h-4 w-4" />
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