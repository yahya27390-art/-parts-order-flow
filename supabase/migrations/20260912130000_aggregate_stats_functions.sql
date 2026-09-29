-- ============================================================================
-- 20260912130000_aggregate_stats_functions.sql
--
-- الغرض: تقليل عدد الطلبات الشبكية (وهو سبب الإحساس بالبطء).
-- القياس الفعلي: زمن الذهاب والعودة لكل طلب ≈ 300 مللي ثانية، وحجم الصفوف
-- لا يؤثر (200 صف = 305ms مقابل 1000 صف = 303ms)، لذلك المكسب كله في
-- استبدال عمليات المسح المتعددة الصفحات باستعلام تجميعي واحد.
-- ============================================================================

create or replace function public.get_inventory_stats(p_low_threshold numeric default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_result jsonb;
begin
  perform public.assert_authenticated();

  select jsonb_build_object(
           'items_count', count(*),
           'total_quantity', coalesce(sum(coalesce(current_stock, 0)), 0),
           'total_value', coalesce(round(sum(coalesce(current_stock, 0) * coalesce(average_cost, 0)), 2), 0),
           'ok_count', count(*) filter (where coalesce(current_stock, 0) >= p_low_threshold),
           'low_count', count(*) filter (where coalesce(current_stock, 0) > 0
                                           and coalesce(current_stock, 0) < p_low_threshold),
           'out_count', count(*) filter (where coalesce(current_stock, 0) = 0),
           'negative_count', count(*) filter (where coalesce(current_stock, 0) < 0)
         )
    into v_result
    from public.items;

  return v_result;
end;
$fn$;

create or replace function public.get_purchase_stats(p_overdue_days integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_result jsonb;
begin
  perform public.assert_authenticated();

  select jsonb_build_object(
           'total_orders', count(*),
           'pending_orders', count(*) filter (where status = 'pending'),
           'partial_orders', count(*) filter (where status = 'partial'),
           'completed_orders', count(*) filter (where status = 'completed'),
           'cancelled_orders', count(*) filter (where status = 'cancelled'),
           'open_orders', count(*) filter (where status in ('pending', 'partial')),
           'overdue_orders', count(*) filter (
             where status in ('pending', 'partial')
               and order_date < current_date - p_overdue_days
           )
         )
    into v_result
    from public.purchase_orders;

  return jsonb_build_object(
    'orders', v_result,
    'ordered_quantity', (select coalesce(sum(quantity_ordered), 0) from public.purchase_order_items),
    'received_quantity', (select coalesce(sum(quantity_received), 0) from public.purchase_order_items),
    'receipts_today', (
      select count(*) from public.goods_receipts
       where receipt_date >= date_trunc('day', now())
         and voided_at is null
    ),
    'receipts_total', (select count(*) from public.goods_receipts where voided_at is null)
  );
end;
$fn$;

do $grants$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('get_inventory_stats', 'get_purchase_stats')
  loop
    execute format('revoke all on function %s from public, anon', r.signature);
    execute format('grant execute on function %s to authenticated', r.signature);
  end loop;
end;
$grants$;

-- انتهى: دوال إحصاء تجميعي تُغني عن مسح آلاف الصفوف.
