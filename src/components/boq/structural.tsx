import { useState } from "react";
import {
  Building2,
  Calculator,
  Copy,
  HardHat,
  Layers,
  Mountain,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  calcEarthworkRow,
  calcStructuralRow,
  DEFAULT_STRUCTURAL_PRICING,
  fmtLoose,
  numExpr,
  STRUCTURAL_KIND_LABELS,
  structuralKpis,
} from "@/lib/boq/engine";
import { useBoq } from "@/lib/boq/store";
import type {
  EarthworkRow,
  RebarBarGroup,
  StructuralElementKind,
  StructuralRow,
} from "@/lib/boq/types";
import { Btn, Card, ExprField, Field, TextField } from "./ui";

const ELEMENT_KINDS: { id: StructuralElementKind; label: string; defaultRatio: string }[] = [
  { id: "footing", label: "قاعدة مسلحة", defaultRatio: "90" },
  { id: "raft", label: "لبشة / حصيرة", defaultRatio: "110" },
  { id: "neck", label: "رقبة عمود", defaultRatio: "160" },
  { id: "column", label: "عمود", defaultRatio: "180" },
  { id: "beam", label: "جسر / كمرة", defaultRatio: "150" },
  { id: "slab", label: "بلاطة / سقف", defaultRatio: "120" },
  { id: "wall", label: "جدار استنادي", defaultRatio: "130" },
];

const REBAR_DIAMETERS = ["8", "10", "12", "14", "16", "18", "20", "22", "25", "28", "32"];

