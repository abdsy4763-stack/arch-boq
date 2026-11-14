import { type ReactNode, useState } from "react";
import {
  Calculator,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  DoorOpen,
  Eraser,
  Info,
  Layers,
  PaintBucket,
  Plus,
  Ruler,
  Sparkles,
  Trash2,
} from "lucide-react";
import { itemsForKind } from "@/lib/boq/catalog";
import { fmtLoose, kpis, numExpr, spaceGeometry, spaceIssue } from "@/lib/boq/engine";
import { useBoq } from "@/lib/boq/store";
import type {
  CatalogItem,
  FinishDefinition,
  FinishKind,
  Island,
  OpeningGroup,
  ShapeMode,
  ShapePart,
  SpaceRow,
} from "@/lib/boq/types";
import { Picker } from "./picker";
import { Btn, Card, ConfirmDialog, ExprField, Field, InfoDialog, TextField } from "./ui";

const FINISHES: { key: keyof SpaceRow; kind: FinishKind; label: string }[] = [
  { key: "floor", kind: "floor", label: "الأرضيات" },
  { key: "wall", kind: "wall", label: "الجدران" },
  { key: "ceiling", kind: "ceiling", label: "الأسقف" },
  { key: "plaster", kind: "plaster", label: "طينة الجدران" },
  { key: "sill", kind: "sill", label: "النعلات" },
  { key: "door", kind: "door", label: "الأبواب" },
  { key: "window", kind: "window", label: "النوافذ" },
  { key: "tyrolean", kind: "tyrolean", label: "البراطيش" },
];

type SpaceSubTab = "dims" | "openings" | "finishes";

