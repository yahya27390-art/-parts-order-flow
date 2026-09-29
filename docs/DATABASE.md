# قاعدة البيانات: الترحيلات والدوال والصيانة

## تطبيق الترحيلات (إلزامي بالترتيب)

الترتيب مضمون بأسماء الملفات الزمنية. طبّقها بأحد الطريقتين:

### الطريقة 1 — Supabase CLI (موصى بها)
```bash
supabase link --project-ref <project-ref>
supabase db push          # يطبّق كل الترحيلات غير المُطبَّقة بالترتيب
```

### الطريقة 2 — SQL Editor في لوحة Supabase
نفّذ محتوى كل ملف بالترتيب (ملفًا واحدًا في كل مرة):

1. `20260911170000_initial_schema.sql`
2. `20260911183000_create_app_assets_storage.sql`
3. `20260911184500_import_korea_data.sql`
4. `20260912120000_stock_ledger_atomic_operations.sql`
5. `20260912121000_profiles_roles_and_rls.sql`

> الترحيلان (4) و(5) متكرران الأمان (idempotent) إلى حد كبير: يمكن إعادة تنفيذهما بعد التعديل.
> الترحيل (4) يترحّل الأرصدة **مرة واحدة فقط** (يتحقق من وجود حركة `opening_balance`).

## ما الذي يغيّره الترحيل (4)

- جدول `document_sequences` + دالة `next_document_number(prefix, period)` لترقيم مستندات ذري
  (`PO-YYYYMM-0001` / `GR-YYYYMM-0001`).
- جدول `stock_movements` (دفتر الحركات) + مُشغِّل يحفظ تطابق `items.current_stock` + دالة متوسط التكلفة.
- **ترحيل الأرصدة**: يُصفَّر الرصيد ثم يُبنى من إجمالي الكميات المستلمة فعليًا، وتُسجَّل حركة `opening_balance`
  موثّقة، ويُعاد بناء `average_cost` من بنود الاستلام.
- إعادة حساب `pending_stock` و`status` لكل الطلبات.
- أعمدة `voided_at`, `voided_by`, `void_reason` على `goods_receipts`.
- عروض تجميع: `v_inventory`, `v_order_fulfillment`, `v_supplier_discrepancies`.
- الأمان: `stock_movements` للقراءة فقط (لا كتابة مباشرة)، والتنفيذ على الدوال للمُسجَّلين فقط.

## ما الذي يغيّره الترحيل (5)

- جدول `profiles` (id, email, full_name, role, is_active) ومُشغِّل ينشئ السجل تلقائيًا عند التسجيل،
  وأول مستخدم يصبح `admin`.
- ترحيل المستخدمين الحاليين بدور `admin` (لتفادي فقدان الوصول) — **راجع الأدوار بعد ذلك يدويًا**.
- دوال الصلاحيات: `current_profile_role()`, `is_active_user()`, `is_admin()`, `can_manage_stock()`.
- استبدال سياسات RLS المفتوحة (`using (true)`) بسياسات مبنية على الأدوار + مُشغِّل
  `enforce_stock_write_role` يمنع أي كتابة من مستخدم بلا صلاحية (حتى داخل دوال RPC).
- تشديد سياسات التخزين على مجلد `logos/` فقط.

## دوال RPC المتاحة للتطبيق

| الدالة | الوسائط | الوظيفة |
|---|---|---|
| `next_document_number` | `(prefix, period)` | رقم مستند ذري |
| `stock_api_version` | — | فحص توفّر الترحيل (تستخدمه الواجهة) |
| `create_purchase_order` | `(p_order jsonb, p_items jsonb)` | إنشاء طلب كامل في معاملة واحدة |
| `update_purchase_order` | `(order_id, p_order, p_items)` | تعديل الطلب والبنود |
| `cancel_purchase_order` | `(order_id, reason)` | إلغاء الطلب وإفراغ مخزون الطلبات |
| `delete_purchase_order` | `(order_id)` | حذف طلب بلا إذونات |
| `receive_goods` | `(p_receipt jsonb, p_items jsonb)` | تسجيل إذن استلام وتحديث الأرصدة |
| `update_goods_receipt` | `(receipt_id, p_receipt, p_items)` | تعديل الإذن وعكس/تصحيح الفروق |
| `void_goods_receipt` | `(receipt_id, reason)` | إلغاء الإذن مع عكس أثره |
| `adjust_item_stock` | `(item_id, new_quantity, note)` | تسوية رصيد (جرد/تصحيح) |
| `recalculate_pending_stock` | — | إعادة حساب مخزون الطلبات لكل الأصناف |
| `recalculate_purchase_order_status` | `(order_id)` | إعادة حساب حالة طلب |
| `recalculate_all_order_statuses` | — | إعادة حساب حالات كل الطلبات |
| `get_inventory_stats` | `(low_threshold)` | إحصاء المخزون (عدد/قيمة/منخفض/غير متوفر/سالب) في طلب واحد |
| `get_purchase_stats` | `(overdue_days)` | إحصاء الطلبات (الحالات/المتأخرة/الكميات/إذونات اليوم) في طلب واحد |

## رموز الأخطاء المرفوعة من الدوال

ترفع الدوال رموزًا ثابتة تُترجم في `src/api/errors.js` إلى رسائل عربية:

`AUTH_REQUIRED`, `USER_NOT_ACTIVE`, `INSUFFICIENT_ROLE`, `ORDER_REQUIRES_ITEMS`, `ORDER_NOT_FOUND`,
`ORDER_HAS_RECEIPTS`, `ORDER_CANCELLED`, `ITEM_NOT_FOUND`, `INVALID_QUANTITY`,
`QUANTITY_BELOW_RECEIVED`, `CANNOT_DELETE_RECEIVED_ITEM`, `RECEIPT_REQUIRES_ITEMS`,
`RECEIPT_NOT_FOUND`, `RECEIPT_ALREADY_VOIDED`.

## الصيانة والدوريات

```sql
-- إعادة حساب مخزون الطلبات لكل الأصناف
select public.recalculate_pending_stock();

-- إعادة حساب حالات كل الطلبات
select public.recalculate_all_order_statuses();

-- تدقيق: مقارنة الرصيد المخزَّن مع مجموع الحركات
select i.id, i.item_number, i.current_stock,
       coalesce(sum(m.quantity), 0) as ledger_balance
  from public.items i
  left join public.stock_movements m on m.item_id = i.id
 group by i.id, i.item_number, i.current_stock
having i.current_stock <> coalesce(sum(m.quantity), 0);

-- حركات صنف معيّن
select * from public.stock_movements where item_id = '<uuid>' order by created_date desc;
```

## النسخ الاحتياطي

- فعّل PITR أو نسخًا يومية من لوحة Supabase.
- قبل أي ترحيل كبير: `supabase db dump -f backup-$(date +%F).sql` (أو pg_dump).
- اختبر الاسترجاع على فرعDatabase مؤقت قبل الاعتماد عليه.

## ملاحظة توافق

إذا لم يُطبَّق الترحيل (4)، ستعمل الواجهة عبر مسار بديل مكافئ منطقيًا لكن بلا ذرّية؛
وإذا لم يُطبَّق (5) فسيعمل النظام بدون أدوار (وقد تظهر رسالة "غير مُفعَّل" لأي مستخدم غير موجود في `profiles`).
