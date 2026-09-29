# نموذج المخزون والقواعد المحاسبية

## المشكلة التي عولجت

كان النظام السابق **يزيد** الرصيد المتاح عند إنشاء طلب الشراء **ويخصمه** عند الاستلام، فتكون النتيجة:

```
طلب 10 قطع  → current_stock = 0 + 10 = 10
استلام 10   → current_stock = 10 - 10 = 0
```

أي أن الصنف الذي وصل فعليًا يظهر برصيد **صفر**، وتُبنى على هذا الرقم كل تقارير المخزون وقيمته
و"الأصناف المنخفضة" — وهذا ما أنتج تقرير "أصناف بالسالب".

## التعريفات المعتمدة الآن

| الحقل | المعنى |
|---|---|
| `items.current_stock` | **الرصيد المتاح فعليًا** (يزيد عند الاستلام فقط) |
| `items.pending_stock` | **مخزون الطلبات**: المطلوب ولم يُستلم بعد في الطلبات المفتوحة |
| `items.average_cost` | متوسط التكلفة المرجّح للكميات الداخلة |
| `stock_movements` | دفتر الحركات: كل تغيير في الرصيد يُسجَّل هنا (سجل التدقيق) |

## دورة حياة العملية

### 1) إنشاء طلب شراء
```
purchase_orders: صف جديد (status = pending)
purchase_order_items: بند لكل صنف (quantity_received = 0)
items.pending_stock += quantity_ordered        ← فقط
items.current_stock: لا يتغيّر
```

### 2) تسجيل إذن استلام
لكل بند يُستلم:
```
normal = min(quantity_received, remaining)      remaining = ordered - received_before
excess = quantity_received - normal

stock_movements: 'receipt'        (+normal, unit_cost)
stock_movements: 'receipt_excess' (+excess)      إن وُجدت

items.current_stock += normal + excess
items.pending_stock = max(0, pending - normal)
purchase_order_items.quantity_received += quantity_received
purchase_orders.status = يُعاد حسابه من البنود
```
> الكمية الزائدة **لا تُفقد**: تُضاف كاملة للرصيد المتاح وتُسجَّل كحركة مستقلة قابلة للتدقيق.

### 3) تعديل إذن استلام
- فرق موجب/سالب على البند → حركة `adjustment` بالفرق.
- بند محذوف → حركة `reversal` بالسالب + تصحيح `quantity_received` في الطلب.
- إعادة حساب مخزون الطلبات وحالة الطلب.

### 4) إلغاء إذن استلام
- حركة `reversal` لكل بند، تصفير أثره على الطلب والمخزون، ووسم الإذن بـ `voided_at` + سبب (يبقى للأرشيف).

### 5) تعديل طلب شراء
- تغيير كمية بند → تعديل `pending_stock` بمقدار الفرق فقط.
- حذف بند → مسموح فقط إذا `quantity_received = 0` وإلا يُرفض برسالة واضحة.
- لا يُسمح بتقليل الكمية المطلوبة عن المستلمة فعليًا.

### 6) إلغاء طلب شراء
- إخراج الكميات غير المستلمة من `pending_stock`، والحالة `cancelled` نهائيًا (لا تُحسب حالتها من البنود).

### 7) تسوية رصيد يدوية (جرد)
```
delta = new_quantity - current_stock
stock_movements: 'adjustment' (+/- delta, note)
```
لا تُحذف أرقام قديمة: كل تسوية موثّقة بسببها.

## متوسط التكلفة

المتوسط المرجّح يُحسب من **الحركات الموجبة** فقط:

```
average_cost = Σ(quantity × unit_cost) ÷ Σ(quantity)   لحركات quantity > 0 و unit_cost > 0
```

يُعاد حسابه تلقائيًا بعد أي حركة داخلة (`recalculate_item_average_cost`).

## حالات الرصيد في الواجهة

| الحالة | الشرط |
|---|---|
| `negative` | `< 0` (يدل على خلل يحتاج تسوية) |
| `out` | `= 0` |
| `low` | `< 5` (الحد قابل للتعديل في `lib/labels.js`) |
| `ok` | `>= 5` |

## فروقات المورد

```
quantities: difference      = received - ordered
value:      difference      = difference × unit_cost
status:     excess / shortage / complete
netBalance  = Σ(value للزيادات) + Σ(value للنواقص)
```
- `netBalance > 0` ⇒ لصالح الشركة (المورد مطالب بها).
- `netBalance < 0` ⇒ لصالح المورد (أنت مطالب بها).
