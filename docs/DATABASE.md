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


---

# الربط المباشر بقاعدة البيانات + حماية البيانات

## أولًا: الوضع الحالي (لا يحتاج أي خطوة)

| الطبقة | كيف تعمل |
|---|---|
| تشغيل محلي | `.env.local` في جذر المشروع (غير مرفوع إلى Git) |
| نسخة المعاينة | GitHub → `Settings → Secrets and variables → Actions` → `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| القاعدة | مشروع Supabase مُدار (سحابي) معرّفه `rwknsqrpmzvtoeplkacx` |

بهذين المفتاحين **أستطيع فحص بنية القاعدة** (وجود الجداول والأعمدة والدوال) وهو ما يكفي
لتشخيص حالة الترحيلات والتحقق منها.

---

## ثانيًا: خيارات الربط المباشر (اختر واحدًا)

### ✅ الخيار 1 — تطبيق SQL بنفسك (الأكثر أمانًا، والمستخدم حاليًا)
- **Supabase → SQL Editor → New query** → الصق محتوى ملف الترحيل → **Run**.
- لا تُعطى أي مفتاح إداري، والمخاطر صفر.

### الخيار 2 — تعطيني صلاحية تنفيذ مؤقتة (أتولى التنفيذ بنفسي)
1. **Supabase → Project Settings → Database → Connection string → URI**
   (الصيغة: `postgresql://postgres:<كلمة-مرور-القاعدة>@db.rwknsqrpmzvtoeplkacx.supabase.co:5432/postgres`).
2. أنشئ ملف **`.db-admin.local`** في جذر المشروع (مُستثنى في `.gitignore`):
   ```
   SUPABASE_URL=https://rwknsqrpmzvtoeplkacx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   SUPABASE_DB_URL=postgresql://postgres:...@db.rwknsqrpmzvtoeplkacx.supabase.co:5432/postgres
   ```
3. أخبرني «جاهز» → أنفّذ `npx supabase migration up --db-url ...` ثم أعطيك تقريرًا كاملًا.
4. بعد الانتهاء: **بدّل كلمة مرور القاعدة ومفتاح service_role** واحذف الملف.

### الخيار 3 — service_role key فقط (للنسخ الاحتياطي والفحص)
يكفي لسكربت النسخ الاحتياطي لسحب البيانات كاملة (يتجاوز RLS)، لكنه **لا يكفي لتنفيذ DDL**.

### 🚫 لا تُضِف أي مفتاح إداري إلى:
- `.env.local` (أي متغيّر يبدأ بـ `VITE_` يُدمج في حزمة الواجهة العامة ⇒ يقرأه أي زائر)،
- `GitHub Secrets` المستخدمة في البناء (نفس السبب)،
- المستودع أو ملفات التوثيق.

الملف الإداري الصحيح هو **`.db-admin.local`** (بدون بادئة `VITE_`) وهو مُستثنى من Git.

---

## ثالثًا: ماذا يلمس كل ترحيل في بياناتك؟

| الترحيل | يضيف | يعدّل بيانات؟ | يحذف بيانات؟ |
|---|---|---|---|
| `..._initial_schema` | جداول أولية | — | — |
| `..._create_app_assets_storage` | مجلد تخزين | — | — |
| `..._import_korea_data` | أصناف وإعدادات | upsert على `item_number` | لا |
| `20260912120000_stock_ledger` | دفتر الحركات + أرقام المستندات + دوال | نعم: إعادة حساب `current_stock` / `average_cost` / `pending_stock` / `status` من المستندات المسجَّلة | **لا يحذف أي صف** |
| `20260912121000_profiles_roles` | جدول المستخدمين + سياسات | يضيف صفوف `profiles` | لا |
| `20260912130000_aggregate_stats` | دالتان للتجميع | **لا شيء** | لا |
| `20260912131000_data_safety_snapshots` | جدول نسخ + دوال حفظ/استرجاع/فحص | **لا شيء** | لا |

> الترحيلان الأخيران **إضافيان بالكامل** ولا يمسّان أي سجل قائم — تطبيقهما آمن تمامًا.

⚠️ شفافية: الترحيل `20260912120000` (المطبَّق لديك فعلًا) هو الوحيد الذي **يعيد حساب** الأرصدة،
ومصدر الحساب هو أذونات الاستلام المسجَّلة (الرصيد = مجموع المستلم فعليًا، ومتوسط التكلفة =
المتوسط المرجّح من بنود الاستلام). ولم يكن في النظام القديم أي وسيلة لتعديل الرصيد يدويًا،
فالمصدر الوحيد للأرقام كان المستندات.

---

## رابعًا: النسخ الاحتياطي والاسترجاع

### 1) نسخة سريعة من جهازك (قراءة فقط — لا تعدّل شيئًا)
```powershell
# نسخة كاملة (ملف JSON لكل جدول) + أعداد الصفوف
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-backup.ps1

# تقرير أعداد فقط بدون حفظ ملفات
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-backup.ps1 -Action audit
```
الناتج في `backups/<التاريخ>/` (مُستثنى من Git) مع `counts.json` و`README.txt`.
> بدون `service_role` سيقرأ صفرًا بسبب RLS — وهذا دليل عملي أن الحماية تعمل.

### 2) نسخة كاملة رسمية (موصى بها قبل أي ترحيل)
```bash
supabase link --project-ref rwknsqrpmzvtoeplkacx
supabase db dump -f backups/full-$(date +%F).sql
```
أو من اللوحة: **Database → Backups** (نسخ يومية، وفعّل PITR إن كان متاحًا).

### 3) نسخ السلامة داخل القاعدة (بعد تطبيق `20260912131000`)
```sql
select public.snapshot_business_data('قبل-ترحيل-كذا', 'ملاحظة اختيارية'); -- خُذ نسخة
select * from public.list_data_snapshots();                                -- اعرض النسخ
select public.verify_stock_integrity();                                    -- فحص سلامة الأرصدة
select public.restore_business_data('قبل-ترحيل-كذا', true);                -- استرجاع طارئ
```
- الاسترجاع داخل **معاملة واحدة**: أي خطأ يُلغي كل شيء ولا يبقى أثر جزئي.
- خُذ نسخة جديدة قبل أي استرجاع (فهو يستبدل الوضع الحالي).
- نظّف النسخ القديمة:
  `delete from public.data_safety_snapshots where created_date < now() - interval '90 days';`

### 4) قائمة تحقق قبل أي تعديل على القاعدة
1. نسخة: `supabase db dump` أو `snapshot_business_data`.
2. `scripts/db-backup.ps1 -Action audit` وسجّل الأعداد.
3. طبّق الترحيل.
4. `verify_stock_integrity()` + قارن الأعداد بعد الترحيل.
5. عند أي شك: `restore_business_data('<الاسم>', true)`.

---

## خامسًا: تناوب المفاتيح (بعد أي استخدام إداري)
1. **Project Settings → Database → Reset database password**.
2. **Project Settings → API → service_role → Rotate/Revoke**.
3. حدّث `.db-admin.local` أو احذفه، وتأكد أن `git status` نظيف (لا أسرار في Git).
