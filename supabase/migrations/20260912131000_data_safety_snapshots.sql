-- ============================================================================
-- 20260912131000_data_safety_snapshots.sql
--
-- الغرض: حماية البيانات من أي خطأ بشري أو ترحيل خاطئ.
--   1) جدول تخزين نسخ كاملة من بيانات الأعمال (jsonb) داخل القاعدة.
--   2) دالة snapshot_business_data(name) لحفظ نسخة قبل أي تعديل.
--   3) دالة restore_business_data(name, confirm) للاسترجاع الطارئ.
--
-- ملاحظة مهمة: هذا الملف لا يُعدّل أي بيانات إطلاقًا — إنشاء جداول ودوال فقط.
-- النسخ المخزَّنة هنا تحمي من الأخطاء المنطقية/الترحيلات، أما الكوارث
-- (حذف المشروع) فحمايتها بالنسخ الاحتياطي خارج القاعدة (pg_dump أو Supabase Backups).
-- ============================================================================

create table if not exists public.data_safety_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_name text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  items jsonb not null default '[]'::jsonb,
  system_settings jsonb not null default '[]'::jsonb,
  purchase_orders jsonb not null default '[]'::jsonb,
  purchase_order_items jsonb not null default '[]'::jsonb,
  goods_receipts jsonb not null default '[]'::jsonb,
  goods_receipt_items jsonb not null default '[]'::jsonb,
  stock_movements jsonb not null default '[]'::jsonb
);

create index if not exists data_safety_snapshots_name_idx
  on public.data_safety_snapshots(snapshot_name, created_date desc);

alter table public.data_safety_snapshots enable row level security;

drop policy if exists "admins can read snapshots" on public.data_safety_snapshots;
create policy "admins can read snapshots"
on public.data_safety_snapshots for select to authenticated
using (public.is_admin());

-- لا كتابة مباشرة إطلاقًا: الحفظ والاسترجاع عبر الدوال فقط.
revoke all on public.data_safety_snapshots from anon;
revoke insert, update, delete on public.data_safety_snapshots from authenticated;

-- ----------------------------------------------------------------------------
-- حفظ نسخة كاملة من بيانات الأعمال
-- ----------------------------------------------------------------------------
create or replace function public.snapshot_business_data(p_name text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
begin
  perform public.assert_authenticated();

  if not public.is_admin() then
    raise exception 'INSUFFICIENT_ROLE' using errcode = '42501';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'SNAPSHOT_NAME_REQUIRED' using errcode = '22023';
  end if;

  insert into public.data_safety_snapshots (
    snapshot_name, note, created_by,
    items, system_settings, purchase_orders, purchase_order_items,
    goods_receipts, goods_receipt_items, stock_movements
  )
  select
    trim(p_name),
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid(),
    coalesce((select jsonb_agg(to_jsonb(t)) from public.items t), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(t)) from public.system_settings t), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(t)) from public.purchase_orders t), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(t)) from public.purchase_order_items t), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(t)) from public.goods_receipts t), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(t)) from public.goods_receipt_items t), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(t)) from public.stock_movements t), '[]'::jsonb)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'name', trim(p_name),
    'created_date', now(),
    'items', (select jsonb_array_length(items) from public.data_safety_snapshots where id = v_id),
    'orders', (select jsonb_array_length(purchase_orders) from public.data_safety_snapshots where id = v_id),
    'receipts', (select jsonb_array_length(goods_receipts) from public.data_safety_snapshots where id = v_id)
  );
end;
$fn$;

