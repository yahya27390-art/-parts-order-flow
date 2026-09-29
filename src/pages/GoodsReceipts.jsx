import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, ClipboardList, Eye, Plus, Search, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import TablePagination from '@/components/TablePagination';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { useReceiptsPage, useVoidGoodsReceipt } from '@/features/receipts/hooks';
import { useListParams } from '@/hooks/useListParams';
import { downloadCsv, csvFileStamp } from '@/lib/csv';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { FileDown } from 'lucide-react';

export default function GoodsReceipts() {
  const { canWrite, isAdmin } = useAuth();
  const list = useListParams({ initialPageSize: 25 });
  const { data, isLoading, isFetching } = useReceiptsPage(list.params);
  const voidReceipt = useVoidGoodsReceipt();

  const [voidTarget, setVoidTarget] = useState(null);

  const rows = data?.rows ?? [];

  const exportReceipts = () => {
    downloadCsv(`goods-receipts-${csvFileStamp()}`, rows, [
      { key: 'receipt_number', label: 'رقم الإذن' },
      { key: 'order_number', label: 'رقم الطلب' },
      { key: 'receipt_date', label: 'تاريخ الاستلام' },
      { key: 'total_amount', label: 'الإجمالي' },
      { key: 'last_modified_by', label: 'آخر تعديل بواسطة' },
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="إذونات الاستلام"
        subtitle="سجل استلام البضائع وتحديث أرصدة المخزون"
        icon={ClipboardList}
        actions={
          <>
            <Button variant="outline" onClick={exportReceipts} disabled={rows.length === 0}>
              <FileDown className="ml-2 h-4 w-4" />
              تصدير CSV
            </Button>
            {canWrite ? (
              <Link to={createPageUrl('SelectOrderForReceipt')}>
                <Button className="bg-brand-accent text-white hover:opacity-90">
                  <Plus className="ml-2 h-4 w-4" />
                  إذن استلام جديد
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="بحث برقم الإذن أو رقم الطلب..."
          value={list.search}
          onChange={(event) => list.setSearch(event.target.value)}
          className="pr-10"
        />
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
              icon={ClipboardList}
              title="لا توجد إذونات استلام"
              description={list.search ? 'لا توجد نتائج مطابقة للبحث' : 'ابدأ بتسجيل أول إذن استلام'}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-brand hover:bg-brand">
                      <TableHead className="text-right text-white">رقم الإذن</TableHead>
                      <TableHead className="text-right text-white">رقم الطلب</TableHead>
                      <TableHead className="text-right text-white">تاريخ الاستلام</TableHead>
                      <TableHead className="text-right text-white">الإجمالي</TableHead>
                      <TableHead className="text-right text-white">آخر تعديل</TableHead>
                      {canWrite ? <TableHead className="text-center text-white">الإجراءات</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((receipt) => (
                      <TableRow key={receipt.id} className="hover:bg-slate-50">
                        <TableCell>
                          <span dir="ltr" className="inline-block font-medium">
                            {receipt.receipt_number}
                          </span>
                        </TableCell>
                        <TableCell>{receipt.order_number}</TableCell>
                        <TableCell>{formatDateTime(receipt.receipt_date)}</TableCell>
                        <TableCell className="font-medium text-brand-accent">
                          {formatCurrency(receipt.total_amount)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {receipt.last_modified_by ? (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{receipt.last_modified_by}</span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        {canWrite ? (
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Link to={createPageUrl(`GoodsReceiptDetails?id=${receipt.id}`)}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="عرض"
                                  className="text-slate-500 hover:text-blue-600"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              {isAdmin ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="إلغاء الإذن"
                                  onClick={() => setVoidTarget(receipt)}
                                  className="text-slate-500 hover:text-red-600"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
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

      <ConfirmDialog
        open={Boolean(voidTarget)}
        onOpenChange={(open) => !open && setVoidTarget(null)}
        title="إلغاء إذن الاستلام"
        description={`سيتم عكس أثر الإذن ${voidTarget?.receipt_number || ''} على المخزون وكميات الطلب. يبقى الإذن محفوظًا للأرشيف مع سبب الإلغاء.`}
        confirmLabel="تأكيد الإلغاء"
        reasonLabel="سبب الإلغاء"
        reasonRequired
        destructive
        busy={voidReceipt.isPending}
        onConfirm={async (reason) => {
          try {
            await voidReceipt.mutateAsync({ receiptId: voidTarget.id, reason });
          } finally {
            setVoidTarget(null);
          }
        }}
      />

    </div>
  );
}
