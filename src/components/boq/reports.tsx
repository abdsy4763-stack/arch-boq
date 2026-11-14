import {
  Building2,
  Download,
  FileSpreadsheet,
  GitCompare,
  HardHat,
  Layers,
  Printer,
  Settings2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { Printer as NativePrinter } from "@capgo/capacitor-printer";
import { Capacitor } from "@capacitor/core";
import {
  downloadBinary,
  fmt,
  fmtLoose,
  structuralKpis,
} from "@/lib/boq/engine";
import { COPYRIGHT_TEXT, CREATOR_SIGNATURE } from "@/lib/boq/branding";
import { useBoq } from "@/lib/boq/store";
import type { BlockRecord, ReportLine, ReportSettings } from "@/lib/boq/types";
import { Btn, Card, ConfirmDialog } from "./ui";

type DisciplineFilter = "all" | "arch" | "structural";

function isStructuralCode(code: string): boolean {
  return code.startsWith("STR-") || code.startsWith("EW-");
}

export function ReportsView() {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState<DisciplineFilter>("all");
  const [sortBy, setSortBy] = useState<"code" | "desc" | "total">("code");
  const [groupBy, setGroupBy] = useState<"none" | "section">("none");
  const [compareId, setCompareId] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const blocks = useBoq((s) => s.blocks);
  const activeBlockId = useBoq((s) => s.activeBlockId);
  const setActive = (id: string) => useBoq.setState({ activeBlockId: id });
  const loadBlock = useBoq((s) => s.loadBlock);
  const deleteBlock = useBoq((s) => s.deleteBlock);
  const reportSettings = useBoq((s) => s.reportSettings);
  const setReportSettings = useBoq((s) => s.setReportSettings);

  const active = blocks.find((block) => block.id === activeBlockId) ?? blocks[0];

  const breakdown = useMemo(() => {
    if (!active) return { archTotal: 0, structTotal: 0, total: 0, archCount: 0, structCount: 0 };
    let archTotal = 0;
    let structTotal = 0;
    let archCount = 0;
    let structCount = 0;
    for (const line of active.lines) {
      if (isStructuralCode(line.code)) {
        structTotal += line.total;
        structCount += 1;
      } else {
        archTotal += line.total;
        archCount += 1;
      }
    }
    return {
      archTotal,
      structTotal,
      total: active.detailTotal,
      archCount,
      structCount,
    };
  }, [active]);

  const structMetrics = useMemo(
    () => (active?.snapshot ? structuralKpis(active.snapshot) : null),
    [active],
  );

  const visibleLines = useMemo(
    () => filterAndSortLines(active?.lines ?? [], query, discipline, sortBy, groupBy),
    [active?.lines, discipline, groupBy, query, sortBy],
  );

  const visibleAggregate = useMemo(
    () => filterAndSortLines(active?.aggregate ?? [], query, discipline, sortBy, groupBy),
    [active?.aggregate, discipline, groupBy, query, sortBy],
  );

  const compared = blocks.find((block) => block.id === compareId);

  if (!active) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-bold">لا توجد تقارير محفوظة بعد</h2>
        <p className="mt-2 text-sm text-muted">
          أدخل أبعاد الغرف أو العناصر الإنشائية ثم اضغط «توليد التقرير» ليظهر هنا الجدول التفصيلي والتجميعي.
        </p>
      </Card>
    );
  }

  const hasStructMix =
    structMetrics && (structMetrics.totalRcConcrete > 0 || structMetrics.totalBlinding > 0);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {blocks.map((block) => (
          <button
            key={block.id}
            type="button"
            onClick={() => setActive(block.id)}
            className={
              "shrink-0 rounded-lg px-3.5 py-2 text-sm font-bold transition " +
              (block.id === active.id
                ? "bg-navy text-on-navy shadow-xs"
                : "border border-line bg-card hover:border-teal")
            }
          >
            {block.name}
          </button>
        ))}
      </div>

      <Card className="no-print p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold">ترويسة التقارير الرسمية والمقارنة الهندسية</h3>
            <p className="text-xs text-muted">
              تظهر بيانات المكتب والمشروع والاعتماد في ملفات الـ Excel المصدّرة والطباعة الورقية / PDF.
            </p>
          </div>
          <Btn tone="ghost" onClick={() => setShowSettings((value) => !value)}>
            <Settings2 className="size-4 text-teal" />
            {showSettings ? "إخفاء إعدادات الترويسة" : "تعديل الترويسة"}
          </Btn>
        </div>

        {showSettings ? (
          <div className="mt-3 grid gap-2 border-t border-line pt-3 md:grid-cols-3">
            <input
              aria-label="اسم الشركة أو المكتب الهندسي"
              value={reportSettings.companyName}
              onChange={(event) => setReportSettings({ companyName: event.target.value })}
              placeholder="اسم الشركة / المكتب الهندسي"
              className="h-11 rounded-lg border border-line bg-input px-3 text-sm"
            />
            <input
              aria-label="اسم المشروع"
              value={reportSettings.projectName}
              onChange={(event) => setReportSettings({ projectName: event.target.value })}
              placeholder="اسم المشروع والموقع"
              className="h-11 rounded-lg border border-line bg-input px-3 text-sm"
            />
            <input
              aria-label="خانة التوقيع"
              value={reportSettings.signatureLabel}
              onChange={(event) => setReportSettings({ signatureLabel: event.target.value })}
              placeholder="اعتماد المهندس المشرف"
              className="h-11 rounded-lg border border-line bg-input px-3 text-sm"
            />
          </div>
        ) : null}

        {blocks.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <GitCompare className="size-4 text-teal" />
            <span className="text-xs font-bold">مقارنة كميات وتكاليف «{active.name}» مع:</span>
            <select
              aria-label="التقرير المقارن"
              value={compareId}
              onChange={(event) => setCompareId(event.target.value)}
              className="h-9 rounded-lg border border-line bg-input px-3 text-xs font-semibold"
            >
              <option value="">— اختر كتلة للمقارنة —</option>
              {blocks
                .filter((block) => block.id !== active.id)
                .map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.name}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
      </Card>

      <Card className="p-4 print-area">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-navy px-4 py-3 text-on-navy">
            <div className="text-xs text-on-navy/80">الإجمالي العام للكتلة ({active.name})</div>
            <div className="num mt-1 text-2xl font-bold">{fmt(breakdown.total)}</div>
            <div className="mt-0.5 text-[11px] text-on-navy/75">
              إجمالي {active.lines.length} بنداً تفصيلياً
            </div>
          </div>

          <div className="rounded-lg border border-line bg-band/50 px-4 py-3">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="flex items-center gap-1 font-semibold">
                <Building2 className="size-3.5 text-teal" />
                الأعمال المعمارية والإكساء
              </span>
              <span className="num font-bold text-teal">
                {breakdown.total > 0 ? Math.round((breakdown.archTotal / breakdown.total) * 100) : 0}%
              </span>
            </div>
            <div className="num mt-1 text-xl font-bold text-ink">{fmt(breakdown.archTotal)}</div>
            <div className="mt-0.5 text-[11px] text-muted">{breakdown.archCount} بند معماري</div>
          </div>

          <div className="rounded-lg border border-line bg-band/50 px-4 py-3">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="flex items-center gap-1 font-semibold">
                <HardHat className="size-3.5 text-teal" />
                الأعمال الإنشائية والترابية
              </span>
              <span className="num font-bold text-teal">
                {breakdown.total > 0 ? Math.round((breakdown.structTotal / breakdown.total) * 100) : 0}%
              </span>
            </div>
            <div className="num mt-1 text-xl font-bold text-ink">{fmt(breakdown.structTotal)}</div>
            <div className="mt-0.5 text-[11px] text-muted">{breakdown.structCount} بند إنشائي وترابي</div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 className="text-lg font-bold">جدول حصر الكميات والتكاليف: {active.name}</h2>
            <p className="text-xs text-muted">
              تاريخ التوليد: {new Date(active.createdAt).toLocaleDateString("ar-EG")}
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-1.5">
            <Btn tone="ghost" onClick={() => loadBlock(active.id)}>
              تعديل في اللوحة
            </Btn>
            <Btn
              tone="primary"
              onClick={() => void downloadFullWorkbookXlsx(active, reportSettings)}
            >
              <FileSpreadsheet className="size-4" />
              تصدير المصنف الكامل (XLSX)
            </Btn>
            <Btn
              tone="ghost"
              onClick={() => void downloadReportXlsx(active, "detail", reportSettings)}
            >
              <Download className="size-4" />
              التفاصيل فقط
            </Btn>
            <Btn
              tone="ghost"
              onClick={() => void downloadReportXlsx(active, "aggregate", reportSettings)}
            >
              <Download className="size-4" />
              التجميع فقط
            </Btn>
            <Btn tone="ghost" onClick={() => void printReport(active, reportSettings)}>
              <Printer className="size-4" />
              طباعة / PDF
            </Btn>
            <Btn tone="danger" onClick={() => setPendingDeleteId(active.id)}>
              <Trash2 className="size-4" />
              حذف
            </Btn>
          </div>
        </div>

        {hasStructMix && structMetrics ? (
          <div className="mb-4 rounded-lg border border-teal/40 bg-teal/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-teal">
              <Layers className="size-4" />
              <span>
                خلاصة توريد المواد الخام للبيتون (لإجمالي {fmtLoose(structMetrics.totalRcConcrete)} م³ مسلح +{" "}
                {fmtLoose(structMetrics.totalBlinding)} م³ نظافة + الهدر):
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className="rounded bg-card p-2 text-center shadow-2xs">
                <div className="text-[11px] text-muted">إسمنت بورتلاندي</div>
                <div className="num text-sm font-bold text-ink">
                  {fmtLoose(structMetrics.mix.cementTons)} طن
                </div>
                <div className="num text-[11px] font-semibold text-teal">
                  ({structMetrics.mix.cementBags50kg} كيس 50 كغ)
                </div>
              </div>
              <div className="rounded bg-card p-2 text-center shadow-2xs">
                <div className="text-[11px] text-muted">رمل مغسول</div>
                <div className="num text-sm font-bold text-ink">
                  {fmtLoose(structMetrics.mix.sandM3)} م³
                </div>
              </div>
              <div className="rounded bg-card p-2 text-center shadow-2xs">
                <div className="text-[11px] text-muted">بحص (زلط متدرج)</div>
                <div className="num text-sm font-bold text-ink">
                  {fmtLoose(structMetrics.mix.gravelM3)} م³
                </div>
              </div>
              <div className="rounded bg-card p-2 text-center shadow-2xs">
                <div className="text-[11px] text-muted">ماء الخلط النظيف</div>
                <div className="num text-sm font-bold text-ink">
                  ~{fmtLoose(structMetrics.mix.waterLiters)} لتر
                </div>
              </div>
              <div className="rounded bg-card p-2 text-center shadow-2xs">
                <div className="text-[11px] text-muted">إجمالي حديد التسليح الصافي</div>
                <div className="num text-sm font-bold text-teal">
                  {fmtLoose(structMetrics.totalSteelTon)} طن
                </div>
                <div className="num text-[11px] text-muted">
                  ({fmtLoose(structMetrics.totalSteelKg)} كغ)
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="no-print mb-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-lg border border-line bg-band p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDiscipline("all")}
                className={
                  "rounded-md px-3 py-1.5 transition " +
                  (discipline === "all" ? "bg-card text-teal shadow-2xs" : "text-muted hover:text-ink")
                }
              >
                كل البنود ({active.lines.length})
              </button>
              <button
                type="button"
                onClick={() => setDiscipline("arch")}
                className={
                  "rounded-md px-3 py-1.5 transition " +
                  (discipline === "arch" ? "bg-card text-teal shadow-2xs" : "text-muted hover:text-ink")
                }
              >
                المعماري والإكساء ({breakdown.archCount})
              </button>
              <button
                type="button"
                onClick={() => setDiscipline("structural")}
                className={
                  "rounded-md px-3 py-1.5 transition " +
                  (discipline === "structural"
                    ? "bg-card text-teal shadow-2xs"
                    : "text-muted hover:text-ink")
                }
              >
                الإنشائي والترابي ({breakdown.structCount})
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_12rem_12rem]">
            <input
              aria-label="بحث في التقرير"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="بحث سريع بالكود أو الوصف أو اسم الفراغ / العنصر..."
              className="h-10 rounded-lg border border-line bg-input px-3 text-sm"
            />
            <select
              aria-label="فرز التقرير"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              className="h-10 rounded-lg border border-line bg-input px-3 text-xs font-semibold"
            >
              <option value="code">فرز حسب الكود</option>
              <option value="desc">فرز حسب الوصف</option>
              <option value="total">فرز حسب التكلفة (الأعلى أولاً)</option>
            </select>
            <select
              aria-label="تجميع التقرير"
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as typeof groupBy)}
              className="h-10 rounded-lg border border-line bg-input px-3 text-xs font-semibold"
            >
              <option value="none">العرض التسلسلي القياسي</option>
              <option value="section">ترتيب حسب نوع الفراغ / العنصر</option>
            </select>
          </div>
        </div>

        <LineTable
          title="1. الجدول التفصيلي (حسب كل فراغ وعنصر إنشائي)"
          lines={visibleLines}
          total={visibleLines.reduce((sum, line) => sum + line.total, 0)}
        />

        <div className="mt-6">
          <LineTable
            title="2. جدول الكميات التجميعي للكتلة (BOQ Summary — دمج البنود المتشابهة)"
            lines={visibleAggregate}
            total={visibleAggregate.reduce((sum, line) => sum + line.total, 0)}
            grouped
          />
        </div>
      </Card>

      {compared ? <ComparisonCard current={active} compared={compared} /> : null}

      <ConfirmDialog
        open={pendingDeleteId === active.id}
        title="حذف تقرير الكتلة؟"
        message={`سيتم حذف تقرير «${active.name}» نهائياً من قائمة التقارير. لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف التقرير"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          deleteBlock(active.id);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}

function filterAndSortLines(
  lines: ReportLine[],
  query: string,
  discipline: DisciplineFilter,
  sortBy: "code" | "desc" | "total",
  groupBy: "none" | "section",
): ReportLine[] {
  const needle = query.trim().toLocaleLowerCase();
  const filtered = lines.filter((line) => {
    if (discipline === "arch" && isStructuralCode(line.code)) return false;
    if (discipline === "structural" && !isStructuralCode(line.code)) return false;
    if (!needle) return true;
    return [line.code, line.desc, line.spaceName, line.spaceType, line.unit].some((value) =>
      value.toLocaleLowerCase().includes(needle),
    );
  });

  return [...filtered].sort((a, b) => {
    if (groupBy === "section" && a.spaceType !== b.spaceType)
      return a.spaceType.localeCompare(b.spaceType, "ar");
    if (sortBy === "total") return b.total - a.total;
    return (sortBy === "desc" ? a.desc : a.code).localeCompare(
      sortBy === "desc" ? b.desc : b.code,
      "ar",
    );
  });
}

function reportRows(
  block: BlockRecord,
  which: "detail" | "aggregate",
  settings: ReportSettings,
): (string | number)[][] {
  const headers = [
    "كود البند",
    "الفراغ / العنصر",
    "التصنيف / النوع",
    "وصف البند",
    "وحدة القياس",
    "الكمية النهائية",
    "السعر الإفرادي",
    "السعر الإجمالي للبند",
    "الكمية الصافية",
    "نسبة الهدر %",
    "كمية الهدر",
  ];
  
  const lines = which === "detail" ? block.lines : block.aggregate;
  
  return [
    [
      settings.companyName || "المكتب الهندسي / الشركة",
      settings.projectName || "مشروع حصر الكميات",
      `التاريخ: ${new Date().toLocaleDateString("ar-EG")}`,
    ],
    [
      `تقرير ${which === "detail" ? "التفاصيل" : "التجميع"}: ${block.name}`,
      "",
      `الاعتماد: ${settings.signatureLabel || "اعتماد المهندس"}`,
    ],
    [CREATOR_SIGNATURE, COPYRIGHT_TEXT, ""],
    [],
    [],
    headers,
    ...lines.map((line) => [
      line.code,
      which === "aggregate" ? "" : line.spaceName,
      which === "aggregate" ? "" : line.spaceType,
      line.desc,
      line.unit,
      line.finalQty,
      line.price,
      line.total,
      line.baseQty,
      line.wastePct,
      line.wasteQty,
    ]),
    [],
    ["الإجمالي العام", "", "", "", "", "", "", block.detailTotal, "", "", ""],
  ];
}

function styleBoqSheet(sheet: XLSX.WorkSheet, endRow: number) {
  const border = {
    top: { style: "thin", color: { rgb: "CBD5E1" } },
    bottom: { style: "thin", color: { rgb: "CBD5E1" } },
    left: { style: "thin", color: { rgb: "CBD5E1" } },
    right: { style: "thin", color: { rgb: "CBD5E1" } },
  };

  const metaStyle = {
    font: { name: "Arial", sz: 11, bold: true, color: { rgb: "1F3A4D" } },
    alignment: { horizontal: "right", vertical: "center" },
  };

  const headerStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "1F3A4D" } },
    font: { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border,
  };

  const textStyle = {
    font: { name: "Arial", sz: 10, color: { rgb: "1F2D3A" } },
    alignment: { horizontal: "right", vertical: "center", wrapText: true },
    border,
  };

  const centerTextStyle = {
    ...textStyle,
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };

  const numStyle = {
    font: { name: "Arial", sz: 10, color: { rgb: "1F2D3A" } },
    alignment: { horizontal: "center", vertical: "center" },
    border,
    numFmt: "#,##0.00",
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

  for (let row = 1; row <= endRow; row += 1) {
    for (let col = 0; col < 11; col += 1) {
      const cell = XLSX.utils.encode_cell({ r: row - 1, c: col });
      if (!sheet[cell]) continue;
      
      if (row <= 3) {
        sheet[cell].s = metaStyle;
      } else if (row === 6) {
        sheet[cell].s = headerStyle;
      } else if (row === endRow) {
        sheet[cell].s = col === 7 ? totalNumStyle : totalStyle;
      } else if (row > 6) {
        if (col === 0 || col === 4) {
          sheet[cell].s = centerTextStyle; 
        } else if (col === 1 || col === 2 || col === 3) {
          sheet[cell].s = textStyle; 
        } else {
          sheet[cell].s = numStyle; 
        }
      }
    }
  }

  sheet["!cols"] = [
    { wch: 15 },
    { wch: 22 },
    { wch: 18 },
    { wch: 65 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
  ];

  sheet["!rows"] = [
    { hpt: 25 },
    { hpt: 25 },
    { hpt: 25 },
    { hpt: 10 },
    { hpt: 10 },
    { hpt: 35 },
    ...Array.from({ length: Math.max(0, endRow - 7) }, () => ({ hpt: 45 })),
    { hpt: 30 },
  ];

  sheet["!merges"] = [
    { s: { r: endRow - 1, c: 0 }, e: { r: endRow - 1, c: 6 } }
  ];

  sheet["!autofilter"] = { ref: `A6:K${Math.max(6, endRow - 2)}` };
  sheet["!freeze"] = { xSplit: 0, ySplit: 6 };
  sheet["!sheetViews"] = [{ rightToLeft: true }];
}

async function downloadReportXlsx(
  block: BlockRecord,
  which: "detail" | "aggregate",
  settings: ReportSettings,
): Promise<void> {
  const rows = reportRows(block, which, settings);
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  styleBoqSheet(sheet, rows.length);
  const workbook = XLSX.utils.book_new();
  // @ts-ignore
  Object.assign(workbook, { Views: [{ RTL: true }] });
  
  XLSX.utils.book_append_sheet(workbook, sheet, which === "detail" ? "التفاصيل" : "التجميع");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  await downloadBinary(
    `${which === "detail" ? "تقرير" : "تجميع"}-${block.name}.xlsx`,
    new Uint8Array(output),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

async function downloadFullWorkbookXlsx(
  block: BlockRecord,
  settings: ReportSettings,
): Promise<void> {
  const workbook = XLSX.utils.book_new();
  Object.assign(workbook, { Views: [{ RTL: true }] });

  // الورقة 1: التفاصيل
  const detailRows = reportRows(block, "detail", settings);
  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
  styleBoqSheet(detailSheet, detailRows.length);
  XLSX.utils.book_append_sheet(workbook, detailSheet, "1- التفاصيل");

  // الورقة 2: التجميع
  const aggRows = reportRows(block, "aggregate", settings);
  const aggSheet = XLSX.utils.aoa_to_sheet(aggRows);
  styleBoqSheet(aggSheet, aggRows.length);
  XLSX.utils.book_append_sheet(workbook, aggSheet, "2- التجميع الكلي");

  // الورقة 3: المواد الأولية للبيتون والتسليح
  if (block.snapshot) {
    const kpi = structuralKpis(block.snapshot);
    if (kpi.totalRcConcrete > 0 || kpi.totalBlinding > 0 || kpi.totalSteelKg > 0) {
      const mixRows = [
        ["كشف المواد الأولية اللازمة للأعمال البيتونية والتسليح", block.name],
        [],
        ["المادة / البند", "الكمية المطلوبة", "الوحدة", "ملاحظات هندسية"],
        ["بيتون مسلح صافي", kpi.totalRcConcrete, "م³", "قبل إضافة الهدر"],
        ["بيتون نظافة صافي", kpi.totalBlinding, "م³", "قبل إضافة الهدر"],
        ["قالب خشبي (طوبار)", kpi.totalFormwork, "م²", "مساحة الأوجه الملامسة للبيتون"],
        ["حديد تسليح صافي", kpi.totalSteelTon, "طن", `${kpi.totalSteelKg} كغ`],
        ["إسمنت بورتلاندي للخلط", kpi.mix.cementTons, "طن", `يعادل ${kpi.mix.cementBags50kg} كيس (وزن 50 كغ)`],
        ["رمل مغسول للخلط", kpi.mix.sandM3, "م³", "شامل نسبة الهدر"],
        ["بحص متدرج للخلط", kpi.mix.gravelM3, "م³", "شامل نسبة الهدر"],
        ["ماء الخلط", kpi.mix.waterLiters, "لتر", "تقديري حسب العيار"],
      ];
      const mixSheet = XLSX.utils.aoa_to_sheet(mixRows);
      
      const metaStyle = { font: { name: "Arial", sz: 12, bold: true, color: { rgb: "1F3A4D" } }, alignment: { horizontal: "right" } };
      const headerStyle = { fill: { patternType: "solid", fgColor: { rgb: "1F3A4D" } }, font: { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" } };
      const textStyle = { font: { name: "Arial", sz: 11 }, alignment: { horizontal: "right", vertical: "center" } };
      const numStyle = { font: { name: "Arial", sz: 11, bold: true }, alignment: { horizontal: "center", vertical: "center" }, numFmt: "#,##0.00" };

      for (let r = 0; r < mixRows.length; r++) {
        for (let c = 0; c < 4; c++) {
          const cell = XLSX.utils.encode_cell({ r, c });
          if (!mixSheet[cell]) continue;
          if (r === 0) mixSheet[cell].s = metaStyle;
          else if (r === 2) mixSheet[cell].s = headerStyle;
          else if (r > 2) mixSheet[cell].s = (c === 1) ? numStyle : (c === 2 ? { ...textStyle, alignment: { horizontal: "center", vertical: "center" } } : textStyle);
        }
      }

      mixSheet["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 14 }, { wch: 36 }];
      mixSheet["!rows"] = [{ hpt: 30 }, { hpt: 10 }, { hpt: 30 }, ...Array.from({ length: 8 }, () => ({ hpt: 25 }))];
      mixSheet["!sheetViews"] = [{ rightToLeft: true }];
      XLSX.utils.book_append_sheet(workbook, mixSheet, "3- مواد البيتون والحديد");
    }
  }

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  await downloadBinary(
    `كشف-حصر-شامل-${block.name}.xlsx`,
    new Uint8Array(output),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

async function printReport(block: BlockRecord, settings: ReportSettings): Promise<void> {
  const html = printHtml(block, settings);
  try {
    if (Capacitor.isNativePlatform()) {
      await NativePrinter.printHtml({ name: `تقرير-${block.name}`, html });
    } else {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("iframe-failed");

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 250);
    }
  } catch (err) {
    console.error(err);
    window.alert("حدث خطأ أثناء محاولة فتح نافذة الطباعة.");
  }
}

function printHtml(block: BlockRecord, settings: ReportSettings): string {
  const esc = (value: string | number) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
    );

  const rows = block.lines
    .map(
      (line) =>
        `<tr><td><strong>${esc(line.code)}</strong><br><span class="desc">${esc(
          line.desc || line.code,
        )}</span></td><td>${esc(line.spaceName)}</td><td>${esc(line.spaceType)}</td><td>${esc(
          line.unit,
        )}</td><td>${esc(fmt(line.finalQty))}</td><td>${esc(fmt(line.price))}</td><td>${esc(
          fmt(line.total),
        )}</td></tr>`,
    )
    .join("");

  const kpi = block.snapshot ? structuralKpis(block.snapshot) : null;
  const mixSection =
    kpi && (kpi.totalRcConcrete > 0 || kpi.totalBlinding > 0)
      ? `<div style="margin-top:18px;padding:10px;border:1px solid #1f3a4d;background:#f8fafc">
          <strong>خلاصة المواد الخام للخلطة البيتونية والحديد:</strong>
          إسمنت: ${esc(fmtLoose(kpi.mix.cementTons))} طن (${esc(kpi.mix.cementBags50kg)} كيس) |
          رمل: ${esc(fmtLoose(kpi.mix.sandM3))} م³ |
          بحص: ${esc(fmtLoose(kpi.mix.gravelM3))} م³ |
          ماء: ${esc(fmtLoose(kpi.mix.waterLiters))} لتر |
          حديد تسليح: ${esc(fmtLoose(kpi.totalSteelTon))} طن
        </div>`
      : "";

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(
    block.name,
  )}</title><style>body{font-family:Arial,sans-serif;direction:rtl;padding:24px;color:#1f2d3a}h1{font-size:20px;margin-bottom:4px}.meta{display:flex;justify-content:space-between;border-bottom:2px solid #1f3a4d;padding-bottom:12px;margin-bottom:14px}.signature{margin-top:38px;border-top:1px solid #9aa8b5;width:220px;padding-top:8px}.creator{margin-top:28px;border-top:1px solid #d5dde5;padding-top:10px;color:#5c6b7a;font-size:10px;text-align:center}.desc{display:inline-block;margin-top:4px;font-weight:normal;line-height:1.45}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #9aa8b5;padding:6px;text-align:right;vertical-align:top}th{background:#1f3a4d;color:#fff}tfoot td{font-weight:bold;background:#f4f7fa}@media print{body{padding:0}}</style></head><body><div class="meta"><div><strong>${esc(
    settings.companyName || "المكتب الهندسي / الشركة",
  )}</strong><br>${esc(
    settings.projectName || "مشروع حصر الكميات الهندسي",
  )}</div><div>التاريخ: ${esc(
    new Date().toLocaleDateString("ar-EG"),
  )}</div></div><h1>جدول حصر كميات وتكاليف الكتلة: ${esc(
    block.name,
  )}</h1><p>الإجمالي العام: <strong>${esc(
    fmt(block.detailTotal),
  )}</strong></p><table><thead><tr><th>كود البند والوصف</th><th>الفراغ / العنصر</th><th>التصنيف</th><th>الوحدة</th><th>الكمية النهائية</th><th>السعر الإفرادي</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="6">الإجمالي العام للكتلة</td><td>${esc(
    fmt(block.detailTotal),
  )}</td></tr></tfoot></table>${mixSection}<div class="signature">${esc(
    settings.signatureLabel || "اعتماد المهندس",
  )}<br><br>التوقيع: __________________</div><div class="creator">${esc(
    CREATOR_SIGNATURE,
  )}<br>${esc(COPYRIGHT_TEXT)}</div></body></html>`;
}

