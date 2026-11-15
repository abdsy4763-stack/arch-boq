import type {
  BlockRecord,
  CatalogItem,
  EarthworkRow,
  ExtraLine,
  FinishDefinition,
  FinishKind,
  FormulaDefinition,
  OpeningGroup,
  PanelState,
  ReportLine,
  SpaceRow,
  StructuralElementKind,
  StructuralPricing,
  StructuralRow,
} from "./types";

// ملاحظة: هذا الملف لا يستورد أي شيء وقت التشغيل (استيرادات أنواع فقط)،
// لذلك يمكن اختباره مباشرة بـ node --experimental-strip-types.

// ==========================================
// 1. الأعداد والتقريب والمعادلات الآمنة
// ==========================================

export function round2(value: number): number {
  return roundTo(value, 2);
}

function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** يحوّل الأرقام العربية/الفارسية والفواصل العربية والرموز (× ÷ −) إلى صيغة قياسية. */
export function normalizeNumString(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "0";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "0";

  let s = val.trim();
  if (!s) return "0";

  s = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  s = s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  s = s.replace(/[٫,،]/g, ".");
  s = s.replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-");
  return s;
}

export function num(value: unknown): number {
  const parsed = parseFloat(normalizeNumString(value as string | number | undefined | null));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface FormulaResult {
  value: number;
  error: string | null;
}

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

class FormulaError extends Error {}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    if ("+-*/()".includes(ch)) {
      toks.push({ t: "op", v: ch });
      i++;
      continue;
    }
    const numMatch = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(src.slice(i));
    if (numMatch) {
      toks.push({ t: "num", v: Number(numMatch[0]) });
      i += numMatch[0].length;
      continue;
    }
    const idMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (idMatch) {
      toks.push({ t: "id", v: idMatch[0] });
      i += idMatch[0].length;
      continue;
    }
    throw new FormulaError("خطأ في الصياغة");
  }
  return toks;
}

/** محلل تعبيرات حسابية آمن (+ − × ÷ وأقواس ومتغيرات) — لا يستخدم eval ولا new Function. */
function evalTokens(toks: Tok[], vars: Record<string, number>): number {
  let pos = 0;
  const peek = (): Tok | undefined => toks[pos];

  const primary = (depth: number): number => {
    if (depth > 60) throw new FormulaError("خطأ في الصياغة");
    const tk = toks[pos++];
    if (!tk) throw new FormulaError("خطأ في الصياغة");
    if (tk.t === "num") return tk.v;
    if (tk.t === "id") {
      if (!Object.prototype.hasOwnProperty.call(vars, tk.v)) {
        throw new FormulaError("متغير غير معروف: " + tk.v);
      }
      return vars[tk.v];
    }
    if (tk.v === "(") {
      const v = expr(depth + 1);
      const close = toks[pos++];
      if (!close || close.t !== "op" || close.v !== ")") throw new FormulaError("خطأ في الصياغة");
      return v;
    }
    throw new FormulaError("خطأ في الصياغة");
  };

  const unary = (depth: number): number => {
    const tk = peek();
    if (tk && tk.t === "op" && (tk.v === "-" || tk.v === "+")) {
      pos++;
      const v = unary(depth + 1);
      return tk.v === "-" ? -v : v;
    }
    return primary(depth);
  };

  const term = (depth: number): number => {
    let v = unary(depth);
    for (;;) {
      const tk = peek();
      if (tk && tk.t === "op" && (tk.v === "*" || tk.v === "/")) {
        pos++;
        const r = unary(depth);
        v = tk.v === "*" ? v * r : v / r;
      } else return v;
    }
  };

  const expr = (depth: number): number => {
    let v = term(depth);
    for (;;) {
      const tk = peek();
      if (tk && tk.t === "op" && (tk.v === "+" || tk.v === "-")) {
        pos++;
        const r = term(depth);
        v = tk.v === "+" ? v + r : v - r;
      } else return v;
    }
  };

  const result = expr(0);
  if (pos !== toks.length) throw new FormulaError("خطأ في الصياغة");
  return result;
}

export function evaluateFormula(
  expr: string | number | undefined | null,
  vars: Record<string, number> = {},
): FormulaResult {
  if (expr === undefined || expr === null) return { value: 0, error: null };
  const raw = String(expr);
  if (!raw.trim()) return { value: 0, error: null };
  try {
    const src = normalizeNumString(raw);
    if (src.length > 500) return { value: 0, error: "المعادلة طويلة جداً" };
    const result = evalTokens(tokenize(src), vars);
    if (typeof result !== "number" || !Number.isFinite(result)) {
      return { value: 0, error: "خطأ رياضي" };
    }
    if (result < 0) return { value: 0, error: "النتيجة سالبة" };
    return { value: result, error: null };
  } catch (err) {
    return { value: 0, error: err instanceof FormulaError ? err.message : "خطأ في الصياغة" };
  }
}

