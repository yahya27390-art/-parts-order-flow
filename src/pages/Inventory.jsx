import React from 'react';
import { AlertCircle, Boxes, Package, Search, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import TablePagination from '@/components/TablePagination';
import { useInventoryPage, useInventorySummary } from '@/features/inventory/hooks';
import { useListParams } from '@/hooks/useListParams';
import { formatCurrency, formatCurrencyCompact, formatQuantity } from '@/lib/format';
import { BRAND_LABELS, LOW_STOCK_THRESHOLD } from '@/lib/labels';

const STATUS_OPTIONS = [
  { value: 'all', label: 'كل الأرصدة' },
  { value: 'ok', label: 'متاح' },
  { value: 'low', label: 'منخفض' },
  { value: 'out', label: 'غير متوفر' },
  { value: 'negative', label: 'رصيد سالب' },
];

export default function Inventory() {
  const list = useListParams({ initialPageSize: 25 });
  const { data, isLoading, isFetching } = useInventoryPage(list.params);
  const { data: summary } = useInventorySummary();

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="المخزون الحالي"
        subtitle="الرصيد المتاح يُحتسب من حركات المخزون ويزيد عند الاستلام الفعلي فقط"
        icon={Boxes}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي الأصناف" value={summary?.itemsCount ?? '—'} icon={Package} tone="brand" />
        <StatCard
          title="قيمة المخزون"
          value={summary ? formatCurrencyCompact(summary.totalValue) : '—'}
          icon={TrendingUp}
          tone="accent"
        />
        <StatCard
          title="أصناف منخفضة"
          value={summary?.lowStockCount ?? '—'}
          hint={`أقل من ${LOW_STOCK_THRESHOLD} وحدات`}
          icon={AlertCircle}
          tone="warning"
        />
        <StatCard
          title="غير متوفرة / سالبة"
          value={summary ? `${summary.outOfStockCount} / ${summary.negativeCount}` : '—'}
          icon={AlertCircle}
          tone="danger"
        />
      </div>

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
        <Select value={list.status} onValueChange={list.setStatus}>
          <SelectTrigger className="w-full sm:w-48">
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
            <EmptyState icon={Package} title="لا توجد أصناف مطابقة" description="جرّب تعديل كلمة البحث أو الفلتر" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-brand hover:bg-brand">
                      <TableHead className="text-right text-white">رقم الصنف</TableHead>
                      <TableHead className="text-right text-white">اسم الصنف</TableHead>
                      <TableHead className="text-right text-white">الماركة</TableHead>
                      <TableHead className="text-right text-white">الرصيد المتاح</TableHead>
                      <TableHead className="text-right text-white">مخزون الطلبات</TableHead>
                      <TableHead className="text-right text-white">متوسط التكلفة</TableHead>
                      <TableHead className="text-right text-white">قيمة المخزون</TableHead>
                      <TableHead className="text-right text-white">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((item) => (
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
                        <TableCell className="font-bold">{formatQuantity(item.available_stock)}</TableCell>
                        <TableCell className="text-brand-accent">{formatQuantity(item.on_order_stock)}</TableCell>
                        <TableCell>{formatCurrency(item.average_cost)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(item.stock_value)}</TableCell>
                        <TableCell>
                          <StatusBadge type="stock" status={item.stock_status} />
                        </TableCell>
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

    </div>
  );
}
