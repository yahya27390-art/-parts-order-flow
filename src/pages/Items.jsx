import React, { useState } from 'react';
import { Pencil, Plus, Package, Search, SlidersHorizontal, Trash2, FileDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import TablePagination from '@/components/TablePagination';
import { useAuth } from '@/lib/AuthContext';
import { useAdjustStock, useDeleteItem, useItemsPage, useSaveItem } from '@/features/items/hooks';
import { useListParams } from '@/hooks/useListParams';
import { downloadCsv, csvFileStamp } from '@/lib/csv';
import { formatCurrency, formatQuantity, toNumber } from '@/lib/format';
import { BRAND_LABELS, LOW_STOCK_THRESHOLD } from '@/lib/labels';
import ItemFormDialog from '@/components/items/ItemFormDialog';
import StockAdjustDialog from '@/components/items/StockAdjustDialog';

const BRAND_OPTIONS = [
  { value: 'all', label: 'كل الماركات' },
  { value: 'hyundai', label: 'هيونداي' },
  { value: 'kia', label: 'كيا' },
  { value: 'other', label: 'أخرى' },
];

export default function Items() {
  const { canWrite, isAdmin } = useAuth();
  const list = useListParams({ initialPageSize: 25 });
  const [brand, setBrand] = useState('all');

  const params = { ...list.params, brand: brand === 'all' ? '' : brand };
  const { data, isLoading, isFetching } = useItemsPage(params);

  const saveItem = useSaveItem();
  const deleteItem = useDeleteItem();
  const adjustStock = useAdjustStock();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const rows = data?.rows ?? [];

  const openCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (formData) => {
    try {
      await saveItem.mutateAsync({ id: editingItem?.id, values: formData });
      setDialogOpen(false);
      setEditingItem(null);
    } catch {
      /* رسالة الخطأ تظهر من الـ hook */
    }
  };

  const handleAdjustSubmit = async (payload) => {
    try {
      await adjustStock.mutateAsync(payload);
      setAdjustTarget(null);
    } catch {
      /* رسالة الخطأ تظهر من الـ hook */
    }
  };

  const exportItems = () => {
    downloadCsv(
      `items-${csvFileStamp()}`,
      rows,
      [
        { key: 'item_number', label: 'رقم الصنف' },
        { key: 'item_name', label: 'اسم الصنف' },
        { key: 'brand', label: 'الماركة' },
        { key: 'cost', label: 'التكلفة' },
        { key: 'current_stock', label: 'الرصيد الحالي' },
        { key: 'pending_stock', label: 'مخزون الطلبات' },
        { key: 'average_cost', label: 'متوسط التكلفة' },
      ],
      { delimiter: ',' },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="دليل الأصناف"
        subtitle="إدارة قطع الغيار والأصناف وأرصدتها"
        icon={Package}
        actions={
          <>
            <Button variant="outline" onClick={exportItems} disabled={rows.length === 0}>
              <FileDown className="ml-2 h-4 w-4" />
              تصدير CSV
            </Button>
            {canWrite ? (
              <Button onClick={openCreate} className="bg-brand hover:opacity-90">
                <Plus className="ml-2 h-4 w-4" />
                إضافة صنف
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="بحث برقم الصنف أو الاسم..."
            value={list.search}
            onChange={(event) => list.setSearch(event.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="الماركة" />
          </SelectTrigger>
          <SelectContent>
            {BRAND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Package}
              title="لا توجد أصناف"
              description={list.search ? 'لا توجد نتائج مطابقة للبحث' : 'ابدأ بإضافة الأصناف إلى الدليل'}
              action={
                canWrite ? (
                  <Button onClick={openCreate} className="bg-brand hover:opacity-90">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة صنف
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-brand hover:bg-brand">
                      <TableHead className="text-right text-white">رقم الصنف</TableHead>
                      <TableHead className="text-right text-white">اسم الصنف</TableHead>
                      <TableHead className="text-right text-white">الماركة</TableHead>
                      <TableHead className="text-right text-white">التكلفة</TableHead>
                      <TableHead className="text-right text-white">الرصيد الحالي</TableHead>
                      <TableHead className="text-right text-white">مخزون الطلبات</TableHead>
                      {canWrite ? <TableHead className="text-center text-white">الإجراءات</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((item) => {
                      const stock = toNumber(item.current_stock);
                      const isLow = stock < LOW_STOCK_THRESHOLD;
                      return (
                        <TableRow key={item.id} className="hover:bg-slate-50">
                          <TableCell>
                            <span dir="ltr" className="inline-block font-mono font-medium">
                              {item.item_number}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[240px] truncate">{item.item_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {BRAND_LABELS[item.brand] || item.brand || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(item.cost)}</TableCell>
                          <TableCell>
                            <span className={`font-medium ${isLow ? 'text-red-600' : 'text-emerald-600'}`}>
                              {formatQuantity(stock)}
                            </span>
                          </TableCell>
                          <TableCell className="text-brand-accent">{formatQuantity(item.pending_stock)}</TableCell>
                          {canWrite ? (
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="تسوية الرصيد"
                                  onClick={() => setAdjustTarget(item)}
                                  className="text-slate-500 hover:text-brand-accent"
                                >
                                  <SlidersHorizontal className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="تعديل"
                                  onClick={() => {
                                    setEditingItem(item);
                                    setDialogOpen(true);
                                  }}
                                  className="text-slate-500 hover:text-blue-600"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {isAdmin ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="حذف"
                                    onClick={() => setDeleteTarget(item)}
                                    className="text-slate-500 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={data?.page ?? 1}
                pageSize={data?.pageSize ?? list.pageSize}
                total={data?.total ?? 0}
                hasMore={data?.hasMore}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
                className={isFetching ? 'opacity-60' : ''}
              />
            </>
          )}
        </CardContent>
      </Card>

      <ItemFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        onSubmit={handleSubmit}
        busy={saveItem.isPending}
      />

      <StockAdjustDialog
        open={Boolean(adjustTarget)}
        onOpenChange={(open) => !open && setAdjustTarget(null)}
        item={adjustTarget}
        onSubmit={handleAdjustSubmit}
        busy={adjustStock.isPending}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="تأكيد حذف الصنف"
        description={`سيتم حذف الصنف "${deleteTarget?.item_name || ''}". لا يمكن الحذف إذا كان مرتبطًا بطلبات شراء أو إذونات استلام.`}
        confirmLabel="حذف"
        destructive
        busy={deleteItem.isPending}
        onConfirm={async () => {
          try {
            await deleteItem.mutateAsync(deleteTarget.id);
          } finally {
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}

