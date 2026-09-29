-- ============================================================================
-- 20260912120000_stock_ledger_atomic_operations.sql
--
-- الغرض:
--   1) دفتر حركات مخزون (stock_movements) يكون المصدر الوحيد لحساب الأرصدة.
--   2) تسلسل أرقام المستندات (document_sequences) بدل الأرقام العشوائية.
--   3) دوال RPC ذرية (atomic) لكل عمليات الطلب والاستلام والتعديل —
--      تنفيذ كامل داخل معاملة واحدة، فلا تبقى بيانات نصف مكتوبة عند الفشل.
--   4) تصحيح معنى الرصيد: "الرصيد المتاح" يزيد عند الاستلام فقط،
--      ولا يتغير عند إنشاء طلب الشراء (الطلب يزيد "مخزون الطلبات" فقط).
--
-- ملاحظة تشغيلية: هذا الملف آمن لإعادة التنفيذ (idempotent) قدر الإمكان.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1) تسلسل أرقام المستندات
-- ----------------------------------------------------------------------------
create table if not exists public.document_sequences (
  prefix text not null,
  period text not null,
  last_value integer not null default 0,
  updated_date timestamptz not null default now(),
  primary key (prefix, period)
);

-- ترقيم ذري: يمنع تكرار أرقام المستندات نهائيًا (PO-202609-0001 ...).
create or replace function public.next_document_number(
  p_prefix text,
  p_period text default to_char(now(), 'YYYYMM')
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_next integer;
begin
  insert into public.document_sequences (prefix, period, last_value)
  values (p_prefix, p_period, 1)
  on conflict (prefix, period) do update
    set last_value = public.document_sequences.last_value + 1,
        updated_date = now()
  returning last_value into v_next;

  return p_prefix || '-' || p_period || '-' || lpad(v_next::text, 4, '0');
end;
$fn$;

-- ----------------------------------------------------------------------------
-- 2) دفتر حركات المخزون
-- ----------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  movement_type text not null check (movement_type in (
    'opening_balance',
    'receipt',
    'receipt_excess',
    'adjustment',
    'return_to_supplier',
    'issue',
    'reversal'
  )),
  quantity numeric(14, 3) not null check (quantity <> 0),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  ref_type text,
  ref_id uuid,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now()
);

create index if not exists stock_movements_item_id_idx on public.stock_movements(item_id);
create index if not exists stock_movements_ref_idx on public.stock_movements(ref_type, ref_id);
create index if not exists stock_movements_created_date_idx on public.stock_movements(created_date desc);

-- إعادة حساب متوسط التكلفة المرجّح من الحركات الموجبة فقط.
create or replace function public.recalculate_item_average_cost(p_item_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_avg numeric;
begin
  select coalesce(sum(quantity * unit_cost) / nullif(sum(quantity), 0), 0)
    into v_avg
    from public.stock_movements
   where item_id = p_item_id
     and quantity > 0
     and unit_cost > 0;

  v_avg := coalesce(v_avg, 0);

  update public.items
     set average_cost = v_avg,
         updated_date = now()
   where id = p_item_id
     and coalesce(average_cost, 0) is distinct from v_avg;

  return v_avg;
end;
$fn$;

-- كل حركة تُسجَّل في الدفتر تُحدِّث رصيد الصنف المتاح تلقائيًا.
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'INSERT' then
    update public.items
       set current_stock = coalesce(current_stock, 0) + new.quantity,
           updated_date = now()
     where id = new.item_id;

    if new.quantity > 0 and new.unit_cost > 0 then
      perform public.recalculate_item_average_cost(new.item_id);
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    update public.items
       set current_stock = coalesce(current_stock, 0) - old.quantity,
           updated_date = now()
     where id = old.item_id;

    perform public.recalculate_item_average_cost(old.item_id);
    return old;

  else
    update public.items
       set current_stock = coalesce(current_stock, 0) - old.quantity,
           updated_date = now()
     where id = old.item_id;

    update public.items
       set current_stock = coalesce(current_stock, 0) + new.quantity,
           updated_date = now()
     where id = new.item_id;

    perform public.recalculate_item_average_cost(old.item_id);
    if new.item_id is distinct from old.item_id then
      perform public.recalculate_item_average_cost(new.item_id);
    end if;
    return new;
  end if;
end;
$fn$;

drop trigger if exists apply_stock_movement_trigger on public.stock_movements;
create trigger apply_stock_movement_trigger
after insert or update or delete on public.stock_movements
for each row execute function public.apply_stock_movement();

-- ----------------------------------------------------------------------------
-- 3) ترحيل الأرصدة إلى المعنى الصحيح
--    الرصيد المتاح = إجمالي الكميات المستلمة فعليًا (لا يتأثر بإنشاء الطلبات).
--    يُسجَّل الترحيل كحركة موثّقة في الدفتر للتدقيق الكامل.
-- ----------------------------------------------------------------------------
alter table public.goods_receipts add column if not exists voided_at timestamptz;
alter table public.goods_receipts add column if not exists voided_by text;
alter table public.goods_receipts add column if not exists void_reason text;