/** عرض النسخ المحفوظة (اسم، تاريخ، عدد الصفوف). */
create or replace function public.list_data_snapshots()
returns table (
  snapshot_name text,
  created_date timestamptz,
  items_count integer,
  orders_count integer,
  receipts_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select s.snapshot_name,
         s.created_date,
         jsonb_array_length(s.items),
         jsonb_array_length(s.purchase_orders),
         jsonb_array_length(s.goods_receipts)
    from public.data_safety_snapshots s
   where public.is_admin()
   order by s.created_date desc;
$fn$;

-- ----------------------------------------------------------------------------
-- الاسترجاع الطارئ من نسخة محفوظة (للمدير فقط، ويتطلب تأكيدًا صريحًا)
-- ⚠️ خطير: يستبدل بيانات الأعمال الحالية ببيانات النسخة المحددة.
--    خُذ نسخة جديدة (snapshot_business_data) قبل تشغيله دائمًا.
-- ----------------------------------------------------------------------------
create or replace function public.restore_business_data(p_name text, p_confirm boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_snapshot public.data_safety_snapshots%rowtype;
begin
  perform public.assert_authenticated();

  if not public.is_admin() then
    raise exception 'INSUFFICIENT_ROLE' using errcode = '42501';
  end if;

  if p_confirm is not true then
    raise exception 'RESTORE_CONFIRMATION_REQUIRED' using errcode = '22023';
  end if;

  select * into v_snapshot
    from public.data_safety_snapshots
   where snapshot_name = trim(p_name)
   order by created_date desc
   limit 1;

  if not found then
    raise exception 'SNAPSHOT_NOT_FOUND' using errcode = '23503';
  end if;

  -- تعطيل المُشغِّلات مؤقتًا: الأرصدة تُكتب كما حُفظت تمامًا (لا إعادة حساب)،
  -- وكل ذلك داخل معاملة واحدة فلا يبقى أثر جزئي عند أي خطأ.
  alter table public.stock_movements disable trigger apply_stock_movement_trigger;
  alter table public.stock_movements disable trigger enforce_stock_write_role_trigger;
  alter table public.items disable trigger enforce_stock_write_role_trigger;
  alter table public.system_settings disable trigger enforce_stock_write_role_trigger;
  alter table public.purchase_orders disable trigger enforce_stock_write_role_trigger;
  alter table public.purchase_order_items disable trigger enforce_stock_write_role_trigger;
  alter table public.goods_receipts disable trigger enforce_stock_write_role_trigger;
  alter table public.goods_receipt_items disable trigger enforce_stock_write_role_trigger;

  -- الحذف من الأبناء إلى الآباء (احترامًا للمفاتيح الأجنبية).
  delete from public.goods_receipt_items;
  delete from public.goods_receipts;
  delete from public.purchase_order_items;
  delete from public.purchase_orders;
  delete from public.stock_movements;
  delete from public.items;
  delete from public.system_settings;

  -- الإدخال من الآباء إلى الأبناء.
  insert into public.items
    select * from jsonb_populate_recordset(null::public.items, v_snapshot.items);
  insert into public.system_settings
    select * from jsonb_populate_recordset(null::public.system_settings, v_snapshot.system_settings);
  insert into public.purchase_orders
    select * from jsonb_populate_recordset(null::public.purchase_orders, v_snapshot.purchase_orders);
  insert into public.purchase_order_items
    select * from jsonb_populate_recordset(null::public.purchase_order_items, v_snapshot.purchase_order_items);
  insert into public.goods_receipts
    select * from jsonb_populate_recordset(null::public.goods_receipts, v_snapshot.goods_receipts);
  insert into public.goods_receipt_items
    select * from jsonb_populate_recordset(null::public.goods_receipt_items, v_snapshot.goods_receipt_items);
  insert into public.stock_movements
    select * from jsonb_populate_recordset(null::public.stock_movements, v_snapshot.stock_movements);

  alter table public.stock_movements enable trigger apply_stock_movement_trigger;
  alter table public.stock_movements enable trigger enforce_stock_write_role_trigger;
  alter table public.items enable trigger enforce_stock_write_role_trigger;
  alter table public.system_settings enable trigger enforce_stock_write_role_trigger;
  alter table public.purchase_orders enable trigger enforce_stock_write_role_trigger;
  alter table public.purchase_order_items enable trigger enforce_stock_write_role_trigger;
  alter table public.goods_receipts enable trigger enforce_stock_write_role_trigger;
  alter table public.goods_receipt_items enable trigger enforce_stock_write_role_trigger;

  return jsonb_build_object(
    'restored', true,
    'snapshot', v_snapshot.snapshot_name,
    'snapshot_date', v_snapshot.created_date,
    'items', jsonb_array_length(v_snapshot.items),
    'orders', jsonb_array_length(v_snapshot.purchase_orders),
    'receipts', jsonb_array_length(v_snapshot.goods_receipts),
    'movements', jsonb_array_length(v_snapshot.stock_movements)
  );
end;
$fn$;

-- ----------------------------------------------------------------------------
-- مقارنة سريعة: هل الرصيد المخزَّن يطابق مجموع حركات الدفتر؟
-- (كشف أي خلل قبل أن يتراكم)
-- ----------------------------------------------------------------------------
create or replace function public.verify_stock_integrity()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  with diffs as (
    select i.id
      from public.items i
      left join (
        select item_id, sum(quantity) as ledger_balance
          from public.stock_movements
         group by item_id
      ) m on m.item_id = i.id
     where coalesce(i.current_stock, 0) <> coalesce(m.ledger_balance, 0)
  )
  select jsonb_build_object(
    'checked_items', (select count(*) from public.items),
    'mismatched_items', (select count(*) from diffs),
    'is_consistent', (select count(*) from diffs) = 0
  );
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
       and p.proname in (
         'snapshot_business_data', 'list_data_snapshots',
         'restore_business_data', 'verify_stock_integrity'
       )
  loop
    execute format('revoke all on function %s from public, anon', r.signature);
    execute format('grant execute on function %s to authenticated', r.signature);
  end loop;
end;
$grants$;

-- انتهى: نسخ احتياطي داخلي + استرجاع طارئ + فحص سلامة الأرصدة. لا تعديل لبيانات قائمة.