export function PanelView({ catalog }: { catalog: CatalogItem[] }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [collapsedSpaces, setCollapsedSpaces] = useState<Record<string, boolean>>({});
  const [activeSubTabs, setActiveSubTabs] = useState<Record<string, SpaceSubTab>>({});
  const [templateName, setTemplateName] = useState("");
  const [bulkFinishKey, setBulkFinishKey] = useState<keyof SpaceRow>("floor");
  const [bulkFinishCode, setBulkFinishCode] = useState("");
  const [showBulkTools, setShowBulkTools] = useState(false);

  const panel = useBoq((s) => s.panel);
  const finishDefinitions = useBoq((s) => s.finishDefinitions);
  const setBlockField = useBoq((s) => s.setBlockField);
  const updateSpace = useBoq((s) => s.updateSpace);
  const addSpace = useBoq((s) => s.addSpace);
  const removeSpace = useBoq((s) => s.removeSpace);
  const duplicateSpace = useBoq((s) => s.duplicateSpace);
  const copyFinishesFromPrevious = useBoq((s) => s.copyFinishesFromPrevious);
  const addExtra = useBoq((s) => s.addExtra);
  const updateExtra = useBoq((s) => s.updateExtra);
  const removeExtra = useBoq((s) => s.removeExtra);
  const generate = useBoq((s) => s.generate);
  const clearPanel = useBoq((s) => s.clearPanel);
  const blocks = useBoq((s) => s.blocks);
  const loadBlock = useBoq((s) => s.loadBlock);
  const templates = useBoq((s) => s.templates);
  const saveTemplate = useBoq((s) => s.saveTemplate);
  const applyTemplate = useBoq((s) => s.applyTemplate);
  const applyFinishToSpaces = useBoq((s) => s.applyFinishToSpaces);

  const stats = kpis(panel.spaces);
  const currentFinishOptions = itemsForKind(
    catalog,
    FINISHES.find((item) => item.key === bulkFinishKey)?.kind ?? "floor"
  );

  // تطبيق إكساء قياسي تلقائي من أول بند متاح لكل تصنيف في الكتالوج
  const applyStandardFinishes = (spaceId: string) => {
    const patch: Partial<SpaceRow> = {};
    FINISHES.forEach((f) => {
      const firstCode = itemsForKind(catalog, f.kind)[0];
      if (firstCode) {
        (patch as Record<string, string>)[f.key as string] = firstCode;
      }
    });
    updateSpace(spaceId, patch);
  };

  // تفريغ إكساءات الفراغ (على العظم)
  const clearSpaceFinishes = (spaceId: string) => {
    updateSpace(spaceId, {
      floor: "",
      wall: "",
      ceiling: "",
      door: "",
      window: "",
      sill: "",
      tyrolean: "",
      plaster: "",
      customFinishes: {},
    });
  };

  const toggleAllSelection = () => {
    if (selectedSpaces.length === panel.spaces.length) {
      setSelectedSpaces([]);
    } else {
      setSelectedSpaces(panel.spaces.map((s) => s.id));
    }
  };

  return (
    <>
      <div className="space-y-4 pb-8">
        {/* 1. بطاقة بيانات الكتلة الرئيسية */}
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">بيانات الكتلة والمشروع</h2>
              <p className="text-xs text-muted">
                أدخل أبعاد الكتلة الإجمالية والغرف، ثم اضغط «حساب وتوليد التقرير».
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn tone="ghost" onClick={() => setShowRules(true)}>
                <Info className="size-4 text-teal" />
                قواعد الحساب
              </Btn>
              <Btn tone="ghost" onClick={() => setConfirmClear(true)}>
                تفريغ اللوحة
              </Btn>
              <Btn tone="primary" onClick={generate}>
                <Calculator className="size-4" />
                حساب وتوليد التقرير
              </Btn>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              label="اسم الكتلة / الطابق"
              value={panel.blockName}
              placeholder="مثال: الطابق الأرضي - شقة 1"
              onChange={(value) => setBlockField("blockName", value)}
            />
            <Field
              label="طول الكتلة (م)"
              value={panel.length}
              onChange={(value) => setBlockField("length", value)}
            />
            <Field
              label="عرض الكتلة (م)"
              value={panel.width}
              onChange={(value) => setBlockField("width", value)}
            />
            <Field
              label="ارتفاع الكتلة (م)"
              value={panel.height}
              onChange={(value) => setBlockField("height", value)}
            />
          </div>

          <details className="mt-3 rounded-lg border border-line bg-band/30 p-2.5">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              عزل السطح وأعمال الواجهات الخارجية للكتلة (اختياري)
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Picker
                label="عزل الكتلة (السطح) — الطول × العرض"
                value={panel.insulation}
                options={itemsForKind(catalog, "insulation")}
                catalog={catalog}
                onChange={(value) => setBlockField("insulation", value)}
              />
              <Picker
                label="أعمال الواجهات — 2 × (طول + عرض) × ارتفاع"
                value={panel.facade}
                options={itemsForKind(catalog, "facade")}
                catalog={catalog}
                onChange={(value) => setBlockField("facade", value)}
              />
            </div>
          </details>
        </Card>

        {/* 2. شريط المؤشرات الهندسية الفورية (KPIs) */}
        <div className="sticky top-[74px] z-20 grid grid-cols-2 gap-2 bg-paper/95 py-2 backdrop-blur sm:static sm:grid-cols-5 sm:bg-transparent sm:py-0">
          <Stat label="عدد الفراغات" value={String(stats.spaces)} />
          <Stat label="إجمالي الأرضيات" value={`${fmtLoose(stats.floor)} م²`} />
          <Stat label="إجمالي الأبواب" value={fmtLoose(stats.doors)} />
          <Stat label="إجمالي النوافذ" value={fmtLoose(stats.windows)} />
          <Stat label="تنبيهات التدقيق" value={String(stats.alerts)} warn={stats.alerts > 0} />
        </div>

        {/* 3. الكتل المحفوظة سابقاً */}
        {blocks.length > 0 ? (
          <Card className="p-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="shrink-0 text-xs font-bold text-muted">الكتل المحفوظة:</span>
              {blocks.map((block) => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => loadBlock(block.id)}
                  className="shrink-0 rounded-lg border border-line bg-band px-3 py-1.5 text-xs font-semibold hover:border-teal"
                >
                  {block.name}
                </button>
              ))}
            </div>
          </Card>
        ) : null}

        {/* 4. شريط القوالب السريعة والأدوات الجماعية */}
        <Card className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ml-1 inline-flex items-center gap-1 text-xs font-bold text-teal">
                <Sparkles className="size-3.5" />
                إدراج قالب سريع:
              </span>
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="rounded-lg border border-line bg-band px-2.5 py-1.5 text-xs font-semibold hover:border-teal hover:bg-teal/10"
                  onClick={() => {
                    const targets = selectedSpaces.length
                      ? selectedSpaces
                      : ([panel.spaces[panel.spaces.length - 1]?.id].filter(Boolean) as string[]);
                    targets.forEach((id) => {
                      applyTemplate(id, template.id);
                      updateSpace(id, { name: template.name });
                    });
                    FINISHES.forEach((finish) => {
                      if (!template.data[finish.key as keyof Omit<SpaceRow, "id">]) {
                        const defaultCode = itemsForKind(catalog, finish.kind)[0];
                        if (defaultCode) {
                          applyFinishToSpaces(
                            targets,
                            finish.key as keyof Pick<
                              SpaceRow,
                              "floor" | "wall" | "ceiling" | "door" | "window" | "sill" | "tyrolean" | "plaster"
                            >,
                            defaultCode
                          );
                        }
                      }
                    });
                  }}
                >
                  + {template.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowBulkTools(!showBulkTools)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
            >
              <PaintBucket className="size-3.5" />
              {showBulkTools ? "إخفاء أدوات التعميم" : "تعميم إكساء / حفظ قالب"}
            </button>
          </div>

          {showBulkTools ? (
            <div className="mt-3 grid gap-3 border-t border-line pt-3 lg:grid-cols-2">
              <div className="rounded-lg border border-line bg-band/30 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold">تعميم بند إكساء على الفراغات المحددة ({selectedSpaces.length})</span>
                  <button
                    type="button"
                    onClick={toggleAllSelection}
                    className="inline-flex items-center gap-1 text-xs text-teal"
                  >
                    <CheckSquare className="size-3.5" />
                    {selectedSpaces.length === panel.spaces.length ? "إلغاء تحديد الكل" : "تحديد كل الفراغات"}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                  <select
                    aria-label="نوع التشطيب الجماعي"
                    value={String(bulkFinishKey)}
                    onChange={(event) => {
                      setBulkFinishKey(event.target.value as keyof SpaceRow);
                      setBulkFinishCode("");
                    }}
                    className="h-10 rounded-lg border border-line bg-input px-2 text-xs"
                  >
                    {FINISHES.map((finish) => (
                      <option key={String(finish.key)} value={String(finish.key)}>
                        {finish.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="بند التشطيب الجماعي"
                    value={bulkFinishCode}
                    onChange={(event) => setBulkFinishCode(event.target.value)}
                    className="h-10 rounded-lg border border-line bg-input px-2 text-xs"
                  >
                    <option value="">اختر البند...</option>
                    {currentFinishOptions.map((code) => (
                      <option key={code} value={code}>
                        {code} — {catalog.find((item) => item.code === code)?.desc ?? ""}
                      </option>
                    ))}
                  </select>
                  <Btn
                    tone="primary"
                    onClick={() => {
                      if (selectedSpaces.length && bulkFinishCode) {
                        applyFinishToSpaces(
                          selectedSpaces,
                          bulkFinishKey as keyof Pick<
                            SpaceRow,
                            "floor" | "wall" | "ceiling" | "door" | "window" | "sill" | "tyrolean" | "plaster"
                          >,
                          bulkFinishCode
                        );
                      }
                    }}
                  >
                    تعميم
                  </Btn>
                </div>
              </div>

              <div className="rounded-lg border border-line bg-band/30 p-2.5">
                <span className="mb-2 block text-xs font-bold">حفظ الفراغ المحدد كقالب مخصص</span>
                <div className="flex gap-2">
                  <input
                    aria-label="اسم القالب"
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="اكتب اسم القالب (مثال: جناح ماستر)"
                    className="h-10 flex-1 rounded-lg border border-line bg-input px-3 text-xs"
                  />
                  <Btn
                    tone="ghost"
                    onClick={() => {
                      const source =
                        panel.spaces.find((space) => selectedSpaces.includes(space.id)) ?? panel.spaces[0];
                      if (!source || !templateName.trim()) return;
                      const { id, ...data } = source;
                      saveTemplate({ id: `custom-${Date.now()}`, name: templateName, data });
                      setTemplateName("");
                    }}
                  >
                    حفظ القالب
                  </Btn>
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        {/* 5. رأس قسم الفراغات */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">الفراغات والغرف ({panel.spaces.length})</h2>
            {panel.spaces.length > 1 ? (
              <button
                type="button"
                onClick={() => {
                  const allCollapsed = panel.spaces.every((s) => collapsedSpaces[s.id]);
                  const next: Record<string, boolean> = {};
                  panel.spaces.forEach((s) => {
                    next[s.id] = !allCollapsed;
                  });
                  setCollapsedSpaces(next);
                }}
                className="rounded-md border border-line bg-card px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink"
              >
                {panel.spaces.every((s) => collapsedSpaces[s.id]) ? "توسيع الكل" : "طي الكل"}
              </button>
            ) : null}
          </div>
          <Btn tone="navy" onClick={addSpace}>
            <Plus className="size-4" />
            إضافة فراغ جديد
          </Btn>
        </div>

        {/* 6. بطاقات الفراغات بنظام التبويبات المبسط */}
        <div className="space-y-3">
          {panel.spaces.map((space, index) => {
            const named = space.name.trim() !== "";
            const issue = named ? spaceIssue(space) : null;
            const alert = issue !== null;
            const geo = spaceGeometry(space);
            const isCollapsed = !!collapsedSpaces[space.id];
            const activeTab: SpaceSubTab = activeSubTabs[space.id] ?? "dims";

            const filledFinishesCount = FINISHES.filter((f) => Boolean(space[f.key])).length;
            const doorsCount = openingGroups(space, "door").reduce((sum, g) => sum + Number(g.count || 0), 0);
            const winsCount = openingGroups(space, "window").reduce((sum, g) => sum + Number(g.count || 0), 0);

            return (
              <Card
                key={space.id}
                className={"overflow-hidden transition-all " + (alert ? "border-amber" : "")}
              >
                {/* الشريط العلوي للفراغ */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-band/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      aria-label={`تحديد فراغ ${index + 1}`}
                      checked={selectedSpaces.includes(space.id)}
                      onChange={(event) =>
                        setSelectedSpaces((current) =>
                          event.target.checked
                            ? [...current, space.id]
                            : current.filter((id) => id !== space.id)
                        )
                      }
                      className="size-4 accent-teal"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedSpaces((prev) => ({ ...prev, [space.id]: !prev[space.id] }))
                      }
                      className="flex items-center gap-2 text-right font-bold text-ink"
                    >
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-teal/15 text-xs text-teal">
                        {index + 1}
                      </span>
                      <span>{space.name || `فراغ ${index + 1}`}</span>
                      {space.fn ? (
                        <span className="rounded bg-card px-2 py-0.5 text-xs font-normal text-muted">
                          {space.fn}
                        </span>
                      ) : null}
                    </button>
                  </div>

                  {/* شارات الملخص الهندسي السريع */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="num rounded-md border border-line bg-card px-2 py-1 text-xs font-semibold">
                      مساحة: {fmtLoose(geo.area)} م²
                    </span>
                    <span className="num hidden rounded-md border border-line bg-card px-2 py-1 text-xs text-muted sm:inline-block">
                      محيط: {fmtLoose(geo.perimeter)} م
                    </span>
                    <span className="num rounded-md border border-line bg-card px-2 py-1 text-xs text-teal">
                      إكساء: {filledFinishesCount}/{FINISHES.length}
                    </span>

                    <div className="mr-1 flex items-center gap-1">
                      <IconBtn
                        label="نسخ التشطيب من الفراغ السابق"
                        onClick={() => copyFinishesFromPrevious(space.id)}
                        disabled={index === 0}
                      >
                        <Copy className="size-4" />
                      </IconBtn>
                      <IconBtn label="تكرار الفراغ بالكامل" onClick={() => duplicateSpace(space.id)}>
                        <Plus className="size-4" />
                      </IconBtn>
                      <IconBtn label="حذف الفراغ" onClick={() => removeSpace(space.id)}>
                        <Trash2 className="size-4" />
                      </IconBtn>
                      <IconBtn
                        label={isCollapsed ? "توسيع الفراغ" : "طي الفراغ"}
                        onClick={() =>
                          setCollapsedSpaces((prev) => ({ ...prev, [space.id]: !prev[space.id] }))
                        }
                      >
                        {isCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                      </IconBtn>
                    </div>
                  </div>
                </div>

                {!isCollapsed ? (
                  <div className="p-3">
                    {issue ? (
                      <div className="mb-3 rounded-lg border border-amber bg-amber-bg px-3 py-2 text-xs font-semibold text-amber">
                        ⚠️ {issue}
                      </div>
                    ) : null}

                    {/* شريط التبويبات الثلاثي داخل الفراغ */}
                    <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-band p-1">
                      <button
                        type="button"
                        onClick={() => setActiveSubTabs((prev) => ({ ...prev, [space.id]: "dims" }))}
                        className={
                          "flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition-all " +
                          (activeTab === "dims"
                            ? "bg-card text-teal shadow-sm"
                            : "text-muted hover:text-ink")
                        }
                      >
                        <Ruler className="size-3.5" />
                        <span>1. الأبعاد ({fmtLoose(geo.area)} م²)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSubTabs((prev) => ({ ...prev, [space.id]: "openings" }))}
                        className={
                          "flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition-all " +
                          (activeTab === "openings"
                            ? "bg-card text-teal shadow-sm"
                            : "text-muted hover:text-ink")
                        }
                      >
                        <DoorOpen className="size-3.5" />
                        <span>
                          2. الفتحات ({doorsCount} باب • {winsCount} نافذة)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSubTabs((prev) => ({ ...prev, [space.id]: "finishes" }))}
                        className={
                          "flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition-all " +
                          (activeTab === "finishes"
                            ? "bg-card text-teal shadow-sm"
                            : "text-muted hover:text-ink")
                        }
                      >
                        <Layers className="size-3.5" />
                        <span>
                          3. الإكساءات ({filledFinishesCount}/{FINISHES.length})
                        </span>
                      </button>
                    </div>

                    {/* محتوى التبويب الأول: الأبعاد */}
                    {activeTab === "dims" ? (
                      <ShapeEditor space={space} onChange={(patch) => updateSpace(space.id, patch)} />
                    ) : null}

                    {/* محتوى التبويب الثاني: الأبواب والنوافذ */}
                    {activeTab === "openings" ? (
                      <OpeningsEditor space={space} onChange={(patch) => updateSpace(space.id, patch)} />
                    ) : null}

                    {/* محتوى التبويب الثالث: التشطيبات والإكساء */}
                    {activeTab === "finishes" ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-band/40 px-3 py-2">
                          <span className="text-xs font-semibold text-muted">
                            اختصارات الإكساء السريع لهذا الفراغ:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => applyStandardFinishes(space.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-teal/40 bg-teal/10 px-2.5 py-1 text-xs font-bold text-teal hover:bg-teal/20"
                            >
                              <Sparkles className="size-3.5" />
                              تعبئة إكساء قياسي
                            </button>
                            {index > 0 ? (
                              <button
                                type="button"
                                onClick={() => copyFinishesFromPrevious(space.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-line bg-card px-2.5 py-1 text-xs font-semibold hover:border-teal"
                              >
                                <Copy className="size-3.5" />
                                نسخ من «{panel.spaces[index - 1]?.name || `فراغ ${index}`}»
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => clearSpaceFinishes(space.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-line bg-card px-2.5 py-1 text-xs text-danger hover:bg-danger-bg"
                            >
                              <Eraser className="size-3.5" />
                              على العظم (تفريغ)
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-2.5 md:grid-cols-2">
                          {FINISHES.map((finish) => (
                            <Picker
                              key={finish.key}
                              compact
                              label={finish.label}
                              value={String(space[finish.key] ?? "")}
                              options={itemsForKind(catalog, finish.kind)}
                              catalog={catalog}
                              onChange={(value) => updateSpace(space.id, { [finish.key]: value })}
                            />
                          ))}
                          {finishDefinitions
                            .filter((definition) => !definition.archived)
                            .map((definition: FinishDefinition) => {
                              const customOptions = definition.categoryFilter
                                ? catalog
                                    .filter((c) => c.category === definition.categoryFilter)
                                    .map((c) => c.code)
                                : definition.baseKind === "extra"
                                  ? catalog.map((c) => c.code)
                                  : itemsForKind(catalog, definition.baseKind);
                              return (
                                <Picker
                                  key={definition.id}
                                  compact
                                  label={`✨ ${definition.label}`}
                                  value={String(space.customFinishes?.[definition.id] ?? "")}
                                  options={customOptions}
                                  catalog={catalog}
                                  onChange={(value) =>
                                    updateSpace(space.id, {
                                      customFinishes: {
                                        ...(space.customFinishes ?? {}),
                                        [definition.id]: value,
                                      },
                                    })
                                  }
                                />
                              );
                            })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>

        {/* 7. بنود بكمية مقطوعة / مباشرة */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-bold">بنود إضافية بكمية مباشرة</h2>
              <p className="text-xs text-muted">
                لأي بند إضافي خارج حساب أبعاد الغرف (تُطبَّق عليه نسبة الهدر تلقائياً).
              </p>
            </div>
            <Btn tone="navy" onClick={addExtra}>
              <Plus className="size-4" />
              إضافة بند مباشر
            </Btn>
          </div>
          {(panel.extras ?? []).length === 0 ? (
            <p className="text-xs text-muted">لا توجد بنود مباشرة مضافة حالياً.</p>
          ) : (
            <div className="space-y-2">
              {(panel.extras ?? []).map((line) => (
                <div key={line.id} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                  <Picker
                    label="البند"
                    value={line.item}
                    options={[]}
                    catalog={catalog}
                    onChange={(value) => updateExtra(line.id, { item: value })}
                  />
                  <Field
                    label="الكمية"
                    value={line.qty}
                    onChange={(value) => updateExtra(line.id, { qty: value })}
                  />
                  <div className="flex items-end">
                    <IconBtn label="حذف البند" onClick={() => removeExtra(line.id)}>
                      <Trash2 className="size-4" />
                    </IconBtn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 8. زر التوليد السفلي السريع */}
        <div className="flex justify-end">
          <Btn tone="primary" onClick={generate}>
            <Calculator className="size-4" />
            حساب الكميات وتوليد التقرير النهائي
          </Btn>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="تفريغ لوحة التحكم؟"
        message="سيتم مسح جميع بيانات الكتلة والفراغات المدخلة في اللوحة الحالية. التقارير المحفوظة لن تُحذف."
        confirmLabel="تفريغ اللوحة"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearPanel();
          setConfirmClear(false);
        }}
      />

      <InfoDialog open={showRules} title="قواعد الحساب الهندسي" onClose={() => setShowRules(false)}>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          <li>• الأرضيات والأسقف: الطول × العرض.</li>
          <li>• الجدران والطينة: 2 × (طول + عرض) × الارتفاع − مساحة الفتحات.</li>
          <li>• النعلات: 2 × (طول + عرض) − مجموع عروض الأبواب.</li>
          <li>• البراطيش: مجموع عروض الأبواب فقط.</li>
          <li>• الأبواب والنوافذ تتبع معادلة البند والوحدة والهدر.</li>
          <li>• الفراغ المركّب: المساحة = مجموع الأجزاء المضافة − المطروحة.</li>
          <li>• الكتلة الداخلية (عمود/منور): تُخصم من الأرضية والسقف ويُضاف محيطها للجدران.</li>
          <li>• الإدخال المباشر: أدخل المساحة والمحيط مباشرة من الأوتوكاد.</li>
        </ul>
      </InfoDialog>
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={
        "rounded-card border px-3 py-2 " +
        (warn ? "border-amber bg-amber-bg" : "border-line bg-card")
      }
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="num text-base font-bold">{value}</div>
    </div>
  );
}

const SHAPE_MODES: { id: ShapeMode; label: string }[] = [
  { id: "rect", label: "مستطيل قياسي" },
  { id: "composite", label: "مركّب (L / T…)" },
  { id: "direct", label: "مساحة ومحيط مباشر (CAD)" },
];

const QUICK_FUNCTIONS = ["غرفة نوم", "صالة", "مطبخ", "حمام", "موزع", "شرفة", "مكتب"];

function ShapeEditor({
  space,
  onChange,
}: {
  space: SpaceRow;
  onChange: (patch: Partial<SpaceRow>) => void;
}) {
  const mode: ShapeMode = space.shapeMode ?? "rect";
  const geo = spaceGeometry(space);
  const parts = space.parts ?? [];
  const islands = space.islands ?? [];
  const stamp = () =>
    `${space.id}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const setPart = (id: string, patch: Partial<ShapePart>) =>
    onChange({ parts: parts.map((part) => (part.id === id ? { ...part, ...patch } : part)) });
  const setIsland = (id: string, patch: Partial<Island>) =>
    onChange({ islands: islands.map((item) => (item.id === id ? { ...item, ...patch } : item)) });

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <TextField
          label="اسم الفراغ"
          value={space.name}
          placeholder="مثال: غرفة نوم 1"
          onChange={(value) => onChange({ name: value })}
        />
        <div>
          <TextField
            label="الوظيفة"
            value={space.fn}
            placeholder="اختر أو اكتب..."
            onChange={(value) => onChange({ fn: value })}
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {QUICK_FUNCTIONS.map((fnName) => (
              <button
                key={fnName}
                type="button"
                onClick={() =>
                  onChange({
                    fn: fnName,
                    name: space.name.trim() ? space.name : fnName,
                  })
                }
                className={
                  "rounded px-1.5 py-0.5 text-[11px] " +
                  (space.fn === fnName
                    ? "bg-teal text-on-teal font-bold"
                    : "bg-band text-muted hover:text-ink")
                }
              >
                {fnName}
              </button>
            ))}
          </div>
        </div>
        {mode === "rect" ? (
          <>
            <Field
              label="الطول (م)"
              value={space.length}
              onChange={(value) => onChange({ length: value })}
            />
            <Field
              label="العرض (م)"
              value={space.width}
              onChange={(value) => onChange({ width: value })}
            />
          </>
        ) : null}
        <Field
          label="الارتفاع (م)"
          value={space.height}
          onChange={(value) => onChange({ height: value })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="شكل الفراغ">
          {SHAPE_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={mode === item.id}
              onClick={() =>
                onChange({
                  shapeMode: item.id,
                  ...(item.id === "composite" && parts.length === 0
                    ? {
                        parts: [
                          {
                            id: stamp(),
                            name: "",
                            length: space.length,
                            width: space.width,
                            sign: "add" as const,
                          },
                        ],
                      }
                    : {}),
                })
              }
              className={
                "min-h-9 rounded-lg border px-3 text-xs font-semibold " +
                (mode === item.id
                  ? "border-teal bg-teal text-on-teal"
                  : "border-line bg-card text-ink")
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="num rounded-lg bg-band/60 px-3 py-1.5 text-xs">
          أرضية: <strong>{fmtLoose(geo.area)} م²</strong> • سقف:{" "}
          <strong>{fmtLoose(geo.ceilingArea)} م²</strong> • محيط:{" "}
          <strong>{fmtLoose(geo.perimeter)} م</strong>
        </div>
      </div>

      {mode === "composite" ? (
        <div className="space-y-2 rounded-lg border border-line bg-band/30 p-2.5">
          <p className="text-xs text-muted">
            قسّم الفراغ إلى مستطيلات: أضِف الأجزاء الموجودة (+) واطرح الأجزاء الناقصة (−).
          </p>
          {parts.map((part, index) => (
            <div key={part.id} className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2">
              <button
                type="button"
                onClick={() => setPart(part.id, { sign: part.sign === "sub" ? "add" : "sub" })}
                className={
                  "size-11 rounded-lg border text-lg font-bold " +
                  (part.sign === "sub"
                    ? "border-danger/40 bg-danger-bg text-danger"
                    : "border-teal/40 bg-ok-bg text-teal")
                }
              >
                {part.sign === "sub" ? "−" : "+"}
              </button>
              <ExprField
                label={`طول الجزء ${index + 1}`}
                value={part.length}
                result={numExpr(part.length)}
                onChange={(value) => setPart(part.id, { length: value })}
              />
              <ExprField
                label="عرضه"
                value={part.width}
                result={numExpr(part.width)}
                onChange={(value) => setPart(part.id, { width: value })}
              />
              <IconBtn
                label="حذف الجزء"
                onClick={() => onChange({ parts: parts.filter((item) => item.id !== part.id) })}
              >
                <Trash2 className="size-4" />
              </IconBtn>
            </div>
          ))}
          <Btn
            tone="ghost"
            onClick={() =>
              onChange({
                parts: [...parts, { id: stamp(), name: "", length: "", width: "", sign: "add" }],
              })
            }
          >
            <Plus className="size-4" />
            إضافة جزء
          </Btn>
        </div>
      ) : null}

      {mode === "direct" ? (
        <div className="grid gap-2 rounded-lg border border-line bg-band/30 p-2.5 sm:grid-cols-2">
          <ExprField
            label="مساحة الفراغ المباشرة (م²)"
            value={space.directArea ?? ""}
            result={numExpr(space.directArea)}
            onChange={(value) => onChange({ directArea: value })}
          />
        </div>
      ) : null}

      {mode !== "rect" ? (
        <div>
          <ExprField
            label="محيط الجدران (م) — يقبل جمع أطوال مثل: 3.33+5.04+3.33+5.04"
            value={space.perimeterExpr ?? ""}
            result={numExpr(space.perimeterExpr)}
            onChange={(value) => onChange({ perimeterExpr: value })}
          />
        </div>
      ) : null}

      <details className="rounded-lg border border-line bg-band/20 p-2">
        <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-ink">
          كتل داخلية / أعمدة / مناور ضمن الفراغ ({islands.length})
        </summary>
        <div className="mt-2 space-y-2">
          {islands.map((island, index) => (
            <div key={island.id} className="rounded-md border border-line bg-card p-2">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                <TextField
                  label={`الاسم ${index + 1}`}
                  value={island.name}
                  onChange={(value) => setIsland(island.id, { name: value })}
                />
                <ExprField
                  label="الطول"
                  value={island.length}
                  result={numExpr(island.length)}
                  onChange={(value) => setIsland(island.id, { length: value })}
                />
                <ExprField
                  label="العرض"
                  value={island.width}
                  result={numExpr(island.width)}
                  onChange={(value) => setIsland(island.id, { width: value })}
                />
                <IconBtn
                  label="حذف الكتلة"
                  onClick={() =>
                    onChange({ islands: islands.filter((item) => item.id !== island.id) })
                  }
                >
                  <Trash2 className="size-4" />
                </IconBtn>
              </div>
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={island.deductCeiling !== false}
                  onChange={(event) =>
                    setIsland(island.id, { deductCeiling: event.target.checked })
                  }
                />
                خصم مساحتها من سقف هذا الفراغ أيضاً
              </label>
            </div>
          ))}
          <Btn
            tone="ghost"
            onClick={() =>
              onChange({
                islands: [
                  ...islands,
                  { id: stamp(), name: "", length: "", width: "", deductCeiling: true },
                ],
              })
            }
          >
            <Plus className="size-4" />
            إضافة كتلة داخلية
          </Btn>
        </div>
      </details>
    </div>
  );
}

function openingGroups(space: SpaceRow, type: "door" | "window"): OpeningGroup[] {
  const groups = type === "door" ? space.doorGroups : space.windowGroups;
  if (groups?.length) return groups;
  return [
    {
      id: `${space.id}-${type}-legacy`,
      name: "",
      count: type === "door" ? space.doorCount : space.winCount,
      height: type === "door" ? space.doorH : space.winH,
      width: type === "door" ? space.doorW : space.winW,
    },
  ];
}

const DOOR_PRESETS = [
  { label: "باب غرفة (0.9×2.1)", name: "باب غرفة", width: "0.9", height: "2.1", count: "1" },
  { label: "باب حمام (0.8×2.1)", name: "باب حمام", width: "0.8", height: "2.1", count: "1" },
  { label: "باب مدخل (1.1×2.2)", name: "باب رئيسي", width: "1.1", height: "2.2", count: "1" },
];

const WIN_PRESETS = [
  { label: "نافذة (1.2×1.5)", name: "نافذة غرفة", width: "1.2", height: "1.5", count: "1" },
  { label: "نافذة صالة (2.0×1.5)", name: "نافذة كبيرة", width: "2.0", height: "1.5", count: "1" },
  { label: "نافذة خدمة (0.6×0.8)", name: "نافذة حمام/مطبخ", width: "0.6", height: "0.8", count: "1" },
];

function OpeningsEditor({
  space,
  onChange,
}: {
  space: SpaceRow;
  onChange: (patch: Partial<SpaceRow>) => void;
}) {
  const updateGroups = (type: "door" | "window", groups: OpeningGroup[]) => {
    const first = groups[0];
    if (type === "door")
      onChange({
        doorGroups: groups,
        doorCount: first?.count ?? "",
        doorH: first?.height ?? "",
        doorW: first?.width ?? "",
      });
    else
      onChange({
        windowGroups: groups,
        winCount: first?.count ?? "",
        winH: first?.height ?? "",
        winW: first?.width ?? "",
      });
  };

  const applyOpeningPreset = (
    type: "door" | "window",
    preset: { name: string; width: string; height: string; count: string }
  ) => {
    const groups = openingGroups(space, type);
    const firstEmpty = groups.length === 1 && !groups[0].count && !groups[0].width;
    if (firstEmpty) {
      updateGroups(type, [{ ...groups[0], ...preset }]);
    } else {
      updateGroups(type, [
        ...groups,
        { id: `${space.id}-${type}-${Date.now()}`, ...preset },
      ]);
    }
  };

  const editor = (type: "door" | "window", label: string) => {
    const groups = openingGroups(space, type);
    const presets = type === "door" ? DOOR_PRESETS : WIN_PRESETS;
    return (
      <div className="rounded-lg border border-line bg-band/20 p-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm">{label}</strong>
          <button
            type="button"
            className="rounded-md border border-line bg-card px-2.5 py-1 text-xs font-semibold hover:border-teal"
            onClick={() =>
              updateGroups(type, [
                ...groups,
                { id: `${space.id}-${type}-${Date.now()}`, name: "", count: "1", height: "", width: "" },
              ])
            }
          >
            + مجموعة جديدة
          </button>
        </div>

        {/* أزرار المقاسات الشائعة السريعة */}
        <div className="mb-2.5 flex flex-wrap gap-1">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyOpeningPreset(type, p)}
              className="rounded border border-line bg-card px-2 py-1 text-[11px] font-semibold text-muted hover:border-teal hover:text-teal"
            >
              + {p.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {groups.map((group, index) => (
            <div key={group.id} className="rounded-md border border-line bg-card p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">
                  {group.name || `${label} #${index + 1}`}
                </span>
                {groups.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-danger"
                    onClick={() =>
                      updateGroups(
                        type,
                        groups.filter((item) => item.id !== group.id)
                      )
                    }
                  >
                    حذف
                  </button>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <TextField
                  label="الوصف"
                  value={group.name}
                  onChange={(value) =>
                    updateGroups(
                      type,
                      groups.map((item) =>
                        item.id === group.id ? { ...item, name: value } : item
                      )
                    )
                  }
                />
                <Field
                  label="العدد"
                  value={group.count}
                  onChange={(value) =>
                    updateGroups(
                      type,
                      groups.map((item) =>
                        item.id === group.id ? { ...item, count: value } : item
                      )
                    )
                  }
                />
                <Field
                  label="العرض (م)"
                  value={group.width}
                  onChange={(value) =>
                    updateGroups(
                      type,
                      groups.map((item) =>
                        item.id === group.id ? { ...item, width: value } : item
                      )
                    )
                  }
                />
                <Field
                  label="الارتفاع (م)"
                  value={group.height}
                  onChange={(value) =>
                    updateGroups(
                      type,
                      groups.map((item) =>
                        item.id === group.id ? { ...item, height: value } : item
                      )
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {editor("door", "الأبواب")}
      {editor("window", "النوافذ")}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-line bg-card hover:border-teal disabled:opacity-40"
    >
      {children}
    </button>
  );
}