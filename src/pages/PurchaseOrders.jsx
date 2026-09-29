import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Filter, Pencil, Plus, Search, ShoppingCart, Ban, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import TablePagination from '@/components/TablePagination';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { useCancelPurchaseOrder, useDeletePurchaseOrder, useOrdersPage } from '@/features/orders/hooks';
import { isOpenOrderStatus } from '@/features/orders/logic';
import { useListParams } from '@/hooks/useListParams';
import { formatCurrency, formatDate } from '@/lib/format';
import { ORDER_STATUS } from '@/lib/labels';

const STATUS_OPTIONS = [
  { value: 'all', label: 'جميع الحالات' },
  { value: 'pending', label: ORDER_STATUS.pending.label },
  { value: 'partial', label: ORDER_STATUS.partial.label },
  { value: 'completed', label: ORDER_STATUS.completed.label },
  { value: 'cancelled', label: ORDER_STATUS.cancelled.label },
];

export default function PurchaseOrders() {
  const { canWrite, isAdmin } = useAuth();
  const list = useListParams({ initialPageSize: 25 });
  const { data, isLoading, isFetching } = useOrdersPage(list.params);

  const cancelOrder = useCancelPurchaseOrder();
  const deleteOrder = useDeletePurchaseOrder();

  const [cancelTarget, setCancelTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="طلبات الشراء"
        subtitle="إدارة طلبات الشراء من الموردين ومتابعة استلامها"
        icon={ShoppingCart}
        actions={
          canWrite ? (
            <Link to={createPageUrl('CreatePurchaseOrder')}>
              <Button className="bg-brand hover:opacity-90">
                <Plus className="ml-2 h-4 w-4" />
                طلب شراء جديد
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="بحث برقم الطلب أو المورد..."
            value={list.search}
            onChange={(event) => list.setSearch(event.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={list.status} onValueChange={list.setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="ml-2 h-4 w-4" />
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
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
              icon={ShoppingCart}
              title="لا توجد طلبات شراء"
              description={list.search || list.status !== 'all' ? 'لا توجد نتائج مطابقة للفلاتر الحالية' : undefined}
              action={
                canWrite ? (
                  <Link to={createPageUrl('CreatePurchaseOrder')}>
                    <Button className="bg-brand hover:opacity-90">
                      <Plus className="ml-2 h-4 w-4" />
                      طلب شراء جديد
                    </Button>
                  </Link>
                ) : null
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-brand hover:bg-brand">
                      <TableHead className="text-right text-white">رقم الطلب</TableHead>
                      <TableHead className="text-right text-white">التاريخ</TableHead>
                      <TableHead className="text-right text-white">المورد</TableHead>
                      <TableHead className="text-right text-white">الإجمالي</TableHead>
                      <TableHead className="text-right text-white">الحالة</TableHead>
                      {canWrite ? <TableHead className="text-center text-white">الإجراءات</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((order) => (
                      <TableRow key={order.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{formatDate(order.order_date)}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{order.supplier_name}</TableCell>
                        <TableCell className="font-medium text-brand-accent">
                          {formatCurrency(order.total_amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge type="order" status={order.status} />
                        </TableCell>
                        {canWrite ? (
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Link to={createPageUrl(`PurchaseOrderDetails?id=${order.id}`)}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="عرض"
                                  className="text-slate-500 hover:text-blue-600"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              {isOpenOrderStatus(order.status) ? (
                                <>
                                  <Link to={createPageUrl(`EditPurchaseOrder?id=${order.id}`)}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="تعديل"
                                      className="text-slate-500 hover:text-brand-accent"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                  {isAdmin ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="إلغاء الطلب"
                                      onClick={() => setCancelTarget(order)}
                                      className="text-slate-500 hover:text-amber-600"
                                    >
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </>
                              ) : null}
                              {isAdmin ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="حذف"
                                  onClick={() => setDeleteTarget(order)}
                                  className="text-slate-500 hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
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
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="إلغاء طلب الشراء"
        description={`سيتم إلغاء الطلب ${cancelTarget?.order_number || ''} وإخراج الكميات غير المستلمة من مخزون الطلبات. يبقى المستند محفوظًا للأرشيف.`}
        confirmLabel="تأكيد الإلغاء"
        reasonLabel="سبب الإلغاء"
        reasonRequired
        busy={cancelOrder.isPending}
        onConfirm={async (reason) => {
          try {
            await cancelOrder.mutateAsync({ orderId: cancelTarget.id, reason });
          } finally {
            setCancelTarget(null);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف طلب الشراء نهائيًا"
        description={`سيتم حذف الطلب ${deleteTarget?.order_number || ''} وبنوده. لا يمكن الحذف إذا وُجدت إذونات استلام مرتبطة به.`}
        confirmLabel="حذف"
        destructive
        busy={deleteOrder.isPending}
        onConfirm={async () => {
          try {
            await deleteOrder.mutateAsync(deleteTarget.id);
          } finally {
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