do $mig$
declare
  v_already_migrated boolean;
begin
  select exists(
    select 1 from public.stock_movements where movement_type = 'opening_balance'
  ) into v_already_migrated;

  if v_already_migrated then
    raise notice 'تم ترحيل الأرصدة مسبقًا — تم تجاوز خطوة الترحيل.';
    return;
  end if;

  -- تصفير الأرصدة ثم بناؤها من الحركات الفعلية.
  update public.items set current_stock = 0;

  insert into public.stock_movements (item_id, movement_type, quantity, unit_cost, ref_type, note)
  select i.id,
         'opening_balance',
         t.received_total,
         0,
         'migration',
         'رصيد افتتاحي بعد ترحيل دفتر الحركات (إجمالي الكميات المستلمة فعليًا)'
    from public.items i
    join lateral (
      select coalesce(sum(gri.quantity_received), 0) as received_total
        from public.goods_receipt_items gri
       where gri.item_id = i.id
    ) t on true
   where t.received_total <> 0;

  -- إعادة بناء متوسط التكلفة من بنود الاستلام الفعلية.
  update public.items i
     set average_cost = coalesce((
           select sum(gri.quantity_received * gri.unit_cost) / nullif(sum(gri.quantity_received), 0)
             from public.goods_receipt_items gri
            where gri.item_id = i.id
              and gri.unit_cost > 0
         ), 0),
         updated_date = now();
end;
$mig$;

-- إعادة حساب "مخزون الطلبات" = الكميات المطلوبة وغير المستلمة في الطلبات المفتوحة.
create or replace function public.recalculate_pending_stock()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  update public.items i
     set pending_stock = coalesce((
           select sum(greatest(coalesce(poi.quantity_ordered, 0) - coalesce(poi.quantity_received, 0), 0))
             from public.purchase_order_items poi
             join public.purchase_orders po on po.id = poi.order_id
            where poi.item_id = i.id
              and po.status in ('pending', 'partial')
         ), 0),
         updated_date = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

select public.recalculate_pending_stock();