export function numExpr(expr: string | number | undefined | null): number {
  return evaluateFormula(expr, {}).value;
}

export function fmt(value: number): string {
  return round2(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtLoose(value: number): string {
  return round2(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function downloadText(filename: string, text: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// 2. الثوابت والمتغيرات الهندسية
// ==========================================

export const ARCH_VARIABLES_INFO = [
  { key: "floorArea", label: "مساحة الأرضية", sample: 16 },
  { key: "perimeter", label: "المحيط", sample: 16 },
  { key: "height", label: "ارتفاع الفراغ", sample: 3 },
  { key: "wallArea", label: "مساحة الجدران", sample: 48 },
  { key: "ceilingArea", label: "مساحة السقف", sample: 16 },
  { key: "doorArea", label: "مساحة الأبواب", sample: 2 },
  { key: "windowArea", label: "مساحة النوافذ", sample: 3 },
  { key: "doorWidthTotal", label: "عروض الأبواب", sample: 1 },
  { key: "blockArea", label: "مساحة الكتلة", sample: 150 },
  { key: "facadeArea", label: "مساحة الواجهات", sample: 120 },
];

export const STRUCT_VARIABLES_INFO = [
  { key: "count", label: "العدد", sample: 1 },
  { key: "L", label: "الطول", sample: 4 },
  { key: "W", label: "العرض", sample: 3 },
  { key: "H", label: "الارتفاع", sample: 0.2 },
];

export const STRUCTURAL_KIND_LABELS: Record<string, string> = {
  footing: "قاعدة مسلحة",
  raft: "لبشة / حصيرة",
  neck: "رقبة عمود",
  column: "عمود",
  beam: "جسر / كمرة",
  slab: "بلاطة / سقف",
  wall: "جدار استنادي",
};

const STEEL_RATIO_BY_KIND: Record<StructuralElementKind, string> = {
  footing: "90",
  raft: "110",
  neck: "160",
  column: "180",
  beam: "150",
  slab: "120",
  wall: "130",
};

export const DEFAULT_STRUCTURAL_PRICING: StructuralPricing = {
  rcConcretePrice: 0,
  blindingPrice: 0,
  formworkPrice: 0,
  steelTonPrice: 0,
  excavationPrice: 0,
  backfillPrice: 0,
  concreteWastePct: 5,
  steelWastePct: 5,
  cementGradeKg: 350,
};

function pricingOf(panel: PanelState): StructuralPricing {
  return { ...DEFAULT_STRUCTURAL_PRICING, ...(panel.structuralPricing ?? {}) };
}

export function describeFormulaAr(expr: string): string {
  if (!expr) return "مباشر";
  let desc = expr;
  const dict: Record<string, string> = {
    floorArea: "مساحة الأرضية", perimeter: "المحيط", wallArea: "مساحة الجدران",
    ceilingArea: "مساحة السقف", doorArea: "مساحة الأبواب", windowArea: "مساحة النوافذ",
    doorWidthTotal: "عروض الأبواب", blockArea: "الكتلة", facadeArea: "الواجهات",
    height: "ارتفاع الفراغ",
    count: "العدد", L: "الطول", W: "العرض", H: "الارتفاع",
  };
  Object.keys(dict).forEach((key) => {
    desc = desc.replace(new RegExp(`\\b${key}\\b`, "g"), dict[key]);
  });
  return desc;
}

// ==========================================
// 3. السجلات الفارغة
// ==========================================

let idSeq = 0;
function uid(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}${idSeq.toString(36)}`;
}

export function emptySpace(id: string = uid("space")): SpaceRow {
  return {
    id,
    name: "",
    fn: "",
    length: "",
    width: "",
    height: "",
    shapeMode: "rect",
    parts: [],
    perimeterExpr: "",
    directArea: "",
    islands: [],
    doorCount: "",
    doorH: "",
    doorW: "",
    winCount: "",
    winH: "",
    winW: "",
    floor: "",
    wall: "",
    ceiling: "",
    door: "",
    window: "",
    sill: "",
    tyrolean: "",
    plaster: "",
  };
}

export function emptyExtra(id: string = uid("extra")): ExtraLine {
  return { id, item: "", qty: "" };
}

export function emptyStructuralRow(
  id: string = uid("str"),
  kind: StructuralElementKind = "footing",
): StructuralRow {
  const hasFoundation = kind === "footing" || kind === "raft";
  return {
    id,
    kind,
    name: "",
    count: "1",
    length: "",
    width: "",
    height: "",
    includeFormwork: true,
    includeBlinding: hasFoundation,
    blindingThickness: "0.1",
    blindingProjection: "0.1",
    includeExcavation: hasFoundation,
    excavationDepth: "",
    rebarMode: "ratio",
    steelRatio: STEEL_RATIO_BY_KIND[kind] ?? "100",
    bars: [],
  };
}

export function emptyEarthworkRow(id: string = uid("ew"), kind: EarthworkRow["kind"] = "excavation"): EarthworkRow {
  return {
    id,
    kind,
    name: "",
    count: "1",
    length: "",
    topWidth: "",
    height: "",
    slopeDeg: "0",
    swellPct: "20",
    compactionPct: "15",
  };
}

export function emptyPanel(): PanelState {
  return {
    blockName: "",
    length: "",
    width: "",
    height: "",
    insulation: "",
    facade: "",
    spaces: [emptySpace()],
    extras: [],
    structuralElements: [],
    earthworks: [],
    structuralPricing: { ...DEFAULT_STRUCTURAL_PRICING },
  };
}

export function clonePanel(panel: PanelState): PanelState {
  return JSON.parse(JSON.stringify(panel)) as PanelState;
}

export function validateBlockName(name: string): string | null {
  if (!name.trim()) return "يرجى كتابة اسم الكتلة أولاً (مثل: البلوك أ).";
  return null;
}

// ==========================================
// 4. هندسة الفراغ (مستطيل / مركّب / مباشر + كتل داخلية + فتحات)
// ==========================================

export type Openings = {
  doorCount?: number;
  doorH?: number;
  doorW?: number;
  doorArea: number;
  doorWidthTotal: number;
  winCount?: number;
  winH?: number;
  winW?: number;
  winArea: number;
};

export const NO_OPENINGS: Openings = {
  doorCount: 0, doorH: 0, doorW: 0, doorArea: 0, doorWidthTotal: 0,
  winCount: 0, winH: 0, winW: 0, winArea: 0,
};

export type SpaceGeometry = {
  length: number;
  width: number;
  /** مساحة الأرضية الصافية (بعد خصم الكتل الداخلية) */
  area: number;
  /** مساحة السقف (بعد خصم الكتل التي يُطلب خصمها من السقف) */
  ceilingArea: number;
  /** المحيط الكلي = محيط الفراغ + المحيط الخارجي للكتل الداخلية */
  perimeter: number;
};

export type BlockDims = { length: number; width: number; height: number };

export function openingGroupsOf(space: SpaceRow, type: "door" | "window"): OpeningGroup[] {
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

export function spaceOpenings(space: SpaceRow): Openings {
  const doors = openingGroupsOf(space, "door");
  const wins = openingGroupsOf(space, "window");
  let doorCount = 0, doorArea = 0, doorWidthTotal = 0;
  for (const g of doors) {
    const c = numExpr(g.count), w = numExpr(g.width), h = numExpr(g.height);
    doorCount += c;
    doorArea += c * h * w;
    doorWidthTotal += c * w;
  }
  let winCount = 0, winArea = 0;
  for (const g of wins) {
    const c = numExpr(g.count), w = numExpr(g.width), h = numExpr(g.height);
    winCount += c;
    winArea += c * h * w;
  }
  return {
    doorCount,
    doorH: numExpr(doors[0]?.height),
    doorW: numExpr(doors[0]?.width),
    doorArea,
    doorWidthTotal,
    winCount,
    winH: numExpr(wins[0]?.height),
    winW: numExpr(wins[0]?.width),
    winArea,
  };
}

/** الهندسة غير مقرَّبة عمداً: نتائج المستطيل مطابقة تماماً للصيغ L×W و 2(L+W). */
export function spaceGeometry(space: SpaceRow): SpaceGeometry {
  const mode = space.shapeMode ?? "rect";
  const length = numExpr(space.length);
  const width = numExpr(space.width);

  let baseArea: number;
  let perimeter: number;
  if (mode === "composite") {
    let sum = 0;
    for (const part of space.parts ?? []) {
      const a = numExpr(part.length) * numExpr(part.width);
      sum += part.sign === "sub" ? -a : a;
    }
    baseArea = Math.max(0, sum);
    perimeter = numExpr(space.perimeterExpr);
  } else if (mode === "direct") {
    baseArea = numExpr(space.directArea);
    perimeter = numExpr(space.perimeterExpr);
  } else {
    baseArea = length * width;
    perimeter = 2 * (length + width);
  }

  let floorDeduct = 0;
  let ceilingDeduct = 0;
  for (const island of space.islands ?? []) {
    const l = numExpr(island.length);
    const w = numExpr(island.width);
    const a = l * w;
    floorDeduct += a;
    if (island.deductCeiling !== false) ceilingDeduct += a;
    perimeter += 2 * (l + w);
  }

  return {
    length,
    width,
    area: Math.max(0, baseArea - floorDeduct),
    ceilingArea: Math.max(0, baseArea - ceilingDeduct),
    perimeter,
  };
}

/** رسالة تدقيق للفراغ، أو null إن كان سليماً. */
export function spaceIssue(space: SpaceRow): string | null {
  const mode = space.shapeMode ?? "rect";
  const h = numExpr(space.height);
  if (h <= 0) return "ارتفاع الفراغ غير مُدخل.";

  let baseArea: number;
  if (mode === "rect") {
    const l = numExpr(space.length);
    const w = numExpr(space.width);
    if (l <= 0 || w <= 0) return "أبعاد الفراغ غير صالحة.";
    baseArea = l * w;
  } else if (mode === "composite") {
    const parts = space.parts ?? [];
    if (parts.length === 0) return "أضف جزءاً واحداً على الأقل للفراغ المركّب.";
    if (numExpr(space.perimeterExpr) <= 0) return "أدخل محيط الجدران للفراغ المركّب.";
    let sum = 0;
    for (const part of parts) {
      const a = numExpr(part.length) * numExpr(part.width);
      sum += part.sign === "sub" ? -a : a;
    }
    if (sum <= 0) return "مجموع الأجزاء لا يعطي مساحة موجبة.";
    baseArea = sum;
  } else {
    baseArea = numExpr(space.directArea);
    if (baseArea <= 0) return "أدخل المساحة المباشرة للفراغ.";
    if (numExpr(space.perimeterExpr) <= 0) return "أدخل محيط الجدران للفراغ.";
  }

  let islandsArea = 0;
  for (const island of space.islands ?? []) islandsArea += numExpr(island.length) * numExpr(island.width);
  if (islandsArea > 0 && islandsArea >= baseArea) return "الكتل الداخلية أكبر من مساحة الفراغ.";

  const geo = spaceGeometry(space);
  const ops = spaceOpenings(space);
  if (ops.doorArea + ops.winArea > 0 && ops.doorArea + ops.winArea > geo.perimeter * h) {
    return "مساحة الفتحات (أبواب/نوافذ) أكبر من مساحة الجدران نفسها!";
  }
  return null;
}

export function kpis(spaces: SpaceRow[]) {
  let floor = 0;
  let doors = 0;
  let windows = 0;
  let alerts = 0;
  for (const space of spaces) {
    floor += spaceGeometry(space).area;
    const ops = spaceOpenings(space);
    doors += ops.doorCount ?? 0;
    windows += ops.winCount ?? 0;
    if (space.name.trim() !== "" && spaceIssue(space) !== null) alerts += 1;
  }
  return { spaces: spaces.length, floor: round2(floor), doors, windows, alerts };
}

// ==========================================
// 5. الكمية الأساسية للبند
// ==========================================

function formulaVars(
  g: SpaceGeometry,
  H: number,
  open: Openings,
  blockDims?: BlockDims,
): Record<string, number> {
  const doorArea = open.doorArea;
  const windowArea = open.winArea;
  const wallArea = Math.max(0, g.perimeter * H - (doorArea + windowArea));
  return {
    floorArea: g.area,
    perimeter: g.perimeter,
    height: H,
    wallArea,
    ceilingArea: g.ceilingArea,
    doorArea,
    windowArea,
    doorWidthTotal: open.doorWidthTotal,
    blockArea: blockDims ? blockDims.length * blockDims.width : g.area,
    facadeArea: blockDims
      ? 2 * (blockDims.length + blockDims.width) * blockDims.height
      : g.perimeter * H,
    totalDoorArea: doorArea,
    totalWindowArea: windowArea,
    totalDoorWidth: open.doorWidthTotal,
  };
}

function kindQuantity(kind: FinishKind, v: Record<string, number>): number {
  switch (kind) {
    case "floor":
    case "insulation": return v.floorArea;
    case "ceiling": return v.ceilingArea;
    case "wall":
    case "plaster": return v.wallArea;
    case "facade": return v.facadeArea;
    case "sill": return Math.max(0, v.perimeter - v.doorWidthTotal);
    case "tyrolean": return v.doorWidthTotal;
    case "door": return v.doorArea;
    case "window": return v.windowArea;
    default: return 0;
  }
}

/** المعادلة الافتراضية لكل نوع تشطيب (تطابق catalog.defaultFormula). */
export function defaultFormulaFor(kind: FinishKind): string {
  switch (kind) {
    case "floor": return "floorArea";
    case "wall":
    case "plaster": return "wallArea";
    case "ceiling": return "ceilingArea";
    case "facade": return "facadeArea";
    case "insulation": return "blockArea";
    case "door": return "doorArea";
    case "window": return "windowArea";
    case "sill": return "sillLength";
    case "tyrolean": return "doorWidthTotal";
    default: return "direct";
  }
}

/**
 * @param kind        نوع التشطيب (يُستخدم عند غياب المعادلة)
 * @param L,W,H       أبعاد المستطيل المرجعي (تُستخدم إن لم تُمرَّر geo)
 * @param open        الفتحات
 * @param isBlock     true = حساب على مستوى الكتلة: تُهمل الفتحات ولا يُخصم منها شيء
 * @param formulaId   معادلة قياسية أو معرّف معادلة مخصصة (لها الأولوية على kind)
 * @param formulaDefs المعادلات المخصصة
 * @param geo         هندسة الفراغ (مركّب/كتل داخلية)؛ إن غابت يُحسب مستطيل L×W
 * @param blockDims   أبعاد الكتلة لمتغيّري blockArea و facadeArea داخل معادلات الفراغات
 */
export function baseQuantity(
  kind: FinishKind,
  L: number,
  W: number,
  H: number,
  open: Openings,
  isBlock: boolean,
  formulaId?: string,
  formulaDefs: FormulaDefinition[] = [],
  geo?: SpaceGeometry,
  blockDims?: BlockDims,
): number {
  const g: SpaceGeometry = geo ?? {
    length: L,
    width: W,
    area: L * W,
    ceilingArea: L * W,
    perimeter: 2 * (L + W),
  };
  const v = formulaVars(g, H, isBlock ? NO_OPENINGS : open, blockDims);

  let result: number;
  switch (formulaId) {
    case undefined:
    case "": result = kindQuantity(kind, v); break;
    case "floorArea": result = v.floorArea; break;
    case "wallArea": result = v.wallArea; break;
    case "ceilingArea": result = v.ceilingArea; break;
    case "blockArea": result = v.blockArea; break;
    case "facadeArea": result = v.facadeArea; break;
    case "doorArea": result = v.doorArea; break;
    case "windowArea": result = v.windowArea; break;
    case "sillLength": result = Math.max(0, v.perimeter - v.doorWidthTotal); break;
    case "doorWidthTotal": result = v.doorWidthTotal; break;
    case "direct": result = 1; break;
    default: {
      const def = formulaDefs.find((f) => f.id === formulaId);
      result = def ? evaluateFormula(def.expression, v).value : kindQuantity(kind, v);
    }
  }
  return Number.isFinite(result) ? Math.max(0, result) : 0;
}

// ==========================================
// 6. الحسابات الإنشائية والترابية
// ==========================================

export function calcStructuralRow(row: StructuralRow) {
  const count = numExpr(row.count);
  const L = numExpr(row.length);
  const W = numExpr(row.width);
  const H = numExpr(row.height);

  let concreteVol = count * L * W * H;
  if (row.customConcreteExpr) {
    concreteVol = evaluateFormula(row.customConcreteExpr, { count, L, W, H }).value;
  }

  let formworkArea = 0;
  if (row.customFormworkExpr) {
    formworkArea = evaluateFormula(row.customFormworkExpr, { count, L, W, H }).value;
  } else if (row.kind === "footing") formworkArea = count * 2 * (L + W) * H;
  else if (row.kind === "column" || row.kind === "neck") formworkArea = count * 2 * (L + W) * H;
  else if (row.kind === "beam") formworkArea = count * (L * W + 2 * L * H);
  else if (row.kind === "slab") formworkArea = count * L * W;
  else if (row.kind === "wall") formworkArea = count * 2 * L * H;
  else formworkArea = count * 2 * (L + W) * H;
  if (!row.includeFormwork) formworkArea = 0;

  let steelKg = 0;
  if (row.rebarMode === "ratio") {
    steelKg = concreteVol * numExpr(row.steelRatio);
  } else if (row.bars) {
    for (const b of row.bars) {
      const cBars = numExpr(b.barsCount);
      const lBars = numExpr(b.barLength);
      const dia = numExpr(b.diameter);
      const weightPerMeter = (dia * dia) / 162.2;
      steelKg += count * cBars * lBars * weightPerMeter;
    }
  }

  const bt = numExpr(row.blindingThickness ?? "0.1");
  const bp = numExpr(row.blindingProjection ?? "0.1");
  const blindingVol = row.includeBlinding ? count * (L + 2 * bp) * (W + 2 * bp) * bt : 0;

  const exD = row.excavationDepth ? numExpr(row.excavationDepth) : H + bt;
  // +1 م مسافة عمل حول القاعدة
  const excavationVol = row.includeExcavation ? count * (L + 2 * bp + 1) * (W + 2 * bp + 1) * exD : 0;

  return {
    concreteVol: round2(concreteVol),
    formworkArea: round2(formworkArea),
    steelKg: round2(steelKg),
    steelTon: round2(steelKg / 1000),
    blindingVol: round2(blindingVol),
    excavationVol: round2(excavationVol),
  };
}

export function calcEarthworkRow(ew: EarthworkRow) {
  const count = numExpr(ew.count);
  const L = numExpr(ew.length);
  const topW = numExpr(ew.topWidth);
  const H = numExpr(ew.height);
  const slope = numExpr(ew.slopeDeg);
  const swellOrComp = ew.kind === "excavation" ? numExpr(ew.swellPct) : numExpr(ew.compactionPct);

  let bottomWidth = topW;
  let sideSlopeArea = 0;

  if (slope > 0 && slope < 90) {
    const rad = (slope * Math.PI) / 180;
    const run = H / Math.tan(rad);
    bottomWidth = topW + 2 * run;
    const slopeLen = Math.sqrt(H * H + run * run);
    sideSlopeArea = count * L * slopeLen * 2;
  }

  const area = ((topW + bottomWidth) / 2) * H;
  const bankVol = count * L * area;
  const swollenVol = bankVol * (1 + swellOrComp / 100);

  return {
    bankVol: round2(bankVol),
    swollenVol: round2(swollenVol),
    bottomWidth: round2(bottomWidth),
    sideSlopeArea: round2(sideSlopeArea),
  };
}

export function structuralKpis(panel: PanelState) {
  let totalRcConcrete = 0;
  let totalBlinding = 0;
  let totalFormwork = 0;
  let totalSteelKg = 0;
  let totalExcavation = 0;
  let totalBackfillOrBerm = 0;

  for (const el of panel.structuralElements ?? []) {
    const r = calcStructuralRow(el);
    totalRcConcrete += r.concreteVol;
    totalFormwork += r.formworkArea;
    totalSteelKg += r.steelKg;
    totalBlinding += r.blindingVol;
    totalExcavation += r.excavationVol;
  }

  for (const ew of panel.earthworks ?? []) {
    const r = calcEarthworkRow(ew);
    if (ew.kind === "excavation") totalExcavation += r.bankVol;
    else totalBackfillOrBerm += r.swollenVol;
  }

  const pricing = pricingOf(panel);
  const volWithWaste = (totalRcConcrete + totalBlinding) * (1 + pricing.concreteWastePct / 100);
  const cementKg = volWithWaste * (pricing.cementGradeKg || 350);

  return {
    totalRcConcrete: round2(totalRcConcrete),
    totalBlinding: round2(totalBlinding),
    totalFormwork: round2(totalFormwork),
    totalSteelKg: round2(totalSteelKg),
    totalSteelTon: round2(totalSteelKg / 1000),
    totalExcavation: round2(totalExcavation),
    totalBackfillOrBerm: round2(totalBackfillOrBerm),
    mix: {
      cementTons: round2(cementKg / 1000),
      cementBags50kg: Math.ceil(cementKg / 50),
      sandM3: round2(volWithWaste * 0.45),
      gravelM3: round2(volWithWaste * 0.85),
      waterLiters: round2(volWithWaste * 175),
    },
  };
}

// ==========================================
// 7. تقرير الكتلة وملخص المشروع
// ==========================================

type SlotKey = "floor" | "wall" | "ceiling" | "plaster" | "sill" | "door" | "window" | "tyrolean";
const SLOTS: { key: SlotKey; kind: FinishKind }[] = [
  { key: "floor", kind: "floor" },
  { key: "wall", kind: "wall" },
  { key: "ceiling", kind: "ceiling" },
  { key: "plaster", kind: "plaster" },
  { key: "sill", kind: "sill" },
  { key: "door", kind: "door" },
  { key: "window", kind: "window" },
  { key: "tyrolean", kind: "tyrolean" },
];

type LineInput = {
  code: string;
  spaceName: string;
  spaceType: string;
  desc: string;
  unit: string;
  price: number;
  baseQty: number;
  wastePct: number;
  missing?: boolean;
  digits?: number;
};

function makeLine(p: LineInput): ReportLine {
  const d = p.digits ?? 2;
  const baseQty = roundTo(p.baseQty, d);
  const wastePct = Number.isFinite(p.wastePct) ? p.wastePct : 0;
  const wasteQty = roundTo((baseQty * wastePct) / 100, d);
  const finalQty = roundTo(baseQty + wasteQty, d);
  const price = Number.isFinite(p.price) ? p.price : 0;
  return {
    code: p.code,
    spaceName: p.spaceName,
    spaceType: p.spaceType,
    desc: p.desc,
    unit: p.unit,
    finalQty,
    price,
    total: round2(finalQty * price),
    baseQty,
    wastePct,
    wasteQty,
    missing: p.missing === true,
  };
}

const MISSING_DESC = "بند غير موجود في القاعدة";

export function buildBlockReport(
  panel: PanelState,
  items: CatalogItem[],
  wasteFn: (code: string) => number,
  formulaDefs: FormulaDefinition[] = [],
  finishDefs: FinishDefinition[] = [],
): Omit<BlockRecord, "id" | "createdAt"> {
  const byCode = new Map<string, CatalogItem>();
  for (const item of items) byCode.set(item.code, item);

  const lines: ReportLine[] = [];
  const blockDims: BlockDims = {
    length: numExpr(panel.length),
    width: numExpr(panel.width),
    height: numExpr(panel.height),
  };

  const pushItemLine = (
    code: string,
    qty: number,
    spaceName: string,
    fallbackType: string,
  ) => {
    if (!(qty > 0)) return;
    const item = byCode.get(code);
    lines.push(
      makeLine({
        code,
        spaceName,
        spaceType: item?.category || fallbackType,
        desc: item?.desc ?? MISSING_DESC,
        unit: item?.unit ?? "",
        price: item?.price ?? 0,
        baseQty: qty,
        wastePct: wasteFn(code),
        missing: !item,
      }),
    );
  };

  // أ) الأعمال المعمارية لكل فراغ
  for (const space of panel.spaces) {
    const geo = spaceGeometry(space);
    const open = spaceOpenings(space);
    const H = numExpr(space.height);
    const spaceName = space.name.trim() || space.fn.trim() || "فراغ";

    for (const slot of SLOTS) {
      const code = space[slot.key];
      if (!code) continue;
      const item = byCode.get(code);
      const formula = item?.formula || defaultFormulaFor(slot.kind);
      const qty = baseQuantity(slot.kind, geo.length, geo.width, H, open, false, formula, formulaDefs, geo, blockDims);
      pushItemLine(code, qty, spaceName, space.fn);
    }

    for (const def of finishDefs) {
      if (def.archived) continue;
      const code = space.customFinishes?.[def.id];
      if (!code) continue;
      const item = byCode.get(code);
      const formula = def.formulaId || item?.formula || defaultFormulaFor(def.baseKind);
      const qty = baseQuantity(def.baseKind, geo.length, geo.width, H, open, false, formula, formulaDefs, geo, blockDims);
      pushItemLine(code, qty, spaceName, def.label);
    }
  }

  // ب) بنود على مستوى الكتلة: عزل وواجهات (أبعاد الكتلة، بدون خصم فتحات)
  const blockLabel = panel.blockName.trim() || "الكتلة";
  const blockLevel: { code: string; kind: FinishKind }[] = [
    { code: panel.insulation, kind: "insulation" },
    { code: panel.facade, kind: "facade" },
  ];
  for (const b of blockLevel) {
    if (!b.code) continue;
    const item = byCode.get(b.code);
    const formula = item?.formula || defaultFormulaFor(b.kind);
    const qty = baseQuantity(
      b.kind, blockDims.length, blockDims.width, blockDims.height,
      NO_OPENINGS, true, formula, formulaDefs,
    );
    pushItemLine(b.code, qty, blockLabel, "الكتلة");
  }

  // ج) بنود بكمية مقطوعة
  for (const extra of panel.extras ?? []) {
    if (!extra.item) continue;
    pushItemLine(extra.item, numExpr(extra.qty), "بنود مقطوعة", "بنود مقطوعة");
  }

  // د) الأعمال الإنشائية
  const pricing = pricingOf(panel);
  for (const el of panel.structuralElements ?? []) {
    const res = calcStructuralRow(el);
    const kindLabel = STRUCTURAL_KIND_LABELS[el.kind] ?? el.kind;
    const who = (el.name ?? "").trim() || kindLabel;
    const add = (
      code: string, desc: string, unit: string, price: number,
      baseQty: number, wastePct: number, digits = 2,
    ) => {
      if (!(baseQty > 0)) return;
      lines.push(makeLine({ code, spaceName: who, spaceType: kindLabel, desc, unit, price, baseQty, wastePct, digits }));
    };
    add("STR-CONC", "بيتون مسلح", "م³", pricing.rcConcretePrice, res.concreteVol, pricing.concreteWastePct);
    add("STR-STEEL", "حديد تسليح", "طن", pricing.steelTonPrice, res.steelKg / 1000, pricing.steelWastePct, 3);
    add("STR-FORM", "قالب خشبي (طوبار)", "م²", pricing.formworkPrice, res.formworkArea, 0);
    add("STR-BLIND", "بيتون نظافة", "م³", pricing.blindingPrice, res.blindingVol, pricing.concreteWastePct);
    add("EW-EXC-F", "حفر قواعد", "م³", pricing.excavationPrice, res.excavationVol, 0);
  }

  // هـ) الأعمال الترابية العامة
  const earthLabels: Record<EarthworkRow["kind"], { code: string; desc: string }> = {
    excavation: { code: "EW-EXC", desc: "حفر عام" },
    backfill: { code: "EW-FILL", desc: "ردم" },
    berm: { code: "EW-BERM", desc: "ساتر ترابي" },
  };
  for (const ew of panel.earthworks ?? []) {
    const res = calcEarthworkRow(ew);
    if (!(res.bankVol > 0)) continue;
    const meta = earthLabels[ew.kind] ?? earthLabels.excavation;
    const isExc = ew.kind === "excavation";
    lines.push(
      makeLine({
        code: meta.code,
        spaceName: (ew.name ?? "").trim() || meta.desc,
        spaceType: meta.desc,
        desc: meta.desc,
        unit: "م³",
        price: isExc ? pricing.excavationPrice : pricing.backfillPrice,
        baseQty: res.bankVol,
        wastePct: isExc ? numExpr(ew.swellPct) : numExpr(ew.compactionPct),
      }),
    );
  }

  // و) التجميع حسب الكود والوحدة
  const digitsOf = (unit: string) => (unit === "طن" ? 3 : 2);
  const agg = new Map<string, ReportLine>();
  for (const line of lines) {
    const key = `${line.code}|${line.unit}`;
    const d = digitsOf(line.unit);
    const prev = agg.get(key);
    if (!prev) {
      agg.set(key, { ...line, spaceName: "" });
      continue;
    }
    prev.baseQty = roundTo(prev.baseQty + line.baseQty, d);
    prev.wasteQty = roundTo(prev.wasteQty + line.wasteQty, d);
    prev.finalQty = roundTo(prev.finalQty + line.finalQty, d);
    prev.total = round2(prev.total + line.total);
    prev.missing = prev.missing || line.missing;
  }
  const aggregate = Array.from(agg.values()).map((line) => ({
    ...line,
    wastePct: line.baseQty > 0 ? round2((line.wasteQty / line.baseQty) * 100) : line.wastePct,
  }));

  return {
    name: panel.blockName.trim() || "كتلة بدون اسم",
    snapshot: clonePanel(panel),
    lines,
    aggregate,
    detailTotal: round2(lines.reduce((sum, l) => sum + l.total, 0)),
    aggTotal: round2(aggregate.reduce((sum, l) => sum + l.total, 0)),
  };
}

export function buildProjectSummary(blocks: BlockRecord[]) {
  const itemsMap = new Map<
    string,
    { code: string; desc: string; unit: string; price: number; qty: number; total: number }
  >();
  let blocksTotal = 0;

  const blockSummaries = blocks.map((block) => {
    blocksTotal += block.detailTotal;

    for (const line of block.aggregate ?? []) {
      const key = `${line.code}|${line.unit}`;
      const existing = itemsMap.get(key);
      if (existing) {
        existing.qty = round2(existing.qty + line.finalQty);
        existing.total = round2(existing.total + line.total);
      } else {
        itemsMap.set(key, {
          code: line.code,
          desc: line.desc,
          unit: line.unit,
          price: line.price,
          qty: line.finalQty,
          total: round2(line.total),
        });
      }
    }

    return { name: block.name, total: round2(block.detailTotal) };
  });

  return {
    items: Array.from(itemsMap.values()).sort((a, b) => b.total - a.total),
    itemsTotal: round2(blocksTotal),
    blocksTotal: round2(blocksTotal),
    blocks: blockSummaries,
  };
}
