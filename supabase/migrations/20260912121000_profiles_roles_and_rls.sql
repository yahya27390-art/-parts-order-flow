-- ============================================================================
-- 20260912121000_profiles_roles_and_rls.sql
--
-- الغرض:
--   1) جدول profiles: مصدر الدور والصلاحيات (بدل user_metadata القابل للتعديل
--      من المستخدم نفسه، والذي كان يمنح دور "admin" افتراضيًا للجميع).
--   2) دوال مساعدة is_admin() / can_manage_stock() / is_active_user().
--   3) استبدال سياسات RLS المفتوحة (using (true)) بسياسات مبنية على الأدوار.
--   4) تشديد سياسات تخزين الملفات على مجلد الشعارات فقط.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) جدول المستخدمين والأدوار
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'storekeeper', 'viewer')),
  is_active boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- إنشاء سجل المستخدم تلقائيًا عند التسجيل. أول مستخدم يصبح مديرًا.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_is_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_is_first;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when v_is_first then 'admin' else 'viewer' end,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ترحيل المستخدمين الحاليين: الجميع يصبح مديرًا لتفادي فقدان الوصول،
-- ثم تُضبط الأدوار يدويًا من صفحة الإعدادات حسب الحاجة.
insert into public.profiles (id, email, full_name, role, is_active)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data->>'full_name', split_part(coalesce(u.email, ''), '@', 1)),
       'admin',
       true
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

-- ----------------------------------------------------------------------------
-- 2) دوال الصلاحيات
-- ----------------------------------------------------------------------------
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active;
$fn$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$fn$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(public.current_profile_role() = 'admin', false);
$fn$;

-- من يملك حق تعديل بيانات المشتريات والمخزون (مدير أو أمين مستودع).
create or replace function public.can_manage_stock()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(public.current_profile_role() in ('admin', 'storekeeper'), false);
$fn$;

-- سياسات جدول المستخدمين: كل مستخدم يرى سجله، والمدير يرى ويعدّل الجميع.
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = public.current_profile_role());

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
on public.profiles for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- لا يُسمح للمستخدمين بإنشاء سجلات في جدول المستخدمين (يتم ذلك تلقائيًا عند التسجيل)
revoke insert on public.profiles from authenticated;

-- ----------------------------------------------------------------------------
-- 3) فرض الأدوار على الكتابة في جداول المشتريات والمخزون
--    يعمل هذا الفرض حتى داخل دوال الـ RPC (لأن الـ RPC لا يمرّ على RLS)،
--    فلا يستطيع مستخدم "قارئ" تنفيذ أي عملية كتابة من أي مسار.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_stock_write_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  -- auth.uid() فارغ في سياق المالك/الخدمة (الترحيلات والصيانة) فلا نمنعها.
  if auth.uid() is not null and not public.can_manage_stock() then
    raise exception 'INSUFFICIENT_ROLE' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$fn$;

do $trg$
declare
  t text;
begin
  foreach t in array array[
    'items', 'purchase_orders', 'purchase_order_items',
    'goods_receipts', 'goods_receipt_items', 'stock_movements'
  ]
  loop
    execute format('drop trigger if exists enforce_stock_write_role_trigger on public.%I', t);
    execute format(
      'create trigger enforce_stock_write_role_trigger
         before insert or update or delete on public.%I
         for each row execute function public.enforce_stock_write_role()', t
    );
  end loop;
end;
$trg$;

-- ----------------------------------------------------------------------------
-- 4) استبدال سياسات RLS المفتوحة بسياسات مبنية على الأدوار
--    القراءة: متاح لأي مستخدم نشط. الكتابة: من خلال الدوال/الأدوار فقط.
-- ----------------------------------------------------------------------------
do $pol$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'items', 'purchase_orders', 'purchase_order_items',
    'goods_receipts', 'goods_receipt_items', 'system_settings'
  ]
  loop
    -- حذف السياسات القديمة المفتوحة
    for p in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy "active users can read" on public.%I
         for select to authenticated
         using (public.is_active_user())', t
    );
  end loop;
end;
$pol$;

-- إدارة البيانات الأساسية للمدير فقط (حذف/تعديل حساس يُمرَّر عبر الدوال الأمنية)
create policy "admins can delete items"
on public.items for delete to authenticated
using (public.is_admin() and public.is_active_user());

create policy "admins can delete purchase orders"
on public.purchase_orders for delete to authenticated
using (public.is_admin() and public.is_active_user());

create policy "admins can delete goods receipts"
on public.goods_receipts for delete to authenticated
using (public.is_admin() and public.is_active_user());

create policy "admins can write settings"
on public.system_settings for all to authenticated
using (public.is_admin() and public.is_active_user())
with check (public.is_admin() and public.is_active_user());

-- الأصناف تُدار مباشرة من الواجهة، لذا نحتاج سياسات كتابة لأمين المستودع والمدير
create policy "managers can insert items"
on public.items for insert to authenticated
with check (public.can_manage_stock() and public.is_active_user());

create policy "managers can update items"
on public.items for update to authenticated
using (public.can_manage_stock() and public.is_active_user())
with check (public.can_manage_stock() and public.is_active_user());

-- ----------------------------------------------------------------------------
-- 5) تشديد التحقق: يجب أن يكون المستخدم مسجَّلًا ونشطًا في جدول المستخدمين
--    (استبدال للتحقق المبدئي في الترحيل السابق، ويعمل حتى داخل دوال الـ RPC)
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

  if not public.is_active_user() then
    raise exception 'USER_NOT_ACTIVE' using errcode = '42501';
  end if;

  return v_uid;
end;
$fn$;

-- ----------------------------------------------------------------------------
-- 6) سياسات تخزين الملفات: مجلد الشعارات فقط، وبحدود حجم وأنواع آمنة
-- ----------------------------------------------------------------------------
drop policy if exists "authenticated users can upload app assets" on storage.objects;
drop policy if exists "authenticated users can update app assets" on storage.objects;
drop policy if exists "authenticated users can delete app assets" on storage.objects;

create policy "managers can upload logos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'app-assets'
  and (storage.foldername(name))[1] = 'logos'
  and public.can_manage_stock()
  and public.is_active_user()
);

create policy "managers can update logos"
on storage.objects for update to authenticated
using (
  bucket_id = 'app-assets'
  and (storage.foldername(name))[1] = 'logos'
  and public.can_manage_stock()
)
with check (
  bucket_id = 'app-assets'
  and (storage.foldername(name))[1] = 'logos'
  and public.can_manage_stock()
);

create policy "managers can delete logos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'app-assets'
  and (storage.foldername(name))[1] = 'logos'
  and public.can_manage_stock()
);

-- انتهى: أدوار حقيقية + سياسات RLS محكمة + تشديد التخزين.


