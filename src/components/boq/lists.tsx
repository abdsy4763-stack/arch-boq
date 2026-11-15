import { type ReactNode, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import {
  Calculator,
  Edit3,
  FileSpreadsheet,
  FunctionSquare,
  Layers,
  Lock,
  Percent,
  Plus,
  Sparkles,
  Trash2,
  Unlock,
} from "lucide-react";
import { CATEGORIES, effectiveItems, seedWaste, wastePercent } from "@/lib/boq/catalog";
import { COPYRIGHT_TEXT, CREATOR_SIGNATURE } from "@/lib/boq/branding";
import {
  ARCH_VARIABLES_INFO,
  buildProjectSummary,
  describeFormulaAr,
  evaluateFormula,
  fmt,
  fmtLoose,
  STRUCT_VARIABLES_INFO,
} from "@/lib/boq/engine";
import { downloadBinary } from "@/lib/boq/io";
import { useBoq } from "@/lib/boq/store";
import type {
  CatalogItem,
  FinishDefinition,
  FinishKind,
  FormulaDefinition,
  FormulaScope,
  QuantityFormula,
} from "@/lib/boq/types";
import { Btn, Card, Field, TextField } from "./ui";

const PAGE = 40;
const KIND_OPTIONS: { value: FinishKind; label: string }[] = [
  { value: "floor", label: "أرضيات" },
  { value: "wall", label: "جدران" },
  { value: "ceiling", label: "أسقف" },
  { value: "door", label: "أبواب" },
  { value: "window", label: "نوافذ" },
  { value: "sill", label: "نعلات" },
  { value: "tyrolean", label: "براطيش" },
  { value: "plaster", label: "طينة" },
  { value: "insulation", label: "عزل" },
  { value: "facade", label: "واجهات" },
  { value: "extra", label: "كل البنود / مباشر" },
];

export const BUILTIN_FORMULA_OPTIONS: { value: QuantityFormula; label: string; expr: string }[] = [
  { value: "floorArea", label: "مساحة الأرضية (الطول × العرض)", expr: "floorArea" },
  { value: "wallArea", label: "مساحة الجدران الصافية (بعد خصم الفتحات)", expr: "wallArea" },
  { value: "ceilingArea", label: "مساحة السقف", expr: "ceilingArea" },
  { value: "sillLength", label: "طول النعلات (المحيط − عروض الأبواب)", expr: "perimeter - doorWidthTotal" },
  { value: "doorWidthTotal", label: "طول البراطيش (مجموع عروض الأبواب)", expr: "doorWidthTotal" },
  { value: "doorArea", label: "مساحة الأبواب", expr: "doorArea" },
  { value: "windowArea", label: "مساحة النوافذ", expr: "windowArea" },
  { value: "blockArea", label: "مساحة سطح الكتلة", expr: "blockArea" },
  { value: "facadeArea", label: "مساحة الواجهات الخارجية", expr: "facadeArea" },
  { value: "direct", label: "كمية مباشرة مقطوعة", expr: "direct" },
];

const ALLOWED_VARIABLES = new Set([
  ...ARCH_VARIABLES_INFO.map((v) => v.key),
  ...STRUCT_VARIABLES_INFO.map((v) => v.key),
  "totalDoorArea",
  "totalWindowArea",
  "totalDoorWidth",
]);

const OPERATORS = [
  { token: " + ", label: "+ جمع" },
  { token: " - ", label: "− طرح" },
  { token: " * ", label: "× ضرب" },
  { token: " / ", label: "÷ قسمة" },
  { token: "(", label: "( قوس" },
  { token: ")", label: ") قوس" },
  { token: "2", label: "2" },
  { token: "0.10", label: "0.10" },
  { token: "0.30", label: "0.30" },
  { token: "1.5", label: "1.5" },
];

const ADMIN_HASH_KEY = "boq-admin-password-hash";

async function passwordHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function AdminGate({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  const [unlocked, setUnlocked] = useState(true);
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showLockConfig, setShowLockConfig] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_HASH_KEY);
    if (stored) {
      setHasStoredPassword(true);
      setUnlocked(false);
    }
  }, []);

  if (!unlocked && hasStoredPassword) {
    return (
      <Card className="mx-auto max-w-md p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Lock className="size-5 text-teal" />
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted">{description}</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const stored = localStorage.getItem(ADMIN_HASH_KEY);
            const valid = (await passwordHash(password)) === stored;
            if (!valid) {
              setError("كلمة المرور غير صحيحة.");
              return;
            }
            setUnlocked(true);
            setPassword("");
            setError(null);
          }}
        >
          <label className="block text-sm font-medium">
            كلمة مرور الإدارة
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-line bg-input px-3 outline-none focus:border-teal"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Btn type="submit">فتح القفل</Btn>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {children}
      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Unlock className="size-3.5 text-teal" />
            {hasStoredPassword
              ? "الحماية بكلمة مرور مفعّلة على هذا الجهاز."
              : "التعديل السريع مفتوح (بدون كلمة مرور)."}
          </span>
          <button
            type="button"
            onClick={() => setShowLockConfig(!showLockConfig)}
            className="text-xs font-semibold text-teal hover:underline"
          >
            {showLockConfig ? "إخفاء إعدادات الحماية" : "إعداد قفل كلمة المرور (اختياري)"}
          </button>
        </div>
        {showLockConfig ? (
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <label className="block min-w-60 text-xs text-muted">
              كلمة مرور جديدة (6 أحرف على الأقل)
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-line bg-input px-3 text-sm text-ink"
              />
            </label>
            <Btn
              tone="ghost"
              onClick={async () => {
                if (newPassword.length < 6) {
                  setSaved(false);
                  setError("يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.");
                  return;
                }
                localStorage.setItem(ADMIN_HASH_KEY, await passwordHash(newPassword));
                setHasStoredPassword(true);
                setNewPassword("");
                setError(null);
                setSaved(true);
              }}
            >
              تفعيل القفل
            </Btn>
            {hasStoredPassword ? (
              <Btn
                tone="danger"
                onClick={() => {
                  localStorage.removeItem(ADMIN_HASH_KEY);
                  setHasStoredPassword(false);
                  setSaved(false);
                }}
              >
                إلغاء القفل نهائياً
              </Btn>
            ) : null}
            {saved ? <span className="text-xs text-ok">تم الحفظ</span> : null}
            {error ? <p className="w-full text-xs text-danger">{error}</p> : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export function ProjectView() {
  const blocks = useBoq((s) => s.blocks);
  const summary = useMemo(() => buildProjectSummary(blocks), [blocks]);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"code" | "total">("code");
  const [groupByUnit, setGroupByUnit] = useState(false);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return [...summary.items]
      .filter(
        (item) =>
          !needle ||
          [item.code, item.desc, item.unit].some((value) =>
            value.toLocaleLowerCase().includes(needle),
          ),
      )
      .sort((a, b) => {
        if (groupByUnit && a.unit !== b.unit) return a.unit.localeCompare(b.unit, "ar");
        return sortBy === "total" ? b.total - a.total : a.code.localeCompare(b.code, "ar");
      });
  }, [groupByUnit, query, sortBy, summary.items]);

  const totalsByDiscipline = useMemo(() => {
    let arch = 0;
    let struct = 0;
    for (const item of summary.items) {
      if (item.code.startsWith("STR-") || item.code.startsWith("EW-")) struct += item.total;
      else arch += item.total;
    }
    return { arch, struct };
  }, [summary.items]);

  if (blocks.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-bold">الإجمالي العام للمشروع</h2>
        <p className="mt-2 text-sm text-muted">
          يُجمع تلقائياً بعد توليد تقرير كتلة واحدة على الأقل من تبويب «المعماري» أو «الإنشائي».
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-card bg-navy p-4 text-on-navy">
          <div className="text-xs text-on-navy/80">إجمالي كلفة المشروع ({blocks.length} كتل)</div>
          <div className="num mt-1 text-2xl font-bold">{fmt(summary.itemsTotal)}</div>
        </div>
        <div className="rounded-card border border-line bg-card p-4">
          <div className="text-xs text-muted">إجمالي الأعمال المعمارية والإكساء</div>
          <div className="num mt-1 text-xl font-bold text-ink">{fmt(totalsByDiscipline.arch)}</div>
        </div>
        <div className="rounded-card border border-line bg-card p-4">
          <div className="text-xs text-muted">إجمالي الأعمال الإنشائية والترابية</div>
          <div className="num mt-1 text-xl font-bold text-teal">{fmt(totalsByDiscipline.struct)}</div>
        </div>
      </div>

      <Card className="p-4">
        <h3 className="mb-3 font-bold">توزيع التكاليف حسب الكتل / الطوابق</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {summary.blocks.map((block) => (
            <div
              key={block.name}
              className="flex items-center justify-between rounded-lg border border-line bg-band/50 px-3 py-2.5"
            >
              <span className="font-semibold">{block.name}</span>
              <span className="num font-bold text-teal">{fmt(block.total)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              الجدول التجميعي لكافة بنود المشروع ({summary.items.length} بند)
            </h2>
            <p className="text-xs text-muted">
              تجميع آلي لكل الكتل المحفوظة حسب الكود والوصف والوحدة والسعر الإفرادي.
            </p>
          </div>
          <Btn tone="primary" onClick={() => void downloadProjectSummaryXlsx(summary)}>
            <FileSpreadsheet className="size-4" />
            تصدير إجمالي المشروع (XLSX)
          </Btn>
        </div>

        <div className="no-print mt-4 grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
          <input
            aria-label="بحث في إجمالي المشروع"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="بحث بالكود أو الوصف أو الوحدة..."
            className="h-10 rounded-lg border border-line bg-input px-3 text-sm"
          />
          <select
            aria-label="فرز إجمالي المشروع"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="h-10 rounded-lg border border-line bg-input px-3 text-xs font-semibold"
          >
            <option value="code">فرز حسب الكود</option>
            <option value="total">فرز حسب الإجمالي (الأعلى أولاً)</option>
          </select>
          <label className="inline-flex items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold">
            <input
              type="checkbox"
              checked={groupByUnit}
              onChange={(event) => setGroupByUnit(event.target.checked)}
            />
            تجميع حسب الوحدة
          </label>
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate text-on-navy">
                <th className="border border-line px-3 py-2 text-right">الكود</th>
                <th className="border border-line px-3 py-2 text-right">وصف البند</th>
                <th className="border border-line px-3 py-2 text-center">الوحدة</th>
                <th className="border border-line px-3 py-2 text-end">الكمية الكلية</th>
                <th className="border border-line px-3 py-2 text-end">السعر الإفرادي</th>
                <th className="border border-line px-3 py-2 text-end">الإجمالي الكلي</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, idx) => (
                <tr
                  key={`${item.code}|${item.desc}|${item.unit}|${item.price}`}
                  className={idx % 2 ? "bg-band/50" : ""}
                >
                  <td className="num border border-line px-3 py-2 font-bold text-teal">{item.code}</td>
                  <td className="border border-line px-3 py-2">{item.desc}</td>
                  <td className="border border-line px-3 py-2 text-center">{item.unit || "—"}</td>
                  <td className="num border border-line px-3 py-2 text-end font-semibold">
                    {fmt(item.qty)}
                  </td>
                  <td className="num border border-line px-3 py-2 text-end">{fmt(item.price)}</td>
                  <td className="num border border-line px-3 py-2 text-end font-bold">
                    {fmt(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2 md:hidden">
          {visibleItems.map((item) => (
            <article
              key={`${item.code}|${item.desc}|${item.unit}|${item.price}`}
              className="rounded-lg border border-line p-3"
            >
              <div className="num text-xs font-bold text-teal">{item.code}</div>
              <p className="mt-1 text-sm leading-relaxed">{item.desc}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <span>{item.unit || "—"}</span>
                <span className="num">الكمية {fmt(item.qty)}</span>
                <span className="num">السعر {fmt(item.price)}</span>
                <span className="num font-bold">الإجمالي {fmt(item.total)}</span>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

async function downloadProjectSummaryXlsx(summary: ReturnType<typeof buildProjectSummary>): Promise<void> {
  const itemRows = [
    ["الكود", "الوصف", "الوحدة", "الكمية النهائية", "السعر الإفرادي", "الإجمالي"],
    ...summary.items.map((item) => [item.code, item.desc, item.unit, item.qty, item.price, item.total]),
    [],
    ["إجمالي كلفة المشروع", "", "", "", "", summary.itemsTotal],
    [],
    [CREATOR_SIGNATURE, COPYRIGHT_TEXT, "", "", "", ""],
  ];
  const blockRows = [
    ["الكتلة", "الإجمالي"],
    ...summary.blocks.map((block) => [block.name, block.total]),
    [],
    ["مجموع الكتل", summary.blocksTotal],
    [],
    [CREATOR_SIGNATURE, COPYRIGHT_TEXT],
  ];
  
  const workbook = XLSX.utils.book_new();

  const itemsSheet = XLSX.utils.aoa_to_sheet(itemRows);
  const blocksSheet = XLSX.utils.aoa_to_sheet(blockRows);
  
  const border = {
    top: { style: "thin", color: { rgb: "CBD5E1" } },
    bottom: { style: "thin", color: { rgb: "CBD5E1" } },
    left: { style: "thin", color: { rgb: "CBD5E1" } },
    right: { style: "thin", color: { rgb: "CBD5E1" } },
  };
  const headerStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "1F3A4D" } },
    font: { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true, readingOrder: 2 },
    border,
  };
  const textStyle = {
    font: { name: "Arial", sz: 10, color: { rgb: "1F2D3A" } },
    alignment: { horizontal: "right", vertical: "center", wrapText: true, readingOrder: 2 },
    border,
  };
  const centerTextStyle = {
    ...textStyle,
    alignment: { horizontal: "center", vertical: "center", wrapText: true, readingOrder: 2 },
  };
  const numStyle = {
    font: { name: "Arial", sz: 10, color: { rgb: "1F2D3A" } },
    alignment: { horizontal: "center", vertical: "center" },
    numFmt: "#,##0.00",
    border,
  };
  const totalStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } },
    font: { name: "Arial", sz: 11, bold: true, color: { rgb: "1F3A4D" } },
    alignment: { horizontal: "center", vertical: "center" },
    border,
  };
  const totalNumStyle = {
    ...totalStyle,
    numFmt: "#,##0.00",
  };

  styleSummarySheet(itemsSheet, itemRows.length, 6, headerStyle, textStyle, centerTextStyle, numStyle, totalStyle, totalNumStyle, [14, 70, 12, 18, 18, 20]);
  styleSummarySheet(blocksSheet, blockRows.length, 2, headerStyle, textStyle, centerTextStyle, numStyle, totalStyle, totalNumStyle, [28, 20]);
  
  itemsSheet["!merges"] = [{ s: { r: itemRows.length - 3, c: 0 }, e: { r: itemRows.length - 3, c: 4 } }];
  blocksSheet["!merges"] = [{ s: { r: blockRows.length - 3, c: 0 }, e: { r: blockRows.length - 3, c: 0 } }];

  itemsSheet["!autofilter"] = { ref: `A1:F${Math.max(1, summary.items.length + 1)}` };
  itemsSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  itemsSheet["!sheetViews"] = [{ rightToLeft: true }];
  
  blocksSheet["!autofilter"] = { ref: `A1:B${Math.max(1, summary.blocks.length + 1)}` };
  blocksSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  blocksSheet["!sheetViews"] = [{ rightToLeft: true }];
  
  XLSX.utils.book_append_sheet(workbook, itemsSheet, "إجمالي البنود");
  XLSX.utils.book_append_sheet(workbook, blocksSheet, "ملخص الكتل");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  await downloadBinary(
    "إجمالي-المشروع.xlsx",
    new Uint8Array(output),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

function styleSummarySheet(
  sheet: XLSX.WorkSheet,
  rowCount: number,
  columnCount: number,
  headerStyle: Record<string, unknown>,
  textStyle: Record<string, unknown>,
  centerTextStyle: Record<string, unknown>,
  numStyle: Record<string, unknown>,
  totalStyle: Record<string, unknown>,
  totalNumStyle: Record<string, unknown>,
  widths: number[],
): void {
  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < columnCount; col += 1) {
      const cell = XLSX.utils.encode_cell({ r: row, c: col });
      if (!sheet[cell]) continue;
      
      if (row === 0) {
        sheet[cell].s = headerStyle;
      } else if (row === rowCount - 3) { // صف الإجمالي
        sheet[cell].s = col === columnCount - 1 ? totalNumStyle : totalStyle;
      } else if (row > 0 && row < rowCount - 3) {
        if (col === 0 || col === 2) {
           sheet[cell].s = centerTextStyle;
        } else if (col === 1) {
           sheet[cell].s = textStyle;
        } else {
           sheet[cell].s = numStyle;
        }
      }
    }
  }
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  sheet["!rows"] = Array.from({ length: rowCount }, (_, index) => ({ hpt: index === 0 ? 30 : 28 }));
}

export function DatabaseView() {
  return (
    <AdminGate
      title="إدارة البنود والمعادلات والتشطيبات"
      description="أدخل كلمة مرور الإدارة لتعديل المعادلات والبنود والأسعار."
    >
      <CatalogAdminView />
    </AdminGate>
  );
}

export function WasteView() {
  return (
    <AdminGate
      title="إدارة نسب الهدر"
      description="أدخل كلمة مرور الإدارة لتعديل نسب الهدر المعتمدة."
    >
      <WasteAdminView />
    </AdminGate>
  );
}

// ==================== استوديو المعادلات وخيارات التشطيب والبنود ====================

function CatalogAdminView() {
  const [subView, setSubView] = useState<"studio" | "catalog">("studio");
  const patches = useBoq((s) => s.patches);
  const customItems = useBoq((s) => s.customItems);
  const hiddenCodes = useBoq((s) => s.hiddenCodes);
  const patchItem = useBoq((s) => s.patchItem);
  const setWaste = useBoq((s) => s.setWaste);
  const formulaDefinitions = useBoq((s) => s.formulaDefinitions);
  const addCustomItem = useBoq((s) => s.addCustomItem);
  const removeCustomItem = useBoq((s) => s.removeCustomItem);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [bulkPct, setBulkPct] = useState("");
 const [draft, setDraft] = useState({
    code: "",
    desc: "",
    unit: "م2",
    price: "",
    category: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const formulaOptions = [
    ...BUILTIN_FORMULA_OPTIONS.map((f) => ({ value: f.value, label: `قياسي: ${f.label}` })),
    ...formulaDefinitions.map((item) => ({
      value: item.id,
      label: `مخصص: ${item.name} (${describeFormulaAr(item.expression)})`,
    })),
  ];

  const items = useMemo(
    () => effectiveItems(patches, customItems, hiddenCodes),
    [patches, customItems, hiddenCodes],
  );
  // استخراج الأقسام الفريدة ديناميكياً من قاعدة البيانات الحالية
  const dynamicCategories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category))).filter(Boolean).sort();
  }, [items]);
  
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category && item.category !== category) return false;
      if (!q) return true;
      return (
        item.code.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [items, query, category]);
  const slice = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const applyBulkPriceChange = () => {
    const pct = Number(bulkPct.replace(",", "."));
    if (!Number.isFinite(pct) || pct === 0) return;
    const factor = 1 + pct / 100;
    filtered.forEach((item) => {
      const nextPrice = Math.max(0, Math.round(item.price * factor * 100) / 100);
      patchItem(item.code, { price: nextPrice });
    });
    setBulkPct("");
    setImportMessage(`تم تعديل أسعار ${filtered.length} بند بنسبة ${pct > 0 ? "+" : ""}${pct}%.`);
  };

  async function importExcel(file: File | undefined) {
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      let added = 0;
      let updated = 0;
      let skipped = 0;
      for (const row of rows) {
        const value = (names: string[]) =>
          names.map((name) => row[name]).find((item) => item !== undefined && String(item).trim() !== "") ?? "";
        const code = String(value(["الكود", "كود البند", "code"])).trim();
        const desc = String(value(["الوصف", "وصف البند", "desc"])).trim();
        const unit = String(value(["الوحدة", "وحدة القياس", "unit"])).trim() || "م2";
        const category = String(value(["القسم", "التصنيف", "category"])).trim() || "أعمال إضافية";
        const price = Number(String(value(["السعر", "price"])).replace(",", "."));
        const waste = Number(String(value(["نسبة الهدر", "نسبة الهدر %", "waste"])).replace(",", "."));
        const kindsText = String(value(["أنواع الإكساء", "نوع الإكساء", "allowedKinds"])).trim();
        const allowedKinds = kindsText
          ? kindsText
              .split(/[,،;|]+/)
              .map((part) => {
                const raw = part.trim();
                return KIND_OPTIONS.find((option) => option.value === raw || option.label === raw)?.value;
              })
              .filter((kind): kind is FinishKind => Boolean(kind))
          : undefined;
        const formulaRaw = String(value(["المعادلة", "formula"])).trim();
        const formula = formulaOptions.some((option) => option.value === formulaRaw)
          ? (formulaRaw as QuantityFormula)
          : undefined;
        if (!code || !desc || !Number.isFinite(price)) {
          skipped += 1;
          continue;
        }
        const current = items.find((item) => item.code.toUpperCase() === code.toUpperCase());
        if (current) {
          patchItem(current.code, {
            unit,
            price,
            category,
            ...(allowedKinds?.length ? { allowedKinds } : {}),
            ...(formula ? { formula } : {}),
          });
          if (Number.isFinite(waste)) setWaste(current.code, waste);
          updated += 1;
        } else {
          const message = addCustomItem({
            code,
            desc,
            unit,
            price,
            category,
            kind: "extra",
            allowedKinds,
            formula,
          });
          if (message) skipped += 1;
          else {
            if (Number.isFinite(waste)) setWaste(code, waste);
            added += 1;
          }
        }
      }
      setImportMessage(`اكتمل الاستيراد: ${added} بند جديد، ${updated} بند محدث، ${skipped} صف متجاوز.`);
    } catch {
      setImportMessage("تعذر قراءة ملف Excel. تحقق من عناوين الأعمدة والامتداد.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-card p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setSubView("studio")}
          className={
            "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition " +
            (subView === "studio"
              ? "bg-teal text-on-teal shadow-xs"
              : "text-muted hover:bg-band hover:text-ink")
          }
        >
          <FunctionSquare className="size-4" />
          <span>1. استوديو المعادلات وخيارات التشطيب</span>
        </button>
        <button
          type="button"
          onClick={() => setSubView("catalog")}
          className={
            "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition " +
            (subView === "catalog"
              ? "bg-teal text-on-teal shadow-xs"
              : "text-muted hover:bg-band hover:text-ink")
          }
        >
          <Layers className="size-4" />
          <span>2. كتالوج البنود والأسعار ({items.length})</span>
        </button>
      </div>

      {subView === "studio" ? (
        <FormulaAndFinishStudio formulaOptions={formulaOptions} />
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">قاعدة البنود والأسعار ({items.length} بند)</h2>
                <p className="text-xs text-muted">
                  عدّل أي سعر أو وحدة أو معادلة بند مباشرة، أو استخدم التعديل الجماعي بالنسب المئوية.
                </p>
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-teal px-3 text-xs font-semibold text-on-teal">
                استيراد أسعار من Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="sr-only"
                  onChange={(event) => {
                    void importExcel(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            {importMessage ? (
              <p className="mt-2 rounded-lg bg-ok-bg px-3 py-2 text-xs font-semibold text-ok">
                {importMessage}
              </p>
            ) : null}

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_14rem_auto]">
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="بحث بالكود أو الوصف أو القسم..."
                className="h-10 rounded-lg border border-line bg-input px-3 text-sm outline-none"
              />
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPage(0);
                }}
                className="h-10 rounded-lg border border-line bg-card px-2 text-xs font-semibold"
              >
                <option value="">كل الأقسام ({items.length})</option>
                {dynamicCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <input
                  value={bulkPct}
                  onChange={(e) => setBulkPct(e.target.value)}
                  placeholder="نسبة % (مثلاً 10)"
                  className="h-10 w-32 rounded-lg border border-line bg-input px-2 text-xs"
                />
                <Btn tone="ghost" onClick={applyBulkPriceChange}>
                  <Percent className="size-3.5 text-teal" />
                  تعديل الأسعار
                </Btn>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            {slice.map((item) => (
              <ItemRow
                key={item.code}
                item={item}
                custom={customItems.some((row) => row.code === item.code)}
                patched={Boolean(patches[item.code])}
                formulaOptions={formulaOptions}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {filtered.length} نتيجة — صفحة {page + 1} / {pages}
            </span>
            <div className="flex gap-2">
              <Btn tone="ghost" onClick={() => setPage((value) => Math.max(0, value - 1))}>
                السابق
              </Btn>
              <Btn tone="ghost" onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}>
                التالي
              </Btn>
            </div>
          </div>

          <Card className="p-4">
            <h3 className="mb-3 font-bold">إضافة بند جديد إلى الكتالوج</h3>
            <form
              className="grid gap-2 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const message = addCustomItem({
                  code: draft.code,
                  desc: draft.desc,
                  unit: draft.unit,
                  price: Number(draft.price) || 0,
                  category: draft.category,
                  kind: "",
                });
                setError(message);
                if (!message) setDraft({ ...draft, code: "", desc: "", price: "" });
              }}
            >
              <TextField label="الكود" value={draft.code} onChange={(code) => setDraft({ ...draft, code })} />
              <TextField label="الوحدة" value={draft.unit} onChange={(unit) => setDraft({ ...draft, unit })} />
              <div className="sm:col-span-2">
                <TextField label="الوصف" value={draft.desc} onChange={(desc) => setDraft({ ...draft, desc })} />
              </div>
              <Field label="السعر" value={draft.price} onChange={(price) => setDraft({ ...draft, price })} />
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">القسم</span>
                <input
                  list="categories"
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  className="h-11 w-full rounded-lg border border-line bg-input px-3 text-sm"
                />
                <datalist id="categories">
                  {dynamicCategories.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>
              {error ? <p className="text-sm text-danger sm:col-span-2">{error}</p> : null}
              <div>
                <Btn type="submit">حفظ البند</Btn>
              </div>
            </form>
            {customItems.length > 0 ? (
              <div className="mt-4 space-y-2">
                {customItems.map((item) => (
                  <div key={item.code} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      <span className="num font-semibold">{item.code}</span> — {item.desc}
                    </span>
                    <button
                      type="button"
                      className="text-danger"
                      onClick={() => removeCustomItem(item.code)}
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}

const READY_FINISH_PRESETS: {
  label: string;
  baseKind: FinishKind;
  formulaId: string;
  categoryFilter: string;
}[] = [
  { label: "عزل مائي للأرضية والوزرات", baseKind: "insulation", formulaId: "formula-wet-isolation", categoryFilter: "" },
  { label: "سيراميك جدران بارتفاع 1.5م", baseKind: "wall", formulaId: "formula-ceramic-dado", categoryFilter: "" },
  { label: "ورق جدران ديكوري", baseKind: "wall", formulaId: "wallArea", categoryFilter: "" },
  { label: "جبس بورد / سقف مستعار إضافي", baseKind: "ceiling", formulaId: "ceilingArea", categoryFilter: "" },
  { label: "بيت نور مخفي محيطي", baseKind: "ceiling", formulaId: "formula-cove-lighting", categoryFilter: "" },
];

function FormulaAndFinishStudio({
  formulaOptions,
}: {
  formulaOptions: { value: string; label: string }[];
}) {
  const formulaDefinitions = useBoq((s) => s.formulaDefinitions);
  const finishDefinitions = useBoq((s) => s.finishDefinitions);
  const addFormulaDefinition = useBoq((s) => s.addFormulaDefinition);
  const updateFormulaDefinition = useBoq((s) => s.updateFormulaDefinition);
  const removeFormulaDefinition = useBoq((s) => s.removeFormulaDefinition);
  const addFinishDefinition = useBoq((s) => s.addFinishDefinition);
  const updateFinishDefinition = useBoq((s) => s.updateFinishDefinition);
  const archiveFinishDefinition = useBoq((s) => s.archiveFinishDefinition);
  const removeFinishDefinition = useBoq((s) => s.removeFinishDefinition);

  const [scope, setScope] = useState<FormulaScope>("arch");
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);
  const [formulaName, setFormulaName] = useState("");
  const [formulaExpr, setFormulaExpr] = useState("floorArea + (perimeter - doorWidthTotal) * 0.30");
  const [formulaUnit, setFormulaUnit] = useState("م²");
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const [finishDraft, setFinishDraft] = useState<{
    label: string;
    baseKind: FinishKind;
    formulaId: string;
    categoryFilter: string;
  }>({
    label: "",
    baseKind: "wall",
    formulaId: "wallArea",
    categoryFilter: "",
  });

  const previewResult = useMemo(() => {
    const sampleVars: Record<string, number> = Object.fromEntries([
      ...ARCH_VARIABLES_INFO.map((v) => [v.key, v.sample]),
      ...STRUCT_VARIABLES_INFO.map((v) => [v.key, v.sample]),
      ["totalDoorArea", 1.89],
      ["totalWindowArea", 3.6],
      ["totalDoorWidth", 0.9],
    ]);
    return evaluateFormula(formulaExpr, sampleVars).value;
  }, [formulaExpr]);

  const insertToken = (token: string) => {
    setFormulaExpr((prev) => `${prev}${prev && !prev.endsWith(" ") && !prev.endsWith("(") ? " " : ""}${token}`);
  };

  const handleSaveFormula = () => {
    const cleanExpr = formulaExpr.trim();
    if (!formulaName.trim() || !cleanExpr) {
      setStatusMsg({ text: "يرجى كتابة اسم المعادلة وتعبيرها الرياضي.", isError: true });
      return;
    }
    const varNames = cleanExpr.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
    const invalidVar = varNames.find((v) => !ALLOWED_VARIABLES.has(v));
    if (invalidVar) {
      setStatusMsg({
        text: `المتغير «${invalidVar}» غير معروف. يرجى استخدام أزرار المتغيرات المتاحة أدناه.`,
        isError: true,
      });
      return;
    }

    if (editingFormulaId) {
      updateFormulaDefinition(editingFormulaId, {
        name: formulaName.trim(),
        expression: cleanExpr,
        scope,
        unit: formulaUnit,
      });
      setStatusMsg({ text: `تم تحديث المعادلة «${formulaName.trim()}» بنجاح.` });
      setEditingFormulaId(null);
    } else {
      const id = `formula-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      const err = addFormulaDefinition({
        id,
        name: formulaName.trim(),
        expression: cleanExpr,
        scope,
        unit: formulaUnit,
      });
      if (err) {
        setStatusMsg({ text: err, isError: true });
        return;
      }
      setStatusMsg({ text: `تمت إضافة المعادلة «${formulaName.trim()}» وأصبحت جاهزة للربط!` });
    }
    setFormulaName("");
  };

  const startEditFormula = (item: FormulaDefinition) => {
    setEditingFormulaId(item.id);
    setFormulaName(item.name);
    setFormulaExpr(item.expression);
    setScope(item.scope ?? "arch");
    setFormulaUnit(item.unit ?? "م²");
  };

  const variablesToShow = scope === "arch" ? ARCH_VARIABLES_INFO : STRUCT_VARIABLES_INFO;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Calculator className="size-5 text-teal" />
              {editingFormulaId ? "تعديل المعادلة الهندسية" : "باني المعادلات الهندسية والإنشائية التفاعلي"}
            </h2>
            <p className="text-xs text-muted">
              اضغط على أزرار المتغيرات العربية لبناء معادلتك بسهولة دون حفظ الرموز، وشاهد الناتج التجريبي فوراً.
            </p>
          </div>
          <div className="flex rounded-lg border border-line bg-band p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setScope("arch")}
              className={
                "rounded-md px-3 py-1.5 transition " +
                (scope === "arch" ? "bg-card text-teal shadow-2xs" : "text-muted")
              }
            >
              معادلة معمارية / إكساء
            </button>
            <button
              type="button"
              onClick={() => setScope("structural")}
              className={
                "rounded-md px-3 py-1.5 transition " +
                (scope === "structural" ? "bg-card text-teal shadow-2xs" : "text-muted")
              }
            >
              معادلة إنشائية (بيتون/طوبار)
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.3fr_6rem_2fr]">
          <TextField
            label="اسم المعادلة (بالعربية)"
            value={formulaName}
            placeholder="مثال: عزل مائي للأرضية مع وزرة 30 سم"
            onChange={setFormulaName}
          />
          <TextField
            label="الوحدة"
            value={formulaUnit}
            placeholder="م² / م³"
            onChange={setFormulaUnit}
          />
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-muted">صيغة المعادلة الرياضية</span>
              <button
                type="button"
                onClick={() => setFormulaExpr("")}
                className="text-[11px] font-semibold text-danger hover:underline"
              >
                مسح الصيغة
              </button>
            </div>
            <input
              dir="ltr"
              value={formulaExpr}
              onChange={(e) => setFormulaExpr(e.target.value)}
              placeholder="floorArea + perimeter * 0.30"
              className="num h-11 w-full rounded-lg border border-teal/50 bg-input px-3 text-left text-sm font-bold text-ink outline-none focus:border-teal"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal/30 bg-teal/5 px-3 py-2 text-xs">
          <div>
            <span className="font-semibold text-muted">الترجمة الهندسية للمعادلة: </span>
            <strong className="text-ink">{describeFormulaAr(formulaExpr)}</strong>
          </div>
          <div className="num rounded bg-card px-2.5 py-1 font-bold text-teal shadow-2xs">
            المعاينة التجريبية (غرفة 4×3.5×3 م): {fmtLoose(previewResult)} {formulaUnit}
          </div>
        </div>

        <div className="mt-3 space-y-2 rounded-lg border border-line bg-band/30 p-3">
          <div className="text-xs font-bold text-ink">
            اضغط لإدراج المتغير في المعادلة ({scope === "arch" ? "قياسات الغرفة والكتلة" : "قياسات العنصر الإنشائي"}):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {variablesToShow.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertToken(v.key)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs font-semibold hover:border-teal hover:bg-teal/10"
              >
                <span>{v.label}</span>
                <code className="rounded bg-band px-1 text-[10px] text-teal">{v.key}</code>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="ml-1 text-xs font-bold text-muted">العمليات والأرقام:</span>
            {OPERATORS.map((op) => (
              <button
                key={op.label}
                type="button"
                onClick={() => insertToken(op.token)}
                className="rounded-md border border-line bg-card px-2.5 py-1 text-xs font-bold text-ink hover:border-teal"
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>

        {statusMsg ? (
          <p
            className={
              "mt-3 rounded-lg px-3 py-2 text-xs font-semibold " +
              (statusMsg.isError ? "bg-danger-bg text-danger" : "bg-ok-bg text-ok")
            }
          >
            {statusMsg.text}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Btn tone="primary" onClick={handleSaveFormula}>
            <Plus className="size-4" />
            {editingFormulaId ? "حفظ التعديلات على المعادلة" : "حفظ المعادلة في القاعدة"}
          </Btn>
          {editingFormulaId ? (
            <Btn
              tone="ghost"
              onClick={() => {
                setEditingFormulaId(null);
                setFormulaName("");
                setFormulaExpr("");
              }}
            >
              إلغاء التعديل
            </Btn>
          ) : null}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-bold">
            المعادلات الهندسية المحفوظة ({formulaDefinitions.length} معادلة مخصصة + {BUILTIN_FORMULA_OPTIONS.length} قياسية)
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {formulaDefinitions.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-line bg-band/40 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="truncate text-xs text-ink">{item.name}</strong>
                    <span className="rounded bg-card px-1.5 py-0.5 text-[10px] font-semibold text-teal">
                      {item.scope === "structural" ? "إنشائي" : "معماري"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {describeFormulaAr(item.expression)}
                  </div>
                  <code dir="ltr" className="num block text-[11px] font-semibold text-teal">
                    {item.expression}
                  </code>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => startEditFormula(item)}
                    title="تعديل المعادلة"
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-card hover:border-teal"
                  >
                    <Edit3 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFormulaDefinition(item.id)}
                    title="حذف المعادلة"
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-card text-danger hover:bg-danger-bg"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="size-5 text-teal" />
            إضافة وتخصيص خيارات التشطيب في الغرف (Custom Finish Options)
          </h2>
          <p className="text-xs text-muted">
            أي خيار تشطيب تضيفه هنا سيظهر فوراً كحقل اختيار جديد داخل جميع الغرف في تبويب «المعماري»، ويُحسب بالمعادلة التي تربطها به!
          </p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-band/30 p-2.5">
          <span className="text-xs font-bold text-teal">إضافة سريعة لخيار شائع:</span>
          {READY_FINISH_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setFinishDraft(preset)}
              className="rounded-md border border-line bg-card px-2.5 py-1 text-xs font-semibold hover:border-teal hover:text-teal"
            >
              + {preset.label}
            </button>
          ))}
        </div>

        <form
          className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            const id =
              "finish-" +
              Date.now().toString(36) +
              "-" +
              Math.random().toString(36).slice(2, 5);
            const message = addFinishDefinition({
              id,
              label: finishDraft.label.trim(),
              baseKind: finishDraft.baseKind,
              formulaId: finishDraft.formulaId,
              categoryFilter: finishDraft.categoryFilter || undefined,
            });
            setStatusMsg({
              text: message ?? `تمت إضافة خيار التشطيب «${finishDraft.label}» بنجاح ويظهر الآن داخل جميع الغرف!`,
              isError: Boolean(message),
            });
            if (!message) setFinishDraft({ ...finishDraft, label: "" });
          }}
        >
          <TextField
            label="اسم خيار التشطيب الجديد"
            value={finishDraft.label}
            placeholder="مثال: ورق جدران / عزل رطوبة"
            onChange={(label) => setFinishDraft({ ...finishDraft, label })}
          />

          <label className="block text-xs font-medium text-muted">
            تصنيف البنود التي تظهر في القائمة
            <select
              value={finishDraft.baseKind}
              onChange={(event) =>
                setFinishDraft({ ...finishDraft, baseKind: event.target.value as FinishKind })
              }
              className="mt-1 h-11 w-full rounded-lg border border-line bg-input px-2 text-sm text-ink"
            >
              {KIND_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  بنود {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-muted">
            فلترة حسب قسم الكتالوج (اختياري)
            <select
              value={finishDraft.categoryFilter}
              onChange={(event) =>
                setFinishDraft({ ...finishDraft, categoryFilter: event.target.value })
              }
              className="mt-1 h-11 w-full rounded-lg border border-line bg-input px-2 text-sm text-ink"
            >
              <option value="">كل الأقسام المتوافقة</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-muted">
            المعادلة المربوطة لحساب الكمية
            <select
              value={finishDraft.formulaId}
              onChange={(event) =>
                setFinishDraft({ ...finishDraft, formulaId: event.target.value })
              }
              className="mt-1 h-11 w-full rounded-lg border border-line bg-input px-2 text-sm text-ink"
            >
              {formulaOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2 lg:col-span-4">
            <Btn type="submit" tone="primary">
              <Plus className="size-4" />
              إضافة خيار التشطيب وتفعيله في الغرف
            </Btn>
          </div>
        </form>

        {finishDefinitions.length > 0 ? (
          <div className="mt-4 space-y-2 border-t border-line pt-3">
            <h3 className="text-xs font-bold text-muted">
              خيارات التشطيب المخصصة الفعالة ({finishDefinitions.length}):
            </h3>
            {finishDefinitions.map((item: FinishDefinition) => (
              <div
                key={item.id}
                className={
                  "rounded-lg border p-3 " +
                  (item.archived ? "border-amber bg-amber-bg" : "border-line bg-band/40")
                }
              >
                <div className="grid gap-2 md:grid-cols-[1fr_10rem_10rem_1.4fr_auto] md:items-end">
                  <label className="block text-xs text-muted">
                    اسم خيار التشطيب
                    <input
                      value={item.label}
                      onChange={(event) =>
                        updateFinishDefinition(item.id, { label: event.target.value })
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-line bg-card px-2 text-sm font-bold text-ink"
                    />
                  </label>
                  <label className="block text-xs text-muted">
                    نوع البنود
                    <select
                      value={item.baseKind}
                      onChange={(event) =>
                        updateFinishDefinition(item.id, {
                          baseKind: event.target.value as FinishKind,
                        })
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                    >
                      {KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-muted">
                    قسم الكتالوج
                    <select
                      value={item.categoryFilter ?? ""}
                      onChange={(event) =>
                        updateFinishDefinition(item.id, {
                          categoryFilter: event.target.value || undefined,
                        })
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                    >
                      <option value="">تلقائي</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-muted">
                    المعادلة الحسابية المربوطة
                    <select
                      value={item.formulaId}
                      onChange={(event) =>
                        updateFinishDefinition(item.id, { formulaId: event.target.value })
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                    >
                      {formulaOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-1">
                    <Btn
                      tone="ghost"
                      onClick={() => archiveFinishDefinition(item.id, !item.archived)}
                    >
                      {item.archived ? "تفعيل" : "إخفاء مؤقت"}
                    </Btn>
                    <button
                      type="button"
                      onClick={() => removeFinishDefinition(item.id)}
                      title="حذف نهائي"
                      className="inline-flex size-10 items-center justify-center rounded-lg border border-line bg-card text-danger hover:bg-danger-bg"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function ItemRow({
  item,
  custom,
  patched,
  formulaOptions,
}: {
  item: CatalogItem;
  custom: boolean;
  patched: boolean;
  formulaOptions: { value: string; label: string }[];
}) {
  const patchItem = useBoq((s) => s.patchItem);
  const kinds = item.allowedKinds ?? ["extra"];
  return (
    <article className="rounded-card border border-line bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="num text-xs font-bold text-teal">{item.code}</span>
        {patched ? (
          <span className="rounded bg-amber-bg px-2 py-0.5 text-xs text-amber">معدّل</span>
        ) : null}
        {custom ? (
          <span className="rounded bg-ok-bg px-2 py-0.5 text-xs text-ok">مضاف</span>
        ) : null}
        <span className="text-xs text-muted">{item.category}</span>
      </div>
      <p className="mt-1 text-sm leading-relaxed">{item.desc}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          الوحدة
          <input
            value={item.unit}
            onChange={(event) => patchItem(item.code, { unit: event.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-line bg-input px-2 text-sm text-ink"
          />
        </label>
        <label className="text-xs text-muted">
          السعر الإفرادي
          <input
            value={String(item.price)}
            inputMode="decimal"
            onChange={(event) =>
              patchItem(item.code, { price: Number(event.target.value.replace(",", ".")) || 0 })
            }
            className="num mt-1 h-10 w-full rounded-lg border border-line bg-input px-2 text-sm font-bold text-ink"
          />
        </label>
      </div>
      <details className="mt-2 border-t border-line pt-2">
        <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">
          ربط البند بأنواع الإكساء والمعادلة الهندسية
        </summary>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
          {KIND_OPTIONS.map((option) => (
            <label key={option.value} className="inline-flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={kinds.includes(option.value)}
                onChange={() => {
                  const next = kinds.includes(option.value)
                    ? kinds.filter((kind) => kind !== option.value)
                    : [...kinds, option.value];
                  patchItem(item.code, { allowedKinds: next.length ? next : ["extra"] });
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
        <label className="mt-3 block text-xs text-muted">
          معادلة الحساب المعتمدة لهذا البند
          <select
            value={item.formula ?? "direct"}
            onChange={(event) => patchItem(item.code, { formula: event.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-line bg-input px-2 text-sm text-ink"
          >
            {formulaOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </details>
    </article>
  );
}

function WasteAdminView() {
  const patches = useBoq((s) => s.patches);
  const customItems = useBoq((s) => s.customItems);
  const hiddenCodes = useBoq((s) => s.hiddenCodes);
  const overrides = useBoq((s) => s.wasteOverrides);
  const setWaste = useBoq((s) => s.setWaste);
  const resetWaste = useBoq((s) => s.resetWaste);
  const [query, setQuery] = useState("");
  const [onlySet, setOnlySet] = useState(false);
  const [page, setPage] = useState(0);
  const items = useMemo(
    () => effectiveItems(patches, customItems, hiddenCodes),
    [patches, customItems, hiddenCodes],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const rate = wastePercent(item.code, overrides);
      if (onlySet && rate === 0) return false;
      if (!q) return true;
      return item.code.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
    });
  }, [items, overrides, onlySet, query]);
  const slice = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-lg font-bold">إدارة نسب الهدر المعمارية</h2>
        <p className="text-xs text-muted">
          أدخل النسبة كرقم مثل 5 أو 7.5 دون علامة %. الكمية النهائية = الأساس + (الأساس × النسبة / 100).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="بحث بالكود أو الوصف..."
            className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-input px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setOnlySet((value) => !value);
              setPage(0);
            }}
            className={
              "h-10 rounded-lg px-3 text-xs font-semibold " +
              (onlySet ? "bg-teal text-on-teal" : "border border-line bg-card")
            }
          >
            البنود ذات الهدر فقط
          </button>
        </div>
      </Card>
      <div className="space-y-2">
        {slice.map((item) => {
          const rate = wastePercent(item.code, overrides);
          const seeded = seedWaste(item.code);
          const overridden = Object.prototype.hasOwnProperty.call(overrides, item.code);
          return (
            <article key={item.code} className="rounded-card border border-line bg-card p-3">
              <div className="num text-xs font-bold text-teal">{item.code}</div>
              <p className="mt-1 text-sm leading-relaxed">{item.desc}</p>
              <div className="mt-2 flex items-end gap-2">
                <label className="text-xs text-muted">
                  نسبة الهدر %
                  <input
                    value={String(rate)}
                    inputMode="decimal"
                    onChange={(event) =>
                      setWaste(item.code, Number(event.target.value.replace(",", ".")) || 0)
                    }
                    className="num mt-1 h-10 w-28 rounded-lg border border-line bg-input px-2 text-sm font-bold text-ink"
                  />
                </label>
                <span className="pb-2 text-xs text-muted">{item.unit}</span>
                {overridden ? (
                  <button
                    type="button"
                    className="mb-2 text-xs font-semibold text-amber"
                    onClick={() => resetWaste(item.code)}
                  >
                    استعادة الافتراضي ({fmtLoose(seeded)}%)
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          {filtered.length} بند — صفحة {page + 1} / {pages}
        </span>
        <div className="flex gap-2">
          <Btn tone="ghost" onClick={() => setPage((value) => Math.max(0, value - 1))}>
            السابق
          </Btn>
          <Btn tone="ghost" onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}>
            التالي
          </Btn>
        </div>
      </div>
    </div>
  );
}