export function StructuralView() {
  const [showPricing, setShowPricing] = useState(false);
  const panel = useBoq((s) => s.panel);
  const setBlockField = useBoq((s) => s.setBlockField);
  const addStructuralElement = useBoq((s) => s.addStructuralElement);
  const updateStructuralElement = useBoq((s) => s.updateStructuralElement);
  const duplicateStructuralElement = useBoq((s) => s.duplicateStructuralElement);
  const removeStructuralElement = useBoq((s) => s.removeStructuralElement);
  const addEarthwork = useBoq((s) => s.addEarthwork);
  const updateEarthwork = useBoq((s) => s.updateEarthwork);
  const removeEarthwork = useBoq((s) => s.removeEarthwork);
  const setStructuralPricing = useBoq((s) => s.setStructuralPricing);
  const generate = useBoq((s) => s.generate);

  const elements = panel.structuralElements ?? [];
  const earthworks = panel.earthworks ?? [];
  const pricing = panel.structuralPricing ?? DEFAULT_STRUCTURAL_PRICING;
  const kpi = structuralKpis(panel);

  return (
    <div className="space-y-4 pb-8">
      {/* 1. رأس القسم الإنشائي وربط الكتلة */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <HardHat className="size-5 text-teal" />
              حاسبة الأعمال الإنشائية والترابية (بيتون • طوبار • حديد • حفر)
            </h2>
            <p className="text-xs text-muted">
              تُدمج جميع البنود الإنشائية المحسوبة هنا تلقائياً في التقرير النهائي للكتلة «
              {panel.blockName || "بدون اسم"}».
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn tone="ghost" onClick={() => setShowPricing(!showPricing)}>
              <Settings2 className="size-4 text-teal" />
              {showPricing ? "إخفاء الأسعار والعيارات" : "ضبط الأسعار وعيار البيتون"}
            </Btn>
            <Btn tone="primary" onClick={generate}>
              <Calculator className="size-4" />
              حساب وتوليد التقرير الموحد
            </Btn>
          </div>
        </div>

        {!panel.blockName.trim() ? (
          <div className="mt-3 max-w-sm">
            <TextField
              label="اسم الكتلة / المشروع (مطلوب لحفظ التقرير)"
              value={panel.blockName}
              placeholder="مثال: البلوك السكني A"
              onChange={(val) => setBlockField("blockName", val)}
            />
          </div>
   

        {showPricing ? (
          <div className="mt-4 rounded-lg border border-line bg-band/40 p-3">
            <h3 className="mb-2 text-xs font-bold text-teal">
              إعدادات الأسعار الإفرادية ونسب الهدر وعيار الخلطة
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              <Field
                label="سعر م³ بيتون مسلح"
                value={String(pricing.rcConcretePrice)}
                onChange={(v) => setStructuralPricing({ rcConcretePrice: Number(v) || 0 })}
              />
              <Field
                label="سعر م³ بيتون نظافة"
                value={String(pricing.blindingPrice)}
                onChange={(v) => setStructuralPricing({ blindingPrice: Number(v) || 0 })}
              />
              <Field
                label="سعر م² القالب الخشبي"
                value={String(pricing.formworkPrice)}
                onChange={(v) => setStructuralPricing({ formworkPrice: Number(v) || 0 })}
              />
              <Field
                label="سعر طن الحديد"
                value={String(pricing.steelTonPrice)}
                onChange={(v) => setStructuralPricing({ steelTonPrice: Number(v) || 0 })}
              />
              <Field
                label="سعر م³ الحفر"
                value={String(pricing.excavationPrice)}
                onChange={(v) => setStructuralPricing({ excavationPrice: Number(v) || 0 })}
              />
              <Field
                label="سعر م³ الردم/السواتر"
                value={String(pricing.backfillPrice)}
                onChange={(v) => setStructuralPricing({ backfillPrice: Number(v) || 0 })}
              />
              <Field
                label="هدر البيتون %"
                value={String(pricing.concreteWastePct)}
                onChange={(v) => setStructuralPricing({ concreteWastePct: Number(v) || 0 })}
              />
              <Field
                label="هدر الحديد %"
                value={String(pricing.steelWastePct)}
                onChange={(v) => setStructuralPricing({ steelWastePct: Number(v) || 0 })}
              />
              <Field
                label="عيار الإسمنت (كغ/م³)"
                value={String(pricing.cementGradeKg)}
                onChange={(v) => setStructuralPricing({ cementGradeKg: Number(v) || 350 })}
              />
            </div>
          </div>
        ) : null}
      </Card>

      {/* 2. شريط المؤشرات الإنشائية الفورية (KPIs) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatBox label="بيتون مسلح صافي" value={`${fmtLoose(kpi.totalRcConcrete)} م³`} />
        <StatBox label="بيتون نظافة" value={`${fmtLoose(kpi.totalBlinding)} م³`} />
        <StatBox label="القالب الخشبي (طوبار)" value={`${fmtLoose(kpi.totalFormwork)} م²`} />
        <StatBox
          label="حديد التسليح"
          value={`${fmtLoose(kpi.totalSteelTon)} طن (${fmtLoose(kpi.totalSteelKg)} كغ)`}
          highlight
        />
        <StatBox label="إجمالي الحفر" value={`${fmtLoose(kpi.totalExcavation)} م³`} />
        <StatBox label="الردم والسواتر" value={`${fmtLoose(kpi.totalBackfillOrBerm)} م³`} />
      </div>

      {/* 3. بطاقة تحليل المواد الأولية للخلطة البيتونية (إسمنت، رمل، بحص، ماء) */}
      {kpi.totalRcConcrete > 0 || kpi.totalBlinding > 0 ? (
        <Card className="border-teal/40 bg-teal/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-teal" />
              <strong className="text-xs text-ink">
                تحليل المواد الأولية اللازمة لصب البيتون (شامل {pricing.concreteWastePct}% هدر):
              </strong>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="num rounded bg-card px-2.5 py-1 font-bold text-teal shadow-xs">
                إسمنت: {fmtLoose(kpi.mix.cementTons)} طن ({kpi.mix.cementBags50kg} كيس 50 كغ)
              </span>
              <span className="num rounded bg-card px-2.5 py-1 font-semibold">
                رمل: {fmtLoose(kpi.mix.sandM3)} م³
              </span>
              <span className="num rounded bg-card px-2.5 py-1 font-semibold">
                بحص (زلط): {fmtLoose(kpi.mix.gravelM3)} م³
              </span>
              <span className="num rounded bg-card px-2.5 py-1 text-muted">
                ماء الخلط: ~{fmtLoose(kpi.mix.waterLiters)} لتر
              </span>
            </div>
          </div>
        </Card>
      ) : null}

      {/* 4. أزرار الإضافة السريعة للعناصر الإنشائية */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
            <Building2 className="size-4 text-teal" />
            إضافة عنصر بيتوني مسلح:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ELEMENT_KINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addStructuralElement(item.id)}
                className="rounded-lg border border-line bg-band px-3 py-1.5 text-xs font-bold hover:border-teal hover:bg-teal hover:text-on-teal"
              >
                + {item.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 5. قائمة العناصر الإنشائية */}
      {elements.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted">
            لا توجد عناصر بيتونية مضافة بعد. اضغط على أحد الأزرار أعلاه (+ قاعدة، + عمود، + جسر، + سقف) للبدء.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {elements.map((row, index) => (
            <StructuralRowCard
              key={row.id}
              row={row}
              index={index}
              onChange={(patch) => updateStructuralElement(row.id, patch)}
              onDuplicate={() => duplicateStructuralElement(row.id)}
              onRemove={() => removeStructuralElement(row.id)}
            />
          ))}
        </div>
      )}

      {/* 6. قسم الأعمال الترابية والحفر والسواتر (Earthworks & Berms) */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-bold">
              <Mountain className="size-5 text-teal" />
              الأعمال الترابية العامة والسواتر (حفر • ردم • سواتر بميول جانبية)
            </h3>
            <p className="text-xs text-muted">
              يدعم المقاطع المستطيلة أو شبه المنحرفة ذات الميول الجانبية (بالدرجات) مع حساب الانتفاش والدمك.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Btn tone="navy" onClick={() => addEarthwork("excavation")}>
              <Plus className="size-4" />
              حفر عام / خندق
            </Btn>
            <Btn tone="ghost" onClick={() => addEarthwork("backfill")}>
              <Plus className="size-4" />
              ردم وتشكيل
            </Btn>
            <Btn tone="ghost" onClick={() => addEarthwork("berm")}>
              <Plus className="size-4" />
              ساتر ترابي بميول
            </Btn>
          </div>
        </div>

        {earthworks.length === 0 ? (
          <p className="text-xs text-muted">لا توجد بنود أعمال ترابية عامة مضافة.</p>
        ) : (
          <div className="space-y-3">
            {earthworks.map((ew, idx) => {
              const res = calcEarthworkRow(ew);
              return (
                <div key={ew.id} className="rounded-lg border border-line bg-band/30 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={ew.kind}
                        onChange={(e) =>
                          updateEarthwork(ew.id, { kind: e.target.value as EarthworkRow["kind"] })
                        }
                        className="h-9 rounded-lg border border-line bg-card px-2 text-xs font-bold"
                      >
                        <option value="excavation">حفر ترابي / خندق</option>
                        <option value="backfill">ردم على طبقات</option>
                        <option value="berm">ساتر ترابي بميول جانبية</option>
                      </select>
                      <span className="num rounded bg-card px-2.5 py-1 text-xs font-bold text-teal">
                        الحجم الهندسي: {fmtLoose(res.bankVol)} م³
                      </span>
                      {ew.kind === "excavation" ? (
                        <span className="num rounded bg-card px-2 py-1 text-xs text-muted">
                          الحجم المنتفش للنقل: {fmtLoose(res.swollenVol)} م³
                        </span>
                      ) : (
                        <span className="num rounded bg-card px-2 py-1 text-xs text-muted">
                          العرض السفلي: {fmtLoose(res.bottomWidth)} م • مساحة الميول:{" "}
                          {fmtLoose(res.sideSlopeArea)} م²
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEarthwork(ew.id)}
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-card text-danger"
                      title="حذف"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
                    <TextField
                      label={`البيان #${idx + 1}`}
                      value={ew.name}
                      placeholder={ew.kind === "berm" ? "مثال: ساتر حماية 100م" : "مثال: حفر قبو"}
                      onChange={(v) => updateEarthwork(ew.id, { name: v })}
                    />
                    <Field
                      label="العدد"
                      value={ew.count}
                      onChange={(v) => updateEarthwork(ew.id, { count: v })}
                    />
                    <ExprField
                      label="الطول (م)"
                      value={ew.length}
                      result={numExpr(ew.length)}
                      onChange={(v) => updateEarthwork(ew.id, { length: v })}
                    />
                    <ExprField
                      label={numExpr(ew.slopeDeg) > 0 ? "العرض العلوي (م)" : "العرض (م)"}
                      value={ew.topWidth}
                      result={numExpr(ew.topWidth)}
                      onChange={(v) => updateEarthwork(ew.id, { topWidth: v })}
                    />
                    <ExprField
                      label="الارتفاع / العمق (م)"
                      value={ew.height}
                      result={numExpr(ew.height)}
                      onChange={(v) => updateEarthwork(ew.id, { height: v })}
                    />
                    <Field
                      label="زاوية الميل الجانبي (°)"
                      value={ew.slopeDeg}
                      onChange={(v) => updateEarthwork(ew.id, { slopeDeg: v })}
                    />
                    {ew.kind === "excavation" ? (
                      <Field
                        label="معامل الانتفاش %"
                        value={ew.swellPct}
                        onChange={(v) => updateEarthwork(ew.id, { swellPct: v })}
                      />
                    ) : (
                      <Field
                        label="نسبة الدمك والهدر %"
                        value={ew.compactionPct}
                        onChange={(v) => updateEarthwork(ew.id, { compactionPct: v })}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StructuralRowCard({
  row,
  index,
  onChange,
  onDuplicate,
  onRemove,
}: {
  row: StructuralRow;
  index: number;
  onChange: (patch: Partial<StructuralRow>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [showCustomFormula, setShowCustomFormula] = useState(
    Boolean(row.customConcreteExpr || row.customFormworkExpr),
  );
  const formulaDefinitions = useBoq((s) => s.formulaDefinitions).filter(
    (f) => f.scope === "structural",
  );
  const res = calcStructuralRow(row);
  const bars = row.bars ?? [];
  const isFoundation = row.kind === "footing" || row.kind === "raft";

  const addBarGroup = () => {
    const next: RebarBarGroup = {
      id: `${row.id}-bar-${Date.now()}`,
      label: "تسليح رئيسي",
      diameter: "14",
      barsCount: "10",
      barLength: row.length || "3",
    };
    onChange({ bars: [...bars, next] });
  };

  const updateBar = (id: string, patch: Partial<RebarBarGroup>) => {
    onChange({ bars: bars.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  };

  return (
    <Card className="p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-teal/15 text-xs font-bold text-teal">
            {index + 1}
          </span>
          <select
            value={row.kind}
            onChange={(e) => {
              const newKind = e.target.value as StructuralElementKind;
              const defaultRatio =
                ELEMENT_KINDS.find((k) => k.id === newKind)?.defaultRatio ?? row.steelRatio;
              onChange({
                kind: newKind,
                steelRatio: defaultRatio,
                includeBlinding: newKind === "footing" || newKind === "raft",
                includeExcavation: newKind === "footing" || newKind === "raft",
              });
            }}
            className="h-9 rounded-lg border border-line bg-band px-2.5 text-xs font-bold"
          >
            {ELEMENT_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>

          <span className="num rounded-md border border-line bg-band/60 px-2.5 py-1 text-xs font-bold">
            بيتون: {fmtLoose(res.concreteVol)} م³
          </span>
          <span className="num rounded-md border border-line bg-band/60 px-2.5 py-1 text-xs">
            طوبار: {fmtLoose(res.formworkArea)} م²
          </span>
          <span className="num rounded-md border border-teal/40 bg-teal/10 px-2.5 py-1 text-xs font-bold text-teal">
            حديد: {fmtLoose(res.steelKg)} كغ ({fmtLoose(res.steelTon)} طن)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowCustomFormula(!showCustomFormula)}
            className={
              "rounded-lg border px-2.5 py-1 text-xs font-semibold " +
              (showCustomFormula || row.customConcreteExpr || row.customFormworkExpr
                ? "border-teal bg-teal/10 text-teal"
                : "border-line bg-card text-muted")
            }
          >
            معادلة العنصر
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            title="تكرار العنصر"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-card hover:border-teal"
          >
            <Copy className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="حذف العنصر"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-card text-danger hover:bg-danger-bg"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <TextField
          label="اسم / رمز العنصر"
          value={row.name}
          placeholder={`مثال: ${STRUCTURAL_KIND_LABELS[row.kind]} 1`}
          onChange={(v) => onChange({ name: v })}
        />
        <ExprField
          label="العدد (count)"
          value={row.count}
          result={numExpr(row.count)}
          onChange={(v) => onChange({ count: v })}
        />
        <ExprField
          label={row.kind === "beam" ? "طول الجسر L (م)" : "الطول L (م)"}
          value={row.length}
          result={numExpr(row.length)}
          onChange={(v) => onChange({ length: v })}
        />
        <ExprField
          label={row.kind === "wall" ? "سماكة الجدار W (م)" : "العرض W (م)"}
          value={row.width}
          result={numExpr(row.width)}
          onChange={(v) => onChange({ width: v })}
        />
        <ExprField
          label={row.kind === "slab" ? "سماكة البلاطة H (م)" : "الارتفاع H (م)"}
          value={row.height}
          result={numExpr(row.height)}
          onChange={(v) => onChange({ height: v })}
        />
      </div>

      {/* محرر معادلات البيتون والطوبار المخصصة لهذا العنصر */}
      {showCustomFormula ? (
        <div className="mt-3 rounded-lg border border-teal/40 bg-teal/5 p-2.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <strong className="text-teal">
              تخصيص معادلة البيتون أو القالب الخشبي لهذا العنصر (المتغيرات: count, L, W, H):
            </strong>
            {formulaDefinitions.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {formulaDefinitions.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onChange({ customConcreteExpr: f.expression })}
                    className="rounded border border-teal/40 bg-card px-2 py-0.5 text-[11px] font-semibold text-teal"
                  >
                    تطبيق: {f.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <TextField
              label="معادلة حجم البيتون (اتركها فارغة للقياسي: count * L * W * H)"
              value={row.customConcreteExpr ?? ""}
              placeholder="مثال: count * L * W * H * 0.75 (لبلاطة مفرغة/هوردي)"
              onChange={(v) => onChange({ customConcreteExpr: v })}
            />
            <TextField
              label="معادلة مساحة الطوبار (اتركها فارغة للقياسي حسب نوع العنصر)"
              value={row.customFormworkExpr ?? ""}
              placeholder="مثال: count * 2 * (L + W) * H"
              onChange={(v) => onChange({ customFormworkExpr: v })}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 border-t border-line pt-3 lg:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-line bg-band/25 p-2.5">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={row.includeFormwork}
                onChange={(e) => onChange({ includeFormwork: e.target.checked })}
                className="accent-teal"
              />
              حساب القالب الخشبي ({fmtLoose(res.formworkArea)} م²)
            </label>

            {isFoundation ? (
              <>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={row.includeBlinding !== false}
                    onChange={(e) => onChange({ includeBlinding: e.target.checked })}
                    className="accent-teal"
                  />
                  بيتون نظافة ({fmtLoose(res.blindingVol)} م³)
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={row.includeExcavation !== false}
                    onChange={(e) => onChange({ includeExcavation: e.target.checked })}
                    className="accent-teal"
                  />
                  حفر القاعدة ({fmtLoose(res.excavationVol)} م³)
                </label>
              </>
            ) : null}
          </div>

          {isFoundation && (row.includeBlinding || row.includeExcavation) ? (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Field
                label="سماكة النظافة (م)"
                value={row.blindingThickness ?? "0.10"}
                onChange={(v) => onChange({ blindingThickness: v })}
              />
              <Field
                label="رفرفة النظافة (م)"
                value={row.blindingProjection ?? "0.10"}
                onChange={(v) => onChange({ blindingProjection: v })}
              />
              <Field
                label="عمق الحفر (اختياري م)"
                value={row.excavationDepth ?? ""}
                onChange={(v) => onChange({ excavationDepth: v })}
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-line bg-band/25 p-2.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold">طريقة حساب حديد التسليح:</span>
            <div className="flex rounded-md border border-line bg-card p-0.5 text-xs">
              <button
                type="button"
                onClick={() => onChange({ rebarMode: "ratio" })}
                className={
                  "rounded px-2.5 py-1 font-semibold " +
                  (row.rebarMode === "ratio" ? "bg-teal text-on-teal" : "text-muted")
                }
              >
                نسبة (كغ / م³)
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange({ rebarMode: "bars" });
                  if (bars.length === 0) addBarGroup();
                }}
                className={
                  "rounded px-2.5 py-1 font-semibold " +
                  (row.rebarMode === "bars" ? "bg-teal text-on-teal" : "text-muted")
                }
              >
                تفريد أقطار (BBS)
              </button>
            </div>
          </div>

          {row.rebarMode === "ratio" ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-36">
                <Field
                  label="نسبة الحديد (كغ/م³)"
                  value={row.steelRatio}
                  onChange={(v) => onChange({ steelRatio: v })}
                />
              </div>
              <div className="flex flex-wrap gap-1 pb-1">
                {["80", "100", "120", "150", "180", "220"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onChange({ steelRatio: r })}
                    className={
                      "rounded border px-2 py-1 text-[11px] font-semibold " +
                      (row.steelRatio === r
                        ? "border-teal bg-teal text-on-teal"
                        : "border-line bg-card text-muted")
                    }
                  >
                    {r} كغ
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {bars.map((bar) => (
                <div
                  key={bar.id}
                  className="grid grid-cols-[1fr_5.5rem_5rem_5rem_auto] items-end gap-1.5"
                >
                  <TextField
                    label="الوصف"
                    value={bar.label}
                    onChange={(v) => updateBar(bar.id, { label: v })}
                  />
                  <div>
                    <span className="mb-1 block text-xs font-medium text-muted">القطر Φ (مم)</span>
                    <select
                      value={bar.diameter}
                      onChange={(e) => updateBar(bar.id, { diameter: e.target.value })}
                      className="h-11 w-full rounded-lg border border-line bg-input px-2 text-sm font-bold"
                    >
                      {REBAR_DIAMETERS.map((d) => (
                        <option key={d} value={d}>
                          Φ{d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    label="العدد"
                    value={bar.barsCount}
                    onChange={(v) => updateBar(bar.id, { barsCount: v })}
                  />
                  <Field
                    label="الطول (م)"
                    value={bar.barLength}
                    onChange={(v) => updateBar(bar.id, { barLength: v })}
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ bars: bars.filter((b) => b.id !== bar.id) })}
                    className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-card text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addBarGroup}
                className="rounded-md border border-line bg-card px-2.5 py-1 text-xs font-semibold text-teal"
              >
                + إضافة قطر تسليح
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-card border px-3 py-2 " +
        (highlight ? "border-teal bg-teal/10" : "border-line bg-card")
      }
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="num text-sm font-bold text-ink">{value}</div>
    </div>
  );
}
