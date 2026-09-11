create extension if not exists pgcrypto;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  item_number text not null unique,
  item_name text not null,
  brand text not null default 'other' check (brand in ('hyundai', 'kia', 'other')),
  cost numeric(14, 2) not null default 0 check (cost >= 0),
  current_stock numeric(14, 3) not null default 0,
  pending_stock numeric(14, 3) not null default 0,
  average_cost numeric(14, 2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  order_date date not null,
  supplier_name text not null,
  status text not null default 'pending' check (status in ('pending', 'partial', 'completed', 'cancelled')),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  item_number text not null,
  item_name text not null,
  quantity_ordered numeric(14, 3) not null check (quantity_ordered > 0),
  quantity_received numeric(14, 3) not null default 0 check (quantity_received >= 0),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  total_cost numeric(14, 2) not null default 0 check (total_cost >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  order_id uuid not null references public.purchase_orders(id) on delete restrict,
  order_number text not null,
  receipt_date timestamptz not null default now(),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  notes text,
  last_modified_by text,
  last_modified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.goods_receipts(id) on delete cascade,
  order_item_id uuid not null references public.purchase_order_items(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  item_number text not null,
  item_name text not null,
  quantity_received numeric(14, 3) not null check (quantity_received > 0),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  total_cost numeric(14, 2) not null default 0 check (total_cost >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  system_name text not null default 'نظام إدارة المخزون',
  logo_url text,
  show_logo_interface boolean not null default true,
  show_logo_reports boolean not null default true,
  show_logo_print boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index purchase_order_items_order_id_idx on public.purchase_order_items(order_id);
create index goods_receipts_order_id_idx on public.goods_receipts(order_id);
create index goods_receipt_items_receipt_id_idx on public.goods_receipt_items(receipt_id);
create index goods_receipt_items_item_id_idx on public.goods_receipt_items(item_id);

alter table public.items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;
alter table public.system_settings enable row level security;

create policy "authenticated users can manage items" on public.items for all to authenticated using (true) with check (true);
create policy "authenticated users can manage purchase orders" on public.purchase_orders for all to authenticated using (true) with check (true);
create policy "authenticated users can manage purchase order items" on public.purchase_order_items for all to authenticated using (true) with check (true);
create policy "authenticated users can manage goods receipts" on public.goods_receipts for all to authenticated using (true) with check (true);
create policy "authenticated users can manage goods receipt items" on public.goods_receipt_items for all to authenticated using (true) with check (true);
create policy "authenticated users can manage system settings" on public.system_settings for all to authenticated using (true) with check (true);
