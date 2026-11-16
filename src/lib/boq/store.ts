import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultFormula, defaultKinds, effectiveItems, wastePercent } from "./catalog";
import {
  buildBlockReport,
  clonePanel,
  DEFAULT_STRUCTURAL_PRICING,
  emptyEarthworkRow,
  emptyExtra,
  emptyPanel,
  emptySpace,
  emptyStructuralRow,
  validateBlockName,
} from "./engine";
import type {
  BlockRecord,
  CatalogItem,
  EarthworkRow,
  FinishDefinition,
  FormulaDefinition,
  ItemPatch,
  PanelState,
  ReportSettings,
  SpaceRow,
  SpaceTemplate,
  StructuralElementKind,
  StructuralPricing,
  StructuralRow,
  TabId,
} from "./types";
import { parseAndValidateBackup } from "./io";
type State = {
  panel: PanelState;
  blocks: BlockRecord[];
  activeBlockId: string | null;
  patches: Record<string, ItemPatch>;
  customItems: CatalogItem[];
  hiddenCodes: string[];
  wasteOverrides: Record<string, number>;
  formulaDefinitions: FormulaDefinition[];
  finishDefinitions: FinishDefinition[];
  templates: SpaceTemplate[];
  reportSettings: ReportSettings;
  tab: TabId;
  notice: string | null;
  undoSnapshot: { panel: PanelState; blocks: BlockRecord[]; activeBlockId: string | null } | null;
  setTab: (tab: TabId) => void;
  setNotice: (notice: string | null) => void;
  undoLast: () => void;
  setBlockField: (key: "blockName" | "length" | "width" | "height" | "insulation" | "facade", value: string) => void;
  updateSpace: (id: string, patch: Partial<PanelState["spaces"][number]>) => void;
  addSpace: () => void;
  removeSpace: (id: string) => void;
  duplicateSpace: (id: string) => void;
  copyFinishesFromPrevious: (id: string) => void;
  addExtra: () => void;
  updateExtra: (id: string, patch: Partial<PanelState["extras"][number]>) => void;
  removeExtra: (id: string) => void;
  addStructuralElement: (kind?: StructuralElementKind) => void;
  updateStructuralElement: (id: string, patch: Partial<StructuralRow>) => void;
  duplicateStructuralElement: (id: string) => void;
  removeStructuralElement: (id: string) => void;
  addEarthwork: (kind?: EarthworkRow["kind"]) => void;
  updateEarthwork: (id: string, patch: Partial<EarthworkRow>) => void;
  removeEarthwork: (id: string) => void;
  setStructuralPricing: (patch: Partial<StructuralPricing>) => void;
  generate: () => void;
  loadBlock: (id: string) => void;
  deleteBlock: (id: string) => void;
  clearPanel: () => void;
  setWaste: (code: string, value: number) => void;
  resetWaste: (code: string) => void;
  patchItem: (code: string, patch: ItemPatch) => void;
  addCustomItem: (item: CatalogItem) => string | null;
  removeCustomItem: (code: string) => void;
  // إدارة المعادلات وخيارات التشطيب المخصصة
  addFormulaDefinition: (definition: FormulaDefinition) => string | null;
  updateFormulaDefinition: (id: string, patch: Partial<Omit<FormulaDefinition, "id">>) => void;
  removeFormulaDefinition: (id: string) => void;
  addFinishDefinition: (definition: FinishDefinition) => string | null;
  updateFinishDefinition: (id: string, patch: Partial<Omit<FinishDefinition, "id">>) => void;
  archiveFinishDefinition: (id: string, archived: boolean) => void;
  removeFinishDefinition: (id: string) => void;
  saveTemplate: (template: SpaceTemplate) => void;
  applyTemplate: (spaceId: string, templateId: string) => void;
  applyFinishToSpaces: (spaceIds: string[], key: string, value: string) => void;
  loadDemoProject: () => void;
  setReportSettings: (patch: Partial<ReportSettings>) => void;
  replaceAll: (data: Partial<Pick<State, "panel" | "blocks" | "patches" | "customItems" | "hiddenCodes" | "wasteOverrides" | "formulaDefinitions" | "finishDefinitions" | "templates" | "reportSettings">>) => void;
};

