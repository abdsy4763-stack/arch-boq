# مصدر تطبيق حصر الكميات المعماري — آخر نسخة

تتضمن هذه الحزمة آخر تحديث للتطبيق، بما في ذلك نسخة الويب ونسخة Android عبر Capacitor، تصحيح معادلة البراطيش، تصدير XLSX منسق والطباعة، إدارة البنود والأسعار والهدر المحمية، استيراد Excel، الربط بكود البند، تصنيفات الإكساء الجديدة، والمعادلات الحرة الآمنة المبنية على القياسات الحالية.

## المتطلبات

- Node.js 22 أو أحدث.
- Java JDK 21.
- Android SDK مع platform Android 36 وBuild Tools 35 أو أحدث.

## تشغيل نسخة الويب

```bash
npm install
npm run dev
```

## فحص وبناء نسخة الويب الداخلية

```bash
npm run typecheck
npm run build:android
```

## بناء APK Debug

```bash
npm install
npm run cap:sync
cd android
./gradlew assembleDebug --no-daemon
```

ينتج APK في:

`android/app/build/outputs/apk/debug/app-debug.apk`

## ملاحظات

- ملف `android/local.properties` مستبعد من الحزمة لأنه يحتوي على مسار Android SDK خاص ببيئة البناء.
- أنشئه يدوياً عند الحاجة، مثال: `sdk.dir=/path/to/Android/sdk`.
- تصدير التقارير يتم بصيغة XLSX مع التنسيق.
- زر الطباعة يستخدم Android PrintManager عبر Capacitor.
- كلمة مرور الإدارة الافتراضية عند أول استخدام: `admin1234`، ويُنصح بتغييرها.
- البيانات والإعدادات محلية لكل نسخة. المزامنة بين الويب وAndroid تحتاج لاحقاً إلى سيرفر وقاعدة بيانات.

## الملفات المهمة

- `src/components/boq/panel.tsx`: لوحة الكتل والفراغات واختيارات الإكساء.
- `src/components/boq/lists.tsx`: إدارة البنود والتصنيفات والمعادلات الحرة.
- `src/lib/boq/engine.ts`: محرك الحسابات وتقييم المعادلات.
- `src/lib/boq/catalog.ts`: الكتالوج وربط البنود بأنواع الإكساء.
- `src/lib/boq/store.ts`: التخزين المحلي وحالة المشروع.
- `src/data/catalog.json`: بيانات البنود الأساسية.
- `android/`: مشروع Capacitor Android.

## الفراغات المركّبة والكتل الداخلية (جديد)

- لكل فراغ ثلاثة أنماط: **مستطيل** (كما كان)، **مركّب** (جمع وطرح مستطيلات لأشكال L وT)، **إدخال مباشر** (مساحة ومحيط من الأوتوكاد).
- **الكتل الداخلية** (كتلة خلاءات، عمود…) تعمل مع كل الأنماط: تُخصم من الأرضية (والسقف اختيارياً) ويُضاف محيطها الخارجي إلى جدران الفراغ.
- حقول الأنماط الجديدة تقبل تعبيراً حسابياً مثل `3.33+5.04+3.33+5.04` أو `333/100`.
- المنطق في `src/lib/boq/engine.ts` (`spaceGeometry`, `spaceIssue`, `numExpr`) والواجهة في `ShapeEditor` داخل `panel.tsx`.
- اختبارات: `node --experimental-strip-types --test src/lib/boq/engine-geometry.test.ts` (تثبت أن نتائج المستطيل مطابقة تماماً للقديم).