function ComparisonCard({ current, compared }: { current: BlockRecord; compared: BlockRecord }) {
  const rows = compareRows(current.aggregate, compared.aggregate);
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">مقارنة التقارير الهندسية</h2>
          <p className="text-xs text-muted">
            «{current.name}» مقابل «{compared.name}» — القيم الموجبة تعني زيادة في التقرير الحالي.
          </p>
        </div>
        <span className="num rounded-lg bg-navy px-3 py-2 text-sm font-bold text-on-navy">
          فرق التكلفة: {fmt(rows.reduce((sum, row) => sum + row.costDelta, 0))}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr className="bg-slate text-on-navy">
              <th className="border border-line px-2 py-2 text-right">الكود</th>
              <th className="border border-line px-2 py-2 text-right">الوصف</th>
              <th className="border border-line px-2 py-2">كمية {current.name}</th>
              <th className="border border-line px-2 py-2">كمية {compared.name}</th>
              <th className="border border-line px-2 py-2">فرق الكمية</th>
              <th className="border border-line px-2 py-2">فرق التكلفة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className={row.qtyDelta || row.costDelta ? "bg-amber-bg" : ""}>
                <td className="num border border-line px-2 py-2 font-semibold">{row.code}</td>
                <td className="border border-line px-2 py-2">{row.desc}</td>
                <td className="num border border-line px-2 py-2">{fmt(row.currentQty)}</td>
                <td className="num border border-line px-2 py-2">{fmt(row.comparedQty)}</td>
                <td
                  className={`num border border-line px-2 py-2 font-bold ${
                    row.qtyDelta > 0 ? "text-danger" : row.qtyDelta < 0 ? "text-ok" : ""
                  }`}
                >
                  {row.qtyDelta > 0 ? "+" : ""}
                  {fmt(row.qtyDelta)}
                </td>
                <td
                  className={`num border border-line px-2 py-2 font-bold ${
                    row.costDelta > 0 ? "text-danger" : row.costDelta < 0 ? "text-ok" : ""
                  }`}
                >
                  {row.costDelta > 0 ? "+" : ""}
                  {fmt(row.costDelta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function compareRows(current: ReportLine[], compared: ReportLine[]) {
  const map = new Map<
    string,
    { code: string; desc: string; currentQty: number; comparedQty: number; costDelta: number }
  >();
  current.forEach((line) =>
    map.set(`${line.code}|${line.unit}`, {
      code: line.code,
      desc: line.desc,
      currentQty: line.finalQty,
      comparedQty: 0,
      costDelta: line.total,
    }),
  );
  compared.forEach((line) => {
    const key = `${line.code}|${line.unit}`;
    const row = map.get(key) ?? {
      code: line.code,
      desc: line.desc,
      currentQty: 0,
      comparedQty: 0,
      costDelta: 0,
    };
    row.comparedQty += line.finalQty;
    row.costDelta -= line.total;
    map.set(key, row);
  });
  return [...map.values()]
    .map((row) => ({ ...row, qtyDelta: row.currentQty - row.comparedQty }))
    .sort((a, b) => Math.abs(b.costDelta) - Math.abs(a.costDelta));
}

function LineTable({
  title,
  lines,
  total,
  grouped,
}: {
  title: string;
  lines: ReportLine[];
  total: number;
  grouped?: boolean;
}) {
  return (
    <div>
      <h3 className="mb-2 rounded-lg bg-navy px-3 py-2 text-sm font-bold text-on-navy">{title}</h3>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <thead>
            <tr className="bg-slate text-on-navy">
              {[
                "الكود",
                ...(grouped ? [] : ["الفراغ / العنصر", "النوع"]),
                "الوصف",
                "الوحدة",
                "النهائية",
                "السعر",
                "الإجمالي",
                "الأساس",
                "الهدر %",
                "كمية الهدر",
              ].map((head) => (
                <th key={head} className="border border-line px-2 py-2 text-center font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr
                key={`${line.code}-${index}`}
                className={
                  line.missing
                    ? "bg-danger-bg"
                    : isStructuralCode(line.code)
                      ? "bg-teal/5"
                      : index % 2
                        ? "bg-band"
                        : ""
                }
              >
                <td className="num border border-line px-2 py-2 font-semibold">{line.code}</td>
                
                {!grouped ? <td className="border border-line px-2 py-2">{line.spaceName}</td> : null}
                {!grouped ? <td className="border border-line px-2 py-2">{line.spaceType}</td> : null}
                
                <td className="border border-line px-2 py-2 leading-relaxed">{line.desc}</td>
                <td className="border border-line px-2 py-2 text-center">{line.unit}</td>
                <td className="num border border-line px-2 py-2 text-end font-semibold">
                  {fmt(line.finalQty)}
                </td>
                <td className="num border border-line px-2 py-2 text-end">{fmt(line.price)}</td>
                <td className="num border border-line px-2 py-2 text-end font-bold">
                  {fmt(line.total)}
                </td>
                <td className="num border border-line px-2 py-2 text-end">{fmt(line.baseQty)}</td>
                <td className="num border border-line px-2 py-2 text-end">{fmt(line.wastePct)}</td>
                <td className="num border border-line px-2 py-2 text-end">{fmt(line.wasteQty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {lines.map((line, index) => (
          <article
            key={`${line.code}-m-${index}`}
            className={
              "rounded-lg border border-line p-3 " +
              (line.missing
                ? "bg-danger-bg"
                : isStructuralCode(line.code)
                  ? "border-teal/40 bg-teal/5"
                  : "bg-band")
            }
          >
            <div className="flex items-center justify-between">
              <span className="num text-xs font-bold text-teal">{line.code}</span>
              <span className="rounded bg-card px-2 py-0.5 text-[11px] font-semibold">
                {line.unit || "—"}
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold leading-relaxed">{line.desc}</p>
            {!grouped && (line.spaceName || line.spaceType) ? (
              <p className="mt-1 text-xs text-muted">
                {line.spaceName}
                {line.spaceType ? ` — ${line.spaceType}` : ""}
              </p>
            ) : null}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-2 text-xs">
              <span className="num">الصافي: {fmt(line.baseQty)}</span>
              <span className="num">
                الهدر: {fmt(line.wastePct)}% ({fmt(line.wasteQty)})
              </span>
              <span className="num font-semibold">النهائية: {fmt(line.finalQty)}</span>
              <span className="num">السعر: {fmt(line.price)}</span>
              <span className="num col-span-2 text-sm font-bold text-teal">
                الإجمالي: {fmt(line.total)}
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between rounded-lg bg-band px-3 py-3 font-bold">
        <span>مجموع هذا الجدول</span>
        <span className="num text-base">{fmt(total)}</span>
      </div>
    </div>
  );
}