function nid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

const READY_TEMPLATES: SpaceTemplate[] = [
  { id: "ready-bedroom", name: "غرفة نوم", data: { fn: "غرفة نوم", length: "4", width: "3.5", height: "3", doorCount: "1", doorH: "2.1", doorW: "0.9", winCount: "2", winH: "1.5", winW: "1.2" } },
  { id: "ready-living", name: "صالة", data: { fn: "صالة", length: "5", width: "4", height: "3", doorCount: "1", doorH: "2.1", doorW: "0.9", winCount: "2", winH: "1.5", winW: "1.5" } },
  { id: "ready-kitchen", name: "مطبخ", data: { fn: "مطبخ", length: "3.5", width: "3", height: "3", doorCount: "1", doorH: "2.1", doorW: "0.9", winCount: "1", winH: "1.2", winW: "1" } },
  { id: "ready-bathroom", name: "حمام", data: { fn: "حمام", length: "2.5", width: "2", height: "3", doorCount: "1", doorH: "2.1", doorW: "0.8", winCount: "1", winH: "0.8", winW: "0.6" } },
  { id: "ready-balcony", name: "شرفة", data: { fn: "شرفة", length: "4", width: "1.5", height: "3", doorCount: "1", doorH: "2.1", doorW: "0.9", winCount: "0", winH: "", winW: "" } },
];

const DEFAULT_CUSTOM_FORMULAS: FormulaDefinition[] = [
  {
    id: "formula-wet-isolation",
    name: "عزل مائي للحمامات (أرضية + وزرة 30 سم)",
    expression: "floorArea + (perimeter - doorWidthTotal) * 0.30",
    scope: "arch",
    unit: "م²",
  },
  {
    id: "formula-ceramic-dado",
    name: "سيراميك جدران بارتفاع 1.5 متر",
    expression: "(perimeter - doorWidthTotal) * 1.5",
    scope: "arch",
    unit: "م²",
  },
  {
    id: "formula-cove-lighting",
    name: "بيت نور جبس بورد محيطي",
    expression: "perimeter",
    scope: "arch",
    unit: "م.ط",
  },
];