-- إعادة حساب حالة الطلب من بنوده (مصدر واحد للحقيقة).
create or replace function public.recalculate_purchase_order_status(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_current text;
  v_total_ordered numeric;
  v_total_received numeric;
  v_all_complete boolean;
  v_status text;
begin
  select status into v_current from public.purchase_orders where id = p_order_id;
  if v_current is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;
  if v_current = 'cancelled' then
    return v_current;
  end if;

  select coalesce(sum(quantity_ordered), 0),
         coalesce(sum(quantity_received), 0),
         coalesce(bool_and(quantity_received >= quantity_ordered), false)
    into v_total_ordered, v_total_received, v_all_complete
    from public.purchase_order_items
   where order_id = p_order_id;

  if v_total_ordered = 0 then
    v_status := 'pending';
  elsif v_all_complete then
    v_status := 'completed';
  elsif v_total_received > 0 then
    v_status := 'partial';
  else
    v_status := 'pending';
  end if;

  update public.purchase_orders
     set status = v_status, updated_date = now()
   where id = p_order_id;

  return v_status;
end;
$fn$;

-- إعادة حساب حالة كل الطلبات (تُستخدم للصيانة والإصلاح).
create or replace function public.recalculate_all_order_statuses()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  r record;
  v_count integer := 0;
begin
  for r in select id from public.purchase_orders where status <> 'cancelled' loop
    perform public.recalculate_purchase_order_status(r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$fn$;

select public.recalculate_all_order_statuses();

-- ----------------------------------------------------------------------------
-- 4) دوال العمليات الذرية
--    كل دالة تنفّذ العملية كاملة داخل معاملة واحدة. أي خطأ يُلغي كل شيء.
--    رموز الأخطاء (مثل ORDER_REQUIRES_ITEMS) تُترجم إلى رسائل عربية في الواجهة.
-- ----------------------------------------------------------------------------

create or replace function public.assert_authenticated()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  return v_uid;
end;
$fn$;

-- دالة تحقق يستخدمها العميل لمعرفة أن هذا الترحيل مُطبَّق فعلًا.
create or replace function public.stock_api_version()
returns integer
language sql
stable
as $fn$
  select 1;
$fn$;

-- إنشاء طلب شراء مع بنوده (ذرّي). لا يغيّر الرصيد المتاح، يزيد مخزون الطلبات فقط.
create or replace function public.create_purchase_order(p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid;
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_item_id uuid;
  v_qty numeric;
  v_cost numeric;
  v_total numeric := 0;
begin
  v_uid := public.assert_authenticated();

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_REQUIRES_ITEMS' using errcode = '22023';
  end if;

  v_order_number := coalesce(
    nullif(trim(p_order->>'order_number'), ''),
    public.next_document_number('PO', to_char(coalesce(nullif(p_order->>'order_date', '')::date, current_date), 'YYYYMM'))
  );

  insert into public.purchase_orders (order_number, order_date, supplier_name, status, total_amount, notes, created_by)
  values (
    v_order_number,
    coalesce(nullif(p_order->>'order_date', '')::date, current_date),
    coalesce(nullif(trim(p_order->>'supplier_name'), ''), 'غير محدد'),
    'pending',
    0,
    nullif(trim(coalesce(p_order->>'notes', '')), ''),
    v_uid
  )
  returning id into v_order_id;

  -- تجميع الأصناف المكررة وجمع كمياتها.
  for v_item in
    select jsonb_build_object(
             'item_id', item_id,
             'quantity_ordered', sum(qty),
             'unit_cost', (array_agg(cost order by cost desc))[1],
             'item_number', (array_agg(num))[1],
             'item_name', (array_agg(nm))[1]
           )
      from (
        select (e->>'item_id')::uuid as item_id,
               (e->>'quantity_ordered')::numeric as qty,
               coalesce((e->>'unit_cost')::numeric, 0) as cost,
               e->>'item_number' as num,
               e->>'item_name' as nm
          from jsonb_array_elements(p_items) e
      ) src
     group by item_id
  loop
    v_item_id := (v_item->>'item_id')::uuid;
    v_qty := (v_item->>'quantity_ordered')::numeric;
    v_cost := coalesce((v_item->>'unit_cost')::numeric, 0);

    if v_qty is null or v_qty <= 0 then
      raise exception 'INVALID_QUANTITY' using errcode = '22023';
    end if;

    perform 1 from public.items where id = v_item_id for update;
    if not found then
      raise exception 'ITEM_NOT_FOUND' using errcode = '23503';
    end if;

    insert into public.purchase_order_items (
      order_id, item_id, item_number, item_name,
      quantity_ordered, quantity_received, unit_cost, total_cost, created_by
    ) values (
      v_order_id, v_item_id, v_item->>'item_number', v_item->>'item_name',
      v_qty, 0, v_cost, v_qty * v_cost, v_uid
    );

    v_total := v_total + (v_qty * v_cost);

    update public.items
       set pending_stock = coalesce(pending_stock, 0) + v_qty,
           updated_date = now()
     where id = v_item_id;
  end loop;

  update public.purchase_orders
     set total_amount = v_total,
         updated_date = now()
   where id = v_order_id;

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_amount', v_total);
end;
$fn$;

-- تحديث طلب شراء: تحديث/إضافة/حذف البنود مع ضبط مخزون الطلبات وحالة الطلب.
create or replace function public.update_purchase_order(p_order_id uuid, p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid;
  v_item jsonb;
  v_keep uuid[] := '{}';
  v_existing record;
  v_qty numeric;
  v_cost numeric;
  v_total numeric := 0;
  v_status text;
  v_new_item_id uuid;
begin
  v_uid := public.assert_authenticated();

  select status into v_status from public.purchase_orders where id = p_order_id for update;
  if v_status is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;
  if v_status = 'cancelled' then
    raise exception 'ORDER_CANCELLED' using errcode = '22023';
  end if;

  update public.purchase_orders
     set order_number = coalesce(nullif(trim(p_order->>'order_number'), ''), order_number),
         order_date = coalesce(nullif(p_order->>'order_date', '')::date, order_date),
         supplier_name = coalesce(nullif(trim(p_order->>'supplier_name'), ''), supplier_name),
         notes = nullif(trim(coalesce(p_order->>'notes', '')), ''),
         updated_date = now()
   where id = p_order_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_qty := (v_item->>'quantity_ordered')::numeric;
    v_cost := coalesce((v_item->>'unit_cost')::numeric, 0);

    if v_qty is null or v_qty <= 0 then
      raise exception 'INVALID_QUANTITY' using errcode = '22023';
    end if;

    if nullif(v_item->>'id', '') is not null then
      select * into v_existing
        from public.purchase_order_items
       where id = (v_item->>'id')::uuid
         and order_id = p_order_id
         for update;

      if not found then
        raise exception 'ORDER_ITEM_NOT_FOUND' using errcode = '23503';
      end if;

      if v_qty < coalesce(v_existing.quantity_received, 0) then
        raise exception 'QUANTITY_BELOW_RECEIVED' using errcode = '22023';
      end if;

      update public.purchase_order_items
         set item_id = coalesce(nullif(v_item->>'item_id', '')::uuid, item_id),
             item_number = coalesce(v_item->>'item_number', item_number),
             item_name = coalesce(v_item->>'item_name', item_name),
             quantity_ordered = v_qty,
             unit_cost = v_cost,
             total_cost = v_qty * v_cost,
             updated_date = now()
       where id = v_existing.id;

      update public.items
         set pending_stock = greatest(coalesce(pending_stock, 0) + (v_qty - v_existing.quantity_ordered), 0),
             updated_date = now()
       where id = v_existing.item_id;

      v_keep := v_keep || v_existing.id;
    else
      if nullif(v_item->>'item_id', '') is null then
        raise exception 'ITEM_REQUIRED' using errcode = '22023';
      end if;

      insert into public.purchase_order_items (
        order_id, item_id, item_number, item_name,
        quantity_ordered, quantity_received, unit_cost, total_cost, created_by
      ) values (
        p_order_id, (v_item->>'item_id')::uuid, v_item->>'item_number', v_item->>'item_name',
        v_qty, 0, v_cost, v_qty * v_cost, v_uid
      )
      returning id into v_new_item_id;

      update public.items
         set pending_stock = coalesce(pending_stock, 0) + v_qty,
             updated_date = now()
       where id = (v_item->>'item_id')::uuid;

      v_keep := v_keep || v_new_item_id;
    end if;
  end loop;

  -- حذف البنود المستبعدة (يُرفض إن استُلم جزء منها للحفاظ على سلامة المستندات).
  for v_existing in
    select * from public.purchase_order_items
     where order_id = p_order_id
       and not (id = any (v_keep))
       for update
  loop
    if coalesce(v_existing.quantity_received, 0) > 0 then
      raise exception 'CANNOT_DELETE_RECEIVED_ITEM' using errcode = '22023';
    end if;

    delete from public.purchase_order_items where id = v_existing.id;

    update public.items
       set pending_stock = greatest(coalesce(pending_stock, 0) - v_existing.quantity_ordered, 0),
           updated_date = now()
     where id = v_existing.item_id;
  end loop;

  select coalesce(sum(total_cost), 0) into v_total
    from public.purchase_order_items where order_id = p_order_id;

  update public.purchase_orders
     set total_amount = v_total, updated_date = now()
   where id = p_order_id;

  v_status := public.recalculate_purchase_order_status(p_order_id);

  return jsonb_build_object('id', p_order_id, 'status', v_status, 'total_amount', v_total);
end;
$fn$;

-- تسجيل إذن استلام مع بنوده (ذرّي).
-- الرصيد المتاح يزيد بالمستلم، ومخزون الطلبات ينقص بالمقدار المطلوب فقط،
-- والكمية الزائدة تُسجَّل كحركة منفصلة لتبقى قابلة للتدقيق.
create or replace function public.receive_goods(p_receipt jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid;
  v_order_id uuid;
  v_receipt_id uuid;
  v_receipt_number text;
  v_order_number text;
  v_item jsonb;
  v_order_item record;
  v_item_uid uuid;
  v_qty numeric;
  v_normal numeric;
  v_excess numeric;
  v_total numeric := 0;
  v_any_receipt boolean := false;
begin
  v_uid := public.assert_authenticated();

  v_order_id := nullif(p_receipt->>'order_id', '')::uuid;
  if v_order_id is null then
    raise exception 'ORDER_REQUIRED' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'RECEIPT_REQUIRES_ITEMS' using errcode = '22023';
  end if;

  select order_number into v_order_number from public.purchase_orders where id = v_order_id;
  if v_order_number is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;

  v_receipt_number := coalesce(
    nullif(trim(p_receipt->>'receipt_number'), ''),
    public.next_document_number(
      'GR',
      to_char(coalesce(nullif(p_receipt->>'receipt_date', '')::timestamptz, now()), 'YYYYMM')
    )
  );

  insert into public.goods_receipts (
    receipt_number, order_id, order_number, receipt_date,
    total_amount, notes, last_modified_by, last_modified_at, created_by
  ) values (
    v_receipt_number, v_order_id, v_order_number,
    coalesce(nullif(p_receipt->>'receipt_date', '')::timestamptz, now()),
    0,
    nullif(trim(coalesce(p_receipt->>'notes', '')), ''),
    nullif(trim(coalesce(p_receipt->>'last_modified_by', '')), ''),
    now(),
    v_uid
  )
  returning id into v_receipt_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce(nullif(v_item->>'quantity_received', '')::numeric, 0);
    if v_qty <= 0 then
      continue;
    end if;

    select * into v_order_item
      from public.purchase_order_items
     where id = nullif(v_item->>'order_item_id', '')::uuid
       for update;

    if not found then
      raise exception 'ORDER_ITEM_NOT_FOUND' using errcode = '23503';
    end if;

    v_item_uid := v_order_item.item_id;

    insert into public.goods_receipt_items (
      receipt_id, order_item_id, item_id, item_number, item_name,
      quantity_received, unit_cost, total_cost, created_by
    ) values (
      v_receipt_id, v_order_item.id, v_item_uid, v_order_item.item_number, v_order_item.item_name,
      v_qty, coalesce(v_order_item.unit_cost, 0), v_qty * coalesce(v_order_item.unit_cost, 0), v_uid
    );

    update public.purchase_order_items
       set quantity_received = coalesce(quantity_received, 0) + v_qty,
           updated_date = now()
     where id = v_order_item.id;

    v_normal := least(v_qty, greatest(v_order_item.quantity_ordered - coalesce(v_order_item.quantity_received, 0), 0));
    v_excess := v_qty - v_normal;

    perform 1 from public.items where id = v_item_uid for update;

    if v_normal > 0 then
      insert into public.stock_movements (
        item_id, movement_type, quantity, unit_cost, ref_type, ref_id, created_by, note
      ) values (
        v_item_uid, 'receipt', v_normal, coalesce(v_order_item.unit_cost, 0),
        'goods_receipt', v_receipt_id, v_uid, null
      );
    end if;

    if v_excess > 0 then
      insert into public.stock_movements (
        item_id, movement_type, quantity, unit_cost, ref_type, ref_id, created_by, note
      ) values (
        v_item_uid, 'receipt_excess', v_excess, coalesce(v_order_item.unit_cost, 0),
        'goods_receipt', v_receipt_id, v_uid, 'كمية زائدة عن الكمية المطلوبة'
      );
    end if;

    update public.items
       set pending_stock = greatest(coalesce(pending_stock, 0) - v_normal, 0),
           updated_date = now()
     where id = v_item_uid;

    v_total := v_total + (v_qty * coalesce(v_order_item.unit_cost, 0));
    v_any_receipt := true;
  end loop;

  if not v_any_receipt then
    raise exception 'RECEIPT_REQUIRES_ITEMS' using errcode = '22023';
  end if;

  update public.goods_receipts
     set total_amount = v_total,
         updated_date = now()
   where id = v_receipt_id;

  perform public.recalculate_purchase_order_status(v_order_id);

  return jsonb_build_object(
    'id', v_receipt_id,
    'receipt_number', v_receipt_number,
    'total_amount', v_total
  );
end;
$fn$;

-- تعديل إذن استلام: تعديل الكميات وإضافة/حذف بنود مع تصحيح الحركات والأرصدة.
create or replace function public.update_goods_receipt(p_receipt_id uuid, p_receipt jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid;
  v_receipt record;
  v_item jsonb;
  v_existing record;
  v_keep uuid[] := '{}';
  v_qty numeric;
  v_delta numeric;
  v_total numeric := 0;
begin
  v_uid := public.assert_authenticated();

  select * into v_receipt from public.goods_receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'RECEIPT_NOT_FOUND' using errcode = '23503';
  end if;
  if v_receipt.voided_at is not null then
    raise exception 'RECEIPT_ALREADY_VOIDED' using errcode = '22023';
  end if;

  update public.goods_receipts
     set receipt_date = coalesce(nullif(p_receipt->>'receipt_date', '')::timestamptz, receipt_date),
         notes = nullif(trim(coalesce(p_receipt->>'notes', '')), ''),
         last_modified_by = nullif(trim(coalesce(p_receipt->>'last_modified_by', '')), ''),
         last_modified_at = now(),
         updated_date = now()
   where id = p_receipt_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_qty := coalesce(nullif(v_item->>'quantity_received', '')::numeric, 0);
    if v_qty < 0 then
      raise exception 'INVALID_QUANTITY' using errcode = '22023';
    end if;

    if nullif(v_item->>'id', '') is null then
      continue;
    end if;

    select * into v_existing
      from public.goods_receipt_items
     where id = (v_item->>'id')::uuid
       and receipt_id = p_receipt_id
       for update;

    if not found then
      raise exception 'RECEIPT_ITEM_NOT_FOUND' using errcode = '23503';
    end if;

    v_delta := v_qty - coalesce(v_existing.quantity_received, 0);

    if v_delta <> 0 then
      update public.goods_receipt_items
         set quantity_received = v_qty,
             total_cost = v_qty * coalesce(unit_cost, 0),
             updated_date = now()
       where id = v_existing.id;

      insert into public.stock_movements (
        item_id, movement_type, quantity, unit_cost, ref_type, ref_id, created_by, note
      ) values (
        v_existing.item_id, 'adjustment', v_delta, coalesce(v_existing.unit_cost, 0),
        'goods_receipt', p_receipt_id, v_uid, 'تعديل كميات إذن الاستلام'
      );

      update public.purchase_order_items
         set quantity_received = greatest(coalesce(quantity_received, 0) + v_delta, 0),
             updated_date = now()
       where id = v_existing.order_item_id;
    end if;

    v_keep := v_keep || v_existing.id;
  end loop;

  -- حذف البنود المستبعدة مع عكس أثرها على المخزون والطلب.
  for v_existing in
    select * from public.goods_receipt_items
     where receipt_id = p_receipt_id
       and not (id = any (v_keep))
       for update
  loop
    insert into public.stock_movements (
      item_id, movement_type, quantity, unit_cost, ref_type, ref_id, created_by, note
    ) values (
      v_existing.item_id, 'reversal', (-1) * v_existing.quantity_received, coalesce(v_existing.unit_cost, 0),
      'goods_receipt', p_receipt_id, v_uid, 'حذف بند من إذن الاستلام'
    );

    update public.purchase_order_items
       set quantity_received = greatest(coalesce(quantity_received, 0) - v_existing.quantity_received, 0),
           updated_date = now()
     where id = v_existing.order_item_id;

    delete from public.goods_receipt_items where id = v_existing.id;
  end loop;

  select coalesce(sum(total_cost), 0) into v_total
    from public.goods_receipt_items where receipt_id = p_receipt_id;

  update public.goods_receipts
     set total_amount = v_total, updated_date = now()
   where id = p_receipt_id;

  perform public.recalculate_pending_stock();
  perform public.recalculate_purchase_order_status(v_receipt.order_id);

  return jsonb_build_object('id', p_receipt_id, 'total_amount', v_total);
end;
$fn$;

-- إلغاء إذن استلام (بدل الحذف) مع عكس أثره على المخزون، ويبقى المستند للأرشيف.
create or replace function public.void_goods_receipt(p_receipt_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid;
  v_receipt record;
  v_item record;
begin
  v_uid := public.assert_authenticated();

  select * into v_receipt from public.goods_receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'RECEIPT_NOT_FOUND' using errcode = '23503';
  end if;
  if v_receipt.voided_at is not null then
    raise exception 'RECEIPT_ALREADY_VOIDED' using errcode = '22023';
  end if;

  for v_item in select * from public.goods_receipt_items where receipt_id = p_receipt_id loop
    insert into public.stock_movements (
      item_id, movement_type, quantity, unit_cost, ref_type, ref_id, created_by, note
    ) values (
      v_item.item_id, 'reversal', (-1) * v_item.quantity_received, coalesce(v_item.unit_cost, 0),
      'goods_receipt', p_receipt_id, v_uid,
      coalesce('إلغاء إذن الاستلام: ' || nullif(trim(p_reason), ''), 'إلغاء إذن الاستلام')
    );

    update public.purchase_order_items
       set quantity_received = greatest(coalesce(quantity_received, 0) - v_item.quantity_received, 0),
           updated_date = now()
     where id = v_item.order_item_id;
  end loop;

  update public.goods_receipts
     set voided_at = now(),
         voided_by = coalesce(nullif(trim(v_receipt.last_modified_by), ''), v_uid::text),
         void_reason = nullif(trim(p_reason), ''),
         updated_date = now()
   where id = p_receipt_id;

  perform public.recalculate_pending_stock();
  perform public.recalculate_purchase_order_status(v_receipt.order_id);

  return jsonb_build_object('id', p_receipt_id, 'voided', true);
end;
$fn$;

-- إلغاء طلب شراء: يُسجَّل الحالة ويُفرَّغ مخزون الطلبات، والمستند يبقى للأرشيف.
create or replace function public.cancel_purchase_order(p_order_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_item record;
  v_status text;
begin
  perform public.assert_authenticated();

  select status into v_status from public.purchase_orders where id = p_order_id for update;
  if v_status is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;
  if v_status = 'cancelled' then
    raise exception 'ORDER_ALREADY_CANCELLED' using errcode = '22023';
  end if;

  for v_item in
    select * from public.purchase_order_items where order_id = p_order_id for update
  loop
    update public.items
       set pending_stock = greatest(
             coalesce(pending_stock, 0)
             - greatest(coalesce(v_item.quantity_ordered, 0) - coalesce(v_item.quantity_received, 0), 0),
             0
           ),
           updated_date = now()
     where id = v_item.item_id;
  end loop;

  update public.purchase_orders
     set status = 'cancelled',
         notes = case
                   when nullif(trim(coalesce(p_reason, '')), '') is null then notes
                   else coalesce(notes || ' | ', '') || 'سبب الإلغاء: ' || trim(p_reason)
                 end,
         updated_date = now()
   where id = p_order_id;

  return jsonb_build_object('id', p_order_id, 'status', 'cancelled');
end;
$fn$;

-- حذف طلب شراء لم يُستلم منه شيء (حذف فعلي مع تنظيف مخزون الطلبات).
create or replace function public.delete_purchase_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_item record;
  v_receipts integer;
begin
  perform public.assert_authenticated();

  if not exists (select 1 from public.purchase_orders where id = p_order_id) then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;

  select count(*) into v_receipts from public.goods_receipts where order_id = p_order_id;
  if v_receipts > 0 then
    raise exception 'ORDER_HAS_RECEIPTS' using errcode = '23503';
  end if;

  for v_item in select * from public.purchase_order_items where order_id = p_order_id for update loop
    update public.items
       set pending_stock = greatest(coalesce(pending_stock, 0) - coalesce(v_item.quantity_ordered, 0), 0),
           updated_date = now()
     where id = v_item.item_id;
  end loop;

  delete from public.purchase_order_items where order_id = p_order_id;
  delete from public.purchase_orders where id = p_order_id;

  return jsonb_build_object('id', p_order_id, 'deleted', true);
end;
$fn$;

-- تسوية رصيد صنف يدويًا (جرد / تصحيح) مع تسجيل الفرق كحركة موثّقة.
create or replace function public.adjust_item_stock(p_item_id uuid, p_new_quantity numeric, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid;
  v_current numeric;
  v_delta numeric;
begin
  v_uid := public.assert_authenticated();

  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;

  select coalesce(current_stock, 0) into v_current from public.items where id = p_item_id for update;
  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = '23503';
  end if;

  v_delta := p_new_quantity - v_current;

  if v_delta = 0 then
    return jsonb_build_object('item_id', p_item_id, 'delta', 0, 'current_stock', v_current);
  end if;

  insert into public.stock_movements (
    item_id, movement_type, quantity, unit_cost, ref_type, ref_id, created_by, note
  ) values (
    p_item_id, 'adjustment', v_delta, 0, 'manual', null, v_uid,
    coalesce(nullif(trim(p_note), ''), 'تسوية رصيد يدوية')
  );

  return jsonb_build_object('item_id', p_item_id, 'delta', v_delta, 'current_stock', p_new_quantity);
end;
$fn$;

-- ----------------------------------------------------------------------------
-- 5) عروض مساعدة للتجميع على الخادم (تُقلّل نقل البيانات إلى المتصفح)
--    security_invoker = true حتى تُطبَّق سياسات RLS الخاصة بالمستخدم المُنفِّذ.
-- ----------------------------------------------------------------------------

create or replace view public.v_inventory
with (security_invoker = true)
as
select
  i.id,
  i.item_number,
  i.item_name,
  i.brand,
  i.cost,
  coalesce(i.current_stock, 0) as available_stock,
  coalesce(i.pending_stock, 0) as on_order_stock,
  coalesce(i.average_cost, 0) as average_cost,
  round(coalesce(i.current_stock, 0) * coalesce(i.average_cost, 0), 2) as stock_value,
  case
    when coalesce(i.current_stock, 0) < 0 then 'negative'
    when coalesce(i.current_stock, 0) = 0 then 'out'
    when coalesce(i.current_stock, 0) < 5 then 'low'
    else 'ok'
  end as stock_status,
  (select max(m.created_date) from public.stock_movements m where m.item_id = i.id) as last_movement_at,
  i.created_date,
  i.updated_date
from public.items i;

create or replace view public.v_order_fulfillment
with (security_invoker = true)
as
select
  o.id,
  o.order_number,
  o.order_date,
  o.supplier_name,
  o.status,
  o.total_amount,
  o.notes,
  coalesce(count(oi.id), 0) as items_count,
  coalesce(sum(oi.quantity_ordered), 0) as ordered_quantity,
  coalesce(sum(oi.quantity_received), 0) as received_quantity,
  coalesce(sum(greatest(oi.quantity_ordered - oi.quantity_received, 0)), 0) as remaining_quantity,
  coalesce(sum(oi.total_cost), 0) as ordered_value,
  case
    when coalesce(sum(oi.quantity_ordered), 0) = 0 then 0
    else round(
      least(100, coalesce(sum(oi.quantity_received), 0) * 100.0 / sum(oi.quantity_ordered)),
      1
    )
  end as progress_percent,
  o.created_date,
  o.updated_date
from public.purchase_orders o
left join public.purchase_order_items oi on oi.order_id = o.id
group by o.id;

create or replace view public.v_supplier_discrepancies
with (security_invoker = true)
as
select
  oi.order_id,
  o.order_number,
  o.supplier_name,
  o.status as order_status,
  oi.id as order_item_id,
  oi.item_id,
  oi.item_number,
  oi.item_name,
  oi.quantity_ordered,
  coalesce(oi.quantity_received, 0) as quantity_received,
  coalesce(oi.quantity_received, 0) - oi.quantity_ordered as quantity_difference,
  coalesce(oi.unit_cost, 0) as unit_cost,
  round((coalesce(oi.quantity_received, 0) - oi.quantity_ordered) * coalesce(oi.unit_cost, 0), 2) as value_difference,
  case
    when coalesce(oi.quantity_received, 0) > oi.quantity_ordered then 'excess'
    when coalesce(oi.quantity_received, 0) < oi.quantity_ordered then 'shortage'
    else 'complete'
  end as discrepancy_status
from public.purchase_order_items oi
join public.purchase_orders o on o.id = oi.order_id;

-- ----------------------------------------------------------------------------
-- 6) الأمان: التنفيذ للمستخدمين المُسجَّلين فقط + منع الكتابة المباشرة في الدفتر
-- ----------------------------------------------------------------------------
alter table public.stock_movements enable row level security;
alter table public.document_sequences enable row level security;

drop policy if exists "authenticated can read stock movements" on public.stock_movements;
create policy "authenticated can read stock movements"
on public.stock_movements for select to authenticated using (true);

revoke all on public.stock_movements from anon;
revoke insert, update, delete on public.stock_movements from authenticated;
revoke all on public.document_sequences from anon, authenticated;

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
         'next_document_number', 'stock_api_version', 'create_purchase_order',
         'update_purchase_order', 'receive_goods', 'update_goods_receipt',
         'void_goods_receipt', 'cancel_purchase_order', 'delete_purchase_order',
         'adjust_item_stock', 'recalculate_pending_stock',
         'recalculate_purchase_order_status', 'recalculate_all_order_statuses'
       )
  loop
    execute format('revoke all on function %s from public, anon', r.signature);
    execute format('grant execute on function %s to authenticated', r.signature);
  end loop;
end;
$grants$;

grant select on public.v_inventory to authenticated;
grant select on public.v_order_fulfillment to authenticated;
grant select on public.v_supplier_discrepancies to authenticated;

-- انتهى الترحيل: دفتر حركات + ترقيم مستندات + عمليات ذرية + عروض تجميع.







