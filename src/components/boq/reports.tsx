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
            <div