export const useBoq = create<State>()(
  persist(
    (set, get) => ({
      backupSnapshot: null,
      panel: emptyPanel(),
      blocks: [],
      activeBlockId: null,
      patches: {},
      customItems: [],
      hiddenCodes: [],
      wasteOverrides: {},
      formulaDefinitions: DEFAULT_CUSTOM_FORMULAS,
      finishDefinitions: [],
      templates: READY_TEMPLATES,
      reportSettings: { companyName: "", projectName: "", signatureLabel: "اعتماد المهندس" },
      tab: "panel",
      notice: null,
      undoSnapshot: null,
      setTab: (tab) => set({ tab }),
      setNotice: (notice) => set({ notice }),
      undoLast: () => {
        const snapshot = get().undoSnapshot;
        if (!snapshot) return;
        set({ ...snapshot, undoSnapshot: null, notice: "تم التراجع عن العملية." });
      },
      setBlockField: (key, value) => set({ panel: { ...get().panel, [key]: value } }),
      updateSpace: (id, patch) =>
        set({
          panel: {
            ...get().panel,
            spaces: get().panel.spaces.map((space) => (space.id === id ? { ...space, ...patch } : space)),
          },
        }),
      addSpace: () =>
        set({
          panel: { ...get().panel, spaces: [...get().panel.spaces, emptySpace(nid("s"))] },
        }),
      removeSpace: (id) => {
        const state = get();
        if (!state.panel.spaces.some((space) => space.id === id)) return;
        set({
          panel: { ...state.panel, spaces: state.panel.spaces.filter((space) => space.id !== id) },
          undoSnapshot: { panel: clonePanel(state.panel), blocks: state.blocks, activeBlockId: state.activeBlockId },
          notice: "تم حذف الفراغ — تراجع؟",
        });
      },
      duplicateSpace: (id) => {
        const spaces = get().panel.spaces;
        const index = spaces.findIndex((space) => space.id === id);
        if (index < 0) return;
        const copy = { ...spaces[index], id: nid("s"), name: spaces[index].name ? `${spaces[index].name} نسخة` : "" };
        const next = [...spaces];
        next.splice(index + 1, 0, copy);
        set({ panel: { ...get().panel, spaces: next } });
      },
      copyFinishesFromPrevious: (id) => {
        const spaces = get().panel.spaces;
        const index = spaces.findIndex((space) => space.id === id);
        if (index <= 0) return;
        const prev = spaces[index - 1];
        set({
          panel: {
            ...get().panel,
            spaces: spaces.map((space) =>
              space.id === id
                ? {
                    ...space,
                    floor: prev.floor,
                    wall: prev.wall,
                    ceiling: prev.ceiling,
                    door: prev.door,
                    window: prev.window,
                    sill: prev.sill,
                    tyrolean: prev.tyrolean,
                    plaster: prev.plaster,
                    customFinishes: prev.customFinishes ? { ...prev.customFinishes } : undefined,
                  }
                : space,
            ),
          },
        });
      },
      addExtra: () =>
        set({ panel: { ...get().panel, extras: [...(get().panel.extras ?? []), emptyExtra(nid("x"))] } }),
      updateExtra: (id, patch) =>
        set({
          panel: {
            ...get().panel,
            extras: (get().panel.extras ?? []).map((line) => (line.id === id ? { ...line, ...patch } : line)),
          },
        }),
      removeExtra: (id) =>
        set({ panel: { ...get().panel, extras: (get().panel.extras ?? []).filter((line) => line.id !== id) } }),

      addStructuralElement: (kind: StructuralElementKind = "footing") =>
        set({
          panel: {
            ...get().panel,
            structuralElements: [...(get().panel.structuralElements ?? []), emptyStructuralRow(nid("str"), kind)],
          },
        }),
      updateStructuralElement: (id, patch) =>
        set({
          panel: {
            ...get().panel,
            structuralElements: (get().panel.structuralElements ?? []).map((el) =>
              el.id === id ? { ...el, ...patch } : el,
            ),
          },
        }),
      duplicateStructuralElement: (id) => {
        const list = get().panel.structuralElements ?? [];
        const index = list.findIndex((el) => el.id === id);
        if (index < 0) return;
        const copy: StructuralRow = {
          ...list[index],
          id: nid("str"),
          name: list[index].name ? `${list[index].name} نسخة` : "",
          bars: list[index].bars?.map((b) => ({ ...b, id: nid("bar") })),
        };
        const next = [...list];
        next.splice(index + 1, 0, copy);
        set({ panel: { ...get().panel, structuralElements: next } });
      },
      removeStructuralElement: (id) =>
        set({
          panel: {
            ...get().panel,
            structuralElements: (get().panel.structuralElements ?? []).filter((el) => el.id !== id),
          },
        }),
      addEarthwork: (kind: EarthworkRow["kind"] = "excavation") =>
        set({
          panel: {
            ...get().panel,
            earthworks: [...(get().panel.earthworks ?? []), emptyEarthworkRow(nid("ew"), kind)],
          },
        }),
      updateEarthwork: (id, patch) =>
        set({
          panel: {
            ...get().panel,
            earthworks: (get().panel.earthworks ?? []).map((ew) => (ew.id === id ? { ...ew, ...patch } : ew)),
          },
        }),
      removeEarthwork: (id) =>
        set({
          panel: {
            ...get().panel,
            earthworks: (get().panel.earthworks ?? []).filter((ew) => ew.id !== id),
          },
        }),
      setStructuralPricing: (patch) =>
        set({
          panel: {
            ...get().panel,
            structuralPricing: {
              ...(get().panel.structuralPricing ?? DEFAULT_STRUCTURAL_PRICING),
              ...patch,
            },
          },
        }),

      generate: () => {
        const state = get();
        const error = validateBlockName(state.panel.blockName);
        if (error) {
          set({ notice: error });
          return;
        }
        const name = state.panel.blockName.trim();
        const exists = state.blocks.some((block) => block.name === name);
        if (exists && typeof window !== "undefined") {
          const ok = window.confirm(`يوجد تقرير باسم «${name}». هل يُستبدل؟`);
          if (!ok) return;
        }
        const items = effectiveItems(state.patches, state.customItems, state.hiddenCodes);
        const report = buildBlockReport(
          state.panel,
          items,
          (code) => wastePercent(code, state.wasteOverrides),
          state.formulaDefinitions,
          state.finishDefinitions,
        );
        const record: BlockRecord = {
          ...report,
          id: exists ? (state.blocks.find((block) => block.name === name)?.id ?? nid("b")) : nid("b"),
          createdAt: new Date().toISOString(),
        };
        const blocks = exists
          ? state.blocks.map((block) => (block.name === name ? record : block))
          : [...state.blocks, record];
        const missing = record.lines.filter((line) => line.missing).length;
        set({
          blocks,
          activeBlockId: record.id,
          tab: "reports",
          notice:
            record.lines.length === 0
              ? "تم حفظ الكتلة، لكن لا توجد بنود. اختر تشطيباً أو أضف عنصراً إنشائياً."
              : missing
                ? `تم توليد تقرير «${name}» مع ${missing} بند غير موجود في القاعدة.`
                : `تم توليد تقرير «${name}» — ${record.lines.length} بنداً (معماري وإنشائي).`,
        });
      },
      exportUnifiedProject: () => {
    const state = get();
    const backup = {
      version: 2,
      blocks: state.blocks,
      patches: state.patches,
      customItems: state.customItems,
      hiddenCodes: state.hiddenCodes,
      wasteOverrides: state.wasteOverrides,
      formulaDefinitions: state.formulaDefinitions,
      finishDefinitions: state.finishDefinitions,
      reportSettings: state.reportSettings,
    };
    return JSON.stringify(backup, null, 2);
  },

  importProjectSafely: (jsonString: string) => {
    const result = parseAndValidateBackup(jsonString);
    if (!result.success || !result.data) {
      return { success: false, message: result.error ?? "خطأ غير معروف" };
    }

    const currentStateJson = get().exportUnifiedProject();
    
    set({
      backupSnapshot: currentStateJson,
      blocks: result.data.blocks,
      patches: result.data.patches,
      customItems: result.data.customItems,
      hiddenCodes: result.data.hiddenCodes,
      wasteOverrides: result.data.wasteOverrides,
      formulaDefinitions: result.data.formulaDefinitions,
      finishDefinitions: result.data.finishDefinitions,
      reportSettings: result.data.reportSettings,
    });
    return { success: true };
  },

  undoImport: () => {
    const snapshot = get().backupSnapshot;
    if (!snapshot) return;
    
    const result = parseAndValidateBackup(snapshot);
    if (result.success && result.data) {
      set({
        backupSnapshot: null,
        blocks: result.data.blocks,
        patches: result.data.patches,
        customItems: result.data.customItems,
        hiddenCodes: result.data.hiddenCodes,
        wasteOverrides: result.data.wasteOverrides,
        formulaDefinitions: result.data.formulaDefinitions,
        finishDefinitions: result.data.finishDefinitions,
        reportSettings: result.data.reportSettings,
      });
    }
  },
      loadBlock: (id) => {
        const block = get().blocks.find((item) => item.id === id);
        if (!block) return;
        set({
          panel: clonePanel({ ...block.snapshot, extras: block.snapshot.extras ?? [] }),
          tab: "panel",
          notice: `تم تحميل بيانات الكتلة «${block.name}» إلى لوحة التحكم.`,
        });
      },
      deleteBlock: (id) => {
        const state = get();
        const blocks = state.blocks.filter((block) => block.id !== id);
        if (blocks.length === state.blocks.length) return;
        set({
          blocks,
          activeBlockId: state.activeBlockId === id ? (blocks[0]?.id ?? null) : state.activeBlockId,
          undoSnapshot: { panel: clonePanel(state.panel), blocks: state.blocks, activeBlockId: state.activeBlockId },
          notice: "تم حذف التقرير — تراجع؟",
        });
      },
      clearPanel: () => {
        const state = get();
        set({
          panel: emptyPanel(),
          undoSnapshot: { panel: clonePanel(state.panel), blocks: state.blocks, activeBlockId: state.activeBlockId },
          notice: "تم تفريغ لوحة التحكم — تراجع؟",
        });
      },
      setWaste: (code, value) =>
        set({ wasteOverrides: { ...get().wasteOverrides, [code]: Math.min(100, Math.max(0, value)) } }),
      resetWaste: (code) => {
        const next = { ...get().wasteOverrides };
        delete next[code];
        set({ wasteOverrides: next });
      },
      patchItem: (code, patch) => set({ patches: { ...get().patches, [code]: { ...get().patches[code], ...patch } } }),
      addCustomItem: (item) => {
        const code = item.code.trim();
        if (!code) return "اكتب كود البند.";
        const items = effectiveItems(get().patches, get().customItems, get().hiddenCodes);
        if (items.some((row) => row.code.toUpperCase() === code.toUpperCase())) return "هذا الكود مستخدم مسبقاً.";
        const allowedKinds = item.allowedKinds?.length ? item.allowedKinds : defaultKinds(item.category, item.kind);
        set({ customItems: [...get().customItems, { ...item, code, allowedKinds, formula: item.formula ?? defaultFormula(allowedKinds) }] });
        return null;
      },
      removeCustomItem: (code) => set({ customItems: get().customItems.filter((item) => item.code !== code) }),

      // ==================== إدارة المعادلات وخيارات التشطيب المخصصة ====================
      addFormulaDefinition: (definition) => {
        if (!definition.id || !definition.name || !definition.expression) return "أكمل اسم المعادلة والتعبير.";
        if (get().formulaDefinitions.some((item) => item.id === definition.id)) return "معرف المعادلة مستخدم مسبقاً.";
        set({ formulaDefinitions: [...get().formulaDefinitions, definition] });
        return null;
      },
      updateFormulaDefinition: (id, patch) =>
        set({
          formulaDefinitions: get().formulaDefinitions.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        }),
      removeFormulaDefinition: (id) =>
        set({
          formulaDefinitions: get().formulaDefinitions.filter((item) => item.id !== id),
        }),
      addFinishDefinition: (definition) => {
        if (!definition.id || !definition.label || !definition.formulaId) return "أكمل اسم التصنيف والمعادلة.";
        if (get().finishDefinitions.some((item) => item.id === definition.id)) return "معرف تصنيف الإكساء مستخدم مسبقاً.";
        set({ finishDefinitions: [...get().finishDefinitions, { ...definition, archived: false }] });
        return null;
      },
      updateFinishDefinition: (id, patch) =>
        set({
          finishDefinitions: get().finishDefinitions.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        }),
      archiveFinishDefinition: (id, archived) =>
        set({
          finishDefinitions: get().finishDefinitions.map((item) =>
            item.id === id ? { ...item, archived } : item,
          ),
        }),
      removeFinishDefinition: (id) =>
        set({
          finishDefinitions: get().finishDefinitions.filter((item) => item.id !== id),
        }),

      saveTemplate: (template) => {
        if (!template.name.trim()) return;
        set({ templates: [...get().templates.filter((item) => item.id !== template.id), { ...template, name: template.name.trim() }] });
      },
      applyTemplate: (spaceId, templateId) => {
        const template = get().templates.find((item) => item.id === templateId);
        if (!template) return;
        set({ panel: { ...get().panel, spaces: get().panel.spaces.map((space) => space.id === spaceId ? { ...space, ...template.data } : space) }, notice: `تم تطبيق قالب «${template.name}».` });
      },
      applyFinishToSpaces: (spaceIds, key, value) =>
        set({
          panel: {
            ...get().panel,
            spaces: get().panel.spaces.map((space) => {
              if (!spaceIds.includes(space.id)) return space;
              if (key.startsWith("custom:")) {
                const customId = key.replace("custom:", "");
                return {
                  ...space,
                  customFinishes: { ...(space.customFinishes ?? {}), [customId]: value },
                };
              }
              return { ...space, [key]: value };
            }),
          },
          notice: `تم تطبيق التشطيب على ${spaceIds.length} فراغ.`,
        }),
      loadDemoProject: () => {
        const first = emptySpace(nid("demo"));
        const second = emptySpace(nid("demo"));
        const f1 = emptyStructuralRow(nid("str"), "footing");
        const c1 = emptyStructuralRow(nid("str"), "column");
        set({
          panel: {
            ...emptyPanel(),
            blockName: "مشروع تجريبي متكامل",
            spaces: [
              { ...first, name: "غرفة نوم تجريبية", fn: "غرفة نوم", length: "4", width: "3.5", height: "3", doorCount: "1", doorH: "2.1", doorW: "0.9", winCount: "2", winH: "1.5", winW: "1.2" },
              { ...second, name: "صالة تجريبية", fn: "صالة", length: "5", width: "4", height: "3", doorCount: "1", doorH: "2.1", doorW: "0.9", winCount: "2", winH: "1.5", winW: "1.5" },
            ],
            structuralElements: [
              { ...f1, name: "قواعد منفصلة ق1", count: "8", length: "2.0", width: "1.8", height: "0.5", steelRatio: "95" },
              { ...c1, name: "أعمدة الطابق الأرضي ع1", count: "8", length: "0.6", width: "0.3", height: "3.2", steelRatio: "185" },
            ],
          },
          tab: "panel",
          notice: "تم تحميل المشروع التجريبي (معماري + إنشائي).",
        });
      },
      setReportSettings: (patch) => set({ reportSettings: { ...get().reportSettings, ...patch } }),
      replaceAll: (data) =>
        set({
          panel: data.panel ? clonePanel({ ...emptyPanel(), ...data.panel, extras: data.panel.extras ?? [] }) : get().panel,
          blocks: data.blocks ?? get().blocks,
          patches: data.patches ?? {},
          customItems: data.customItems ?? [],
          hiddenCodes: data.hiddenCodes ?? [],
          wasteOverrides: data.wasteOverrides ?? {},
          formulaDefinitions: data.formulaDefinitions ?? get().formulaDefinitions,
          finishDefinitions: data.finishDefinitions ?? get().finishDefinitions,
          templates: data.templates ?? get().templates,
          reportSettings: data.reportSettings ?? get().reportSettings,
          activeBlockId: data.blocks?.[0]?.id ?? null,
          notice: "تم استيراد ملف المشروع.",
        }),
    }),
    {
      name: "boq-arch-v1",
      skipHydration: true,
      partialize: (state) => ({
        panel: state.panel,
        blocks: state.blocks,
        activeBlockId: state.activeBlockId,
        patches: state.patches,
        customItems: state.customItems,
        hiddenCodes: state.hiddenCodes,
        wasteOverrides: state.wasteOverrides,
        formulaDefinitions: state.formulaDefinitions,
        finishDefinitions: state.finishDefinitions,
        templates: state.templates,
        reportSettings: state.reportSettings,
        tab: state.tab,
      }),
    },
  ),
);
