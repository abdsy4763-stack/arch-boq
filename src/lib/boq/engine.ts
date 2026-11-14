import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type {
  BlockRecord,
  CatalogItem,
  EarthworkRow,
  ExtraLine,
  FinishDefinition,
  FinishKind,
  FormulaDefinition,
  PanelState,
  ReportLine,
  SpaceRow,
  StructuralElementKind,
  StructuralPricing,
  StructuralRow,
} from "./types";

const RESERVED = new Set([
  "CONTROL_PANEL",
  "CONTROL",
  "DATABASE",
  "WASTE_RATES",
  "DROPDOWN_LISTS",
  "PROJECT_TOTAL",
  "PROJECT_SUMMARY",
]);

export function cleanText(txt: string): string {
  return txt
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .trim();
}

export function num(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const text = String(value).trim().replace(",", ".");
  if (!text) return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function isMetalUnit(unit: string): boolean {
  return cleanText(unit) === "كغ";
}

export function defaultUnit(kind: FinishKind, metal: boolean): string {
  if (kind === "door" || kind === "window") return metal ? "كغ" : "م²";
  if (kind === "sill" || kind === "tyrolean") return "م.ط";
  return "م²";
}

export function validateBlockName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "اكتب اسم الكتلة أولاً.";
  if (name.length > 27) return "اسم الكتلة طويل. الحد 27 حرفاً لأن التقرير يُحفظ باسم الكتلة.";
  if (/[:\\/?*[\]]/.test(name)) return "الاسم يحتوي رموزاً غير مسموحة: : \\ / ? * [ ]";
  if (name.startsWith("'") || name.endsWith("'")) return "لا يمكن أن يبدأ الاسم أو ينتهي بفاصلة علوية.";
  const upper = name.toUpperCase();
  if (RESERVED.has(upper) || upper.startsWith("RAW_")) return `هذا الاسم محجوز ولا يمكن استخدامه: ${name}`;
  return null;
}

export function lookupItem(items: CatalogItem[], search: string): {
  code: string;
  desc: string;
  unit: string;
  price: number;
  formula: string;
} {
  const cleanSearch = cleanText(search);
  if (!cleanSearch) return { code: "N/A", desc: search, unit: "", price: 0, formula: "direct" };

  const byCode = items.find((item) => {
    const code = cleanText(item.code);
    return code !== "" && code.toUpperCase() === cleanSearch.toUpperCase();
  });
  const found =
    byCode ??
    items.find((item) => {
      const desc = cleanText(item.desc);
      if (!desc) return false;
      return (
        desc === cleanSearch ||
        desc.toLowerCase().includes(cleanSearch.toLowerCase()) ||
        cleanSearch.toLowerCase().includes(desc.toLowerCase())
      );
    });

  if (!found) return { code: "N/A", desc: search, unit: "", price: 0, formula: "direct" };
  return {
    code: cleanText(found.code) || "N/A",
    desc: cleanText(found.desc) || search,
    unit: cleanText(found.unit),
    price: Number.isFinite(found.price) ? found.price : 0,
    formula: found.formula ?? "direct",
  };
}

// ==================== المتغيرات المعمارية والإنشائية وقاموس الترجمة العربية ====================

export const ARCH_VARIABLES_INFO: { key: string; label: string; sample: number }[] = [
  { key: "floorArea", label: "مساحة الأرضية", sample: 14 },
  { key: "ceilingArea", label: "مساحة السقف", sample: 14 },
  { key: "wallArea", label: "مساحة الجدران الصافية", sample: 39.6 },
  { key: "perimeter", label: "محيط الغرفة", sample: 15 },
  { key: "length", label: "طول الغرفة", sample: 4 },
  { key: "width", label: "عرض الغرفة", sample: 3.5 },
  { key: "height", label: "ارتفاع الغرفة", sample: 3 },
  { key: "doorArea", label: "مساحة الأبواب", sample: 1.89 },
  { key: "windowArea", label: "مساحة النوافذ", sample: 3.6 },
  { key: "doorWidthTotal", label: "مجموع عروض الأبواب", sample: 0.9 },
  { key: "doorCount", label: "عدد الأبواب", sample: 1 },
  { key: "winCount", label: "عدد النوافذ", sample: 2 },
  { key: "blockArea", label: "مساحة سطح الكتلة", sample: 120 },
  { key: "facadeArea", label: "مساحة الواجهات", sample: 140 },
];

export const STRUCT_VARIABLES_INFO: { key: string; label: string; sample: number }[] = [
  { key: "L", label: "الطول L", sample: 2.0 },
  { key: "W", label: "العرض W", sample: 1.8 },
  { key: "H", label: "الارتفاع/السماكة H", sample: 0.5 },
  { key: "count", label: "العدد", sample: 1 },
  { key: "proj", label: "رفرفة النظافة", sample: 0.1 },
  { key: "blindThick", label: "سماكة النظافة", sample: 0.1 },
];

const VAR_AR_MAP: Record<string, string> = Object.fromEntries([
  ...ARCH_VARIABLES_INFO.map((v) => [v.key, v.label]),
  ...STRUCT_VARIABLES_INFO.map((v) => [v.key, v.label]),
  ["totalDoorArea", "مساحة الأبواب"],
  ["totalWindowArea", "مساحة النوافذ"],
  ["totalDoorWidth", "مجموع عروض الأبواب"],
]);

/** يحول أي تعبير رياضي برمجي إلى شرح عربي واضح للمستخدم */
export function describeFormulaAr(expression: string): string {
  if (!expression.trim()) return "—";
  return expression
    .replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (token) => VAR_AR_MAP[token] ?? token)
    .replace(/\*/g, " × ")
    .replace(/\//g, " ÷ ")
    .replace(/\+/g, " + ")
    .replace(/-/g, " − ");
}

type Openings = {
  doorCount: number;
  doorH: number;
  doorW: number;
  doorArea: number;
  doorWidthTotal: number;
  winCount: number;
  winH: number;
  winW: number;
  winArea: number;
};

function openingsOf(space: SpaceRow): Openings {
  const doors = space.doorGroups?.length
    ? space.doorGroups
    : [{ count: space.doorCount, height: space.doorH, width: space.doorW }];
  const windows = space.windowGroups?.length
    ? space.windowGroups
    : [{ count: space.winCount, height: space.winH, width: space.winW }];
  const doorTotals = doors.reduce(
    (result, group) => {
      const count = num(group.count);
      const height = num(group.height);
      const width = num(group.width);
      return {
        count: result.count + count,
        area: result.area + count * height * width,
        width: result.width + count * width,
      };
    },
    { count: 0, area: 0, width: 0 },
  );
  const windowTotals = windows.reduce(
    (result, group) => {
      const count = num(group.count);
      const height = num(group.height);
      const width = num(group.width);
      return { count: result.count + count, area: result.area + count * height * width };
    },
    { count: 0, area: 0 },
  );
  return {
    doorCount: doorTotals.count,
    doorH: doors.length === 1 ? num(doors[0].height) : 0,
    doorW: doors.length === 1 ? num(doors[0].width) : 0,
    doorArea: doorTotals.area,
    doorWidthTotal: doorTotals.width,
    winCount: windowTotals.count,
    winH: windows.length === 1 ? num(windows[0].height) : 0,
    winW: windows.length === 1 ? num(windows[0].width) : 0,
    winArea: windowTotals.area,
  };
}

export type Geometry = {
  length: number;
  width: number;
  area: number;
  ceilingArea: number;
  perimeter: number;
};

export function baseQuantity(
  kind: FinishKind,
  length: number,
  width: number,
  height: number,
  open: Openings,
  metal: boolean,
  formula?: string,
  formulaDefinitions: FormulaDefinition[] = [],
  geo?: Pick<Geometry, "area" | "ceilingArea" | "perimeter">,
): number {
  const doorArea = open.doorArea;
  const winArea = open.winArea;
  const doorWidthTotal = open.doorWidthTotal;
  const area = geo ? geo.area : length * width;
  const ceilingArea = geo ? geo.ceilingArea : area;
  const perimeter = geo ? geo.perimeter : 2 * (length + width);
  let qty = 0;
  const vars: Record<string, number> = {
    length,
    width,
    height,
    L: length,
    W: width,
    H: height,
    doorCount: open.doorCount,
    doorH: open.doorH,
    doorW: open.doorW,
    winCount: open.winCount,
    winH: open.winH,
    winW: open.winW,
    floorArea: area,
    wallArea: Math.max(0, perimeter * height - (doorArea + winArea)),
    ceilingArea,
    doorArea,
    windowArea: winArea,
    totalDoorArea: doorArea,
    totalWindowArea: winArea,
    perimeter,
    doorWidthTotal,
    totalDoorWidth: doorWidthTotal,
    blockArea: area,
    facadeArea: perimeter * height,
  };

  const custom = formulaDefinitions.find((definition) => definition.id === formula);
  if (custom) {
    return evaluateFormula(custom.expression, vars);
  }
  if (formula) {
    switch (formula) {
      case "floorArea":
      case "blockArea":
        qty = area;
        break;
      case "ceilingArea":
        qty = ceilingArea;
        break;
      case "wallArea":
        qty = perimeter * height - (doorArea + winArea);
        break;
      case "facadeArea":
        qty = perimeter * height;
        break;
      case "doorArea":
        qty = open.doorArea * (metal ? 40 : 1);
        break;
      case "windowArea":
        qty = open.winArea * (metal ? 20 : 1);
        break;
      case "sillLength":
        qty = perimeter - doorWidthTotal;
        break;
      case "doorWidthTotal":
        qty = doorWidthTotal;
        break;
      case "direct":
        qty = 0;
        break;
      default:
        // إذا كان حقل formula يحتوي على تعبير رياضي مباشر
        qty = evaluateFormula(formula, vars);
        break;
    }
    return Math.max(0, qty);
  }
  switch (kind) {
    case "floor":
    case "insulation":
      qty = area;
      break;
    case "ceiling":
      qty = ceilingArea;
      break;
    case "wall":
    case "plaster":
      qty = perimeter * height - (doorArea + winArea);
      break;
    case "facade":
      qty = perimeter * height;
      break;
    case "door":
      qty = metal ? open.doorArea * 40 : open.doorArea;
      break;
    case "window":
      qty = metal ? open.winArea * 20 : open.winArea;
      break;
    case "sill":
      qty = perimeter - doorWidthTotal;
      break;
    case "tyrolean":
      qty = doorWidthTotal;
      break;
    default:
      qty = 0;
  }
  return Math.max(0, qty);
}

const EXPR_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "٫": ".",
  "×": "*",
  "÷": "/",
};

export function numExpr(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const text = String(value)
    .replace(/[٠-٩٫×÷]/g, (ch) => EXPR_DIGITS[ch] ?? ch)
    .replace(/,/g, ".")
    .trim();
  if (!text) return 0;
  if (/^\d*\.?\d+$|^\d+\.$/.test(text)) return num(text);
  if (!/^[0-9+\-*/().\s]+$/.test(text)) return 0;
  return evaluateFormula(text, {});
}

export function spaceGeometry(space: SpaceRow): Geometry {
  const mode = space.shapeMode ?? "rect";
  const length = num(space.length);
  const width = num(space.width);
  let area: number;
  let perimeter: number;
  if (mode === "composite") {
    area = (space.parts ?? []).reduce(
      (sum, part) => sum + (part.sign === "sub" ? -1 : 1) * numExpr(part.length) * numExpr(part.width),
      0,
    );
    perimeter = numExpr(space.perimeterExpr);
  } else if (mode === "direct") {
    area = numExpr(space.directArea);
    perimeter = numExpr(space.perimeterExpr);
  } else {
    area = length * width;
    perimeter = 2 * (length + width);
  }
  let ceilingArea = area;
  for (const island of space.islands ?? []) {
    const l = numExpr(island.length);
    const w = numExpr(island.width);
    area -= l * w;
    if (island.deductCeiling !== false) ceilingArea -= l * w;
    perimeter += 2 * (l + w);
  }
  return {
    length,
    width,
    area: Math.max(0, area),
    ceilingArea: Math.max(0, ceilingArea),
    perimeter: Math.max(0, perimeter),
  };
}

export function spaceIssue(space: SpaceRow): string | null {
  const mode = space.shapeMode ?? "rect";
  if (mode === "rect") {
    if (space.length.trim() === "" || space.width.trim() === "" || space.height.trim() === "")
      return "ينقص هذا الفراغ طول أو عرض أو ارتفاع.";
    return (space.islands ?? []).length > 0 && spaceGeometry(space).area <= 0
      ? "مساحة الفراغ الصافية صفر أو أقل، راجع الكتل الداخلية."
      : null;
  }
  if (space.height.trim() === "") return "ينقص هذا الفراغ الارتفاع.";
  const geo = spaceGeometry(space);
  if (
    mode === "composite" &&
    !(space.parts ?? []).some((part) => part.sign !== "sub" && numExpr(part.length) * numExpr(part.width) > 0)
  )
    return "أضف جزءاً واحداً على الأقل بطول وعرض.";
  if (mode === "direct" && numExpr(space.directArea) <= 0) return "أدخل مساحة الفراغ.";
  if (numExpr(space.perimeterExpr) <= 0)
    return "أدخل محيط الجدران (يقبل تعبيراً مثل 3.33+5.04+3.33+5.04).";
  if (geo.area <= 0) return "مساحة الفراغ الصافية صفر أو أقل، راجع الأجزاء والكتل الداخلية.";
  return null;
}

export function evaluateFormula(expression: string, variables: Record<string, number>): number {
  const normalized = expression.replace(/[٠-٩٫×÷]/g, (ch) => EXPR_DIGITS[ch] ?? ch);
  const tokens = normalized.match(/[A-Za-z_][A-Za-z0-9_]*|(?:\d+(?:\.\d+)?)|[()+\-*/]/g);
  if (!tokens || tokens.join("") !== normalized.replace(/\s+/g, "")) return 0;
  const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const output: (number | string)[] = [];
  const operators: string[] = [];
  for (const token of tokens) {
    if (/^\d/.test(token)) output.push(Number(token));
    else if (/^[A-Za-z_]/.test(token)) output.push(variables[token] ?? 0);
    else if (token === "(") operators.push(token);
    else if (token === ")") {
      while (operators.length && operators.at(-1) !== "(") output.push(operators.pop()!);
      if (operators.pop() !== "(") return 0;
    } else {
      while (
        operators.length &&
        operators.at(-1) !== "(" &&
        precedence[operators.at(-1)!] >= precedence[token]
      )
        output.push(operators.pop()!);
      operators.push(token);
    }
  }
  while (operators.length) {
    const operator = operators.pop()!;
    if (operator === "(") return 0;
    output.push(operator);
  }
  const values: number[] = [];
  for (const token of output) {
    if (typeof token === "number") values.push(token);
    else {
      const b = values.pop() ?? 0;
      const a = values.pop() ?? 0;
      values.push(
        token === "+" ? a + b : token === "-" ? a - b : token === "*" ? a * b : b === 0 ? 0 : a / b,
      );
    }
  }
  return values.length === 1 && Number.isFinite(values[0]) ? Math.max(0, values[0]) : 0;
}

function applyWaste(baseQty: number, wastePct: number): { wasteQty: number; finalQty: number } {
  const wasteQty = round2((baseQty * wastePct) / 100);
  const finalQty = round2(baseQty + wasteQty);
  return { wasteQty, finalQty };
}

function makeLine(
  item: ReturnType<typeof lookupItem>,
  kind: FinishKind,
  spaceName: string,
  spaceType: string,
  baseQty: number,
  wastePct: number,
): ReportLine {
  const metal = isMetalUnit(item.unit);
  const unit = item.unit || defaultUnit(kind, metal);
  const { wasteQty, finalQty } = applyWaste(baseQty, wastePct);
  return {
    code: item.code,
    spaceName,
    spaceType,
    desc: item.desc,
    unit,
    finalQty,
    price: item.price,
    total: finalQty * item.price,
    baseQty,
    wastePct,
    wasteQty,
    missing: item.code === "N/A",
  };
}

// ==================== المحرك الرياضي للقسم الإنشائي والأعمال الترابية ====================

export const STRUCTURAL_KIND_LABELS: Record<StructuralElementKind, string> = {
  footing: "قاعدة مسلحة",
  raft: "لبشة / حصيرة",
  neck: "رقبة عمود",
  column: "عمود بيتوني",
  beam: "جسر / كمرة",
  slab: "بلاطة / سقف",
  wall: "جدار استنادي / قص",
};

export const DEFAULT_STRUCTURAL_FORMULAS: Record<
  StructuralElementKind,
  { concrete: string; formwork: string }
> = {
  footing: { concrete: "count * L * W * H", formwork: "count * 2 * (L + W) * H" },
  raft: { concrete: "count * L * W * H", formwork: "count * 2 * (L + W) * H" },
  neck: { concrete: "count * L * W * H", formwork: "count * 2 * (L + W) * H" },
  column: { concrete: "count * L * W * H", formwork: "count * 2 * (L + W) * H" },
  beam: { concrete: "count * L * W * H", formwork: "count * (W + 2 * H) * L" },
  slab: { concrete: "count * L * W * H", formwork: "count * (L * W + 2 * (L + W) * H)" },
  wall: { concrete: "count * L * W * H", formwork: "count * 2 * (L + W) * H" },
};

export const DEFAULT_STRUCTURAL_PRICING: StructuralPricing = {
  rcConcretePrice: 120,
  blindingPrice: 75,
  formworkPrice: 15,
  steelTonPrice: 850,
  excavationPrice: 8,
  backfillPrice: 10,
  concreteWastePct: 5,
  steelWastePct: 5,
  cementGradeKg: 350,
};

export function calcStructuralRow(row: StructuralRow): {
  concreteVol: number;
  blindingVol: number;
  excavationVol: number;
  formworkArea: number;
  steelKg: number;
  steelTon: number;
} {
  const count = Math.max(0, numExpr(row.count || "1"));
  const L = Math.max(0, numExpr(row.length));
  const W = Math.max(0, numExpr(row.width));
  const H = Math.max(0, numExpr(row.height));
  const proj = Math.max(0, numExpr(row.blindingProjection ?? "0.10"));
  const blindThick = Math.max(0, numExpr(row.blindingThickness ?? "0.10"));

  const vars: Record<string, number> = {
    count,
    L,
    W,
    H,
    length: L,
    width: W,
    height: H,
    proj,
    blindThick,
  };

  // حساب حجم البيتون (يدعم المعادلة المخصصة إن وجدت)
  const concreteExpr = row.customConcreteExpr?.trim() || DEFAULT_STRUCTURAL_FORMULAS[row.kind].concrete;
  const concreteVol = round2(evaluateFormula(concreteExpr, vars));

  // حساب القالب الخشبي (يدعم المعادلة المخصصة إن وجدت)
  let formworkArea = 0;
  if (row.includeFormwork) {
    const formworkExpr =
      row.customFormworkExpr?.trim() || DEFAULT_STRUCTURAL_FORMULAS[row.kind].formwork;
    formworkArea = round2(evaluateFormula(formworkExpr, vars));
  }

  // بيتون النظافة والحفر (للقواعد واللبشة)
  let blindingVol = 0;
  let excavationVol = 0;
  const planL = L + 2 * proj;
  const planW = W + 2 * proj;

  if ((row.kind === "footing" || row.kind === "raft") && row.includeBlinding) {
    blindingVol = round2(count * planL * planW * blindThick);
  }

  if ((row.kind === "footing" || row.kind === "raft") && row.includeExcavation) {
    const excDepth =
      numExpr(row.excavationDepth) > 0
        ? numExpr(row.excavationDepth)
        : H + (row.includeBlinding ? blindThick : 0);
    excavationVol = round2(count * planL * planW * excDepth);
  }

  // حساب حديد التسليح
  let steelKg = 0;
  if (row.rebarMode === "bars" && row.bars?.length) {
    const singleElementBarsKg = row.bars.reduce((sum, bar) => {
      const d = numExpr(bar.diameter);
      const n = numExpr(bar.barsCount);
      const l = numExpr(bar.barLength);
      const unitWeight = (d * d) / 162.2;
      return sum + unitWeight * l * n;
    }, 0);
    steelKg = round2(count * singleElementBarsKg);
  } else {
    const ratio = Math.max(0, numExpr(row.steelRatio));
    steelKg = round2(concreteVol * ratio);
  }

  return {
    concreteVol,
    blindingVol,
    excavationVol,
    formworkArea,
    steelKg,
    steelTon: round2(steelKg / 1000),
  };
}

export function calcEarthworkRow(row: EarthworkRow): {
  bankVol: number;
  bottomWidth: number;
  swollenVol: number;
  compactedVol: number;
  sideSlopeArea: number;
} {
  const count = Math.max(0, numExpr(row.count || "1"));
  const L = Math.max(0, numExpr(row.length));
  const topW = Math.max(0, numExpr(row.topWidth));
  const H = Math.max(0, numExpr(row.height));
  const deg = Math.max(0, Math.min(89.9, numExpr(row.slopeDeg)));

  let bottomWidth = topW;
  let sideSlopeArea = 0;

  if (deg > 0 && H > 0) {
    const rad = (deg * Math.PI) / 180;
    const horizontalRun = H / Math.tan(rad);
    bottomWidth = round2(topW + 2 * horizontalRun);
    const slantLength = H / Math.sin(rad);
    sideSlopeArea = round2(count * 2 * slantLength * L);
  } else {
    sideSlopeArea = round2(count * 2 * H * L);
  }

  const crossSectionArea = ((topW + bottomWidth) / 2) * H;
  const bankVol = round2(count * crossSectionArea * L);

  const swellPct = Math.max(0, numExpr(row.swellPct));
  const compactionPct = Math.max(0, numExpr(row.compactionPct));

  const swollenVol = round2(bankVol * (1 + swellPct / 100));
  const compactedVol = round2(bankVol * (1 + compactionPct / 100));

  return {
    bankVol,
    bottomWidth,
    swollenVol,
    compactedVol,
    sideSlopeArea,
  };
}

export function calcConcreteMixMaterials(
  rcVolWithWaste: number,
  blindingVolWithWaste: number,
  cementGradeKg = 350,
): {
  cementTons: number;
  cementBags50kg: number;
  sandM3: number;
  gravelM3: number;
  waterLiters: number;
} {
  const totalCementKg = rcVolWithWaste * cementGradeKg + blindingVolWithWaste * 200;
  const totalVol = rcVolWithWaste + blindingVolWithWaste;

  return {
    cementTons: round2(totalCementKg / 1000),
    cementBags50kg: Math.ceil(totalCementKg / 50),
    sandM3: round2(totalVol * 0.45),
    gravelM3: round2(totalVol * 0.85),
    waterLiters: Math.round(rcVolWithWaste * 175 + blindingVolWithWaste * 140),
  };
}

export function structuralKpis(panel: PanelState) {
  const pricing = panel.structuralPricing ?? DEFAULT_STRUCTURAL_PRICING;
  const elements = panel.structuralElements ?? [];
  const earthworks = panel.earthworks ?? [];

  let totalRcConcrete = 0;
  let totalBlinding = 0;
  let totalFormwork = 0;
  let totalSteelKg = 0;
  let totalExcavation = 0;
  let totalBackfillOrBerm = 0;

  for (const el of elements) {
    const res = calcStructuralRow(el);
    totalRcConcrete += res.concreteVol;
    totalBlinding += res.blindingVol;
    totalFormwork += res.formworkArea;
    totalSteelKg += res.steelKg;
    totalExcavation += res.excavationVol;
  }

  for (const ew of earthworks) {
    const res = calcEarthworkRow(ew);
    if (ew.kind === "excavation") totalExcavation += res.bankVol;
    else totalBackfillOrBerm += res.bankVol;
  }

  const rcFinal = applyWaste(totalRcConcrete, pricing.concreteWastePct).finalQty;
  const blindFinal = applyWaste(totalBlinding, pricing.concreteWastePct).finalQty;
  const mix = calcConcreteMixMaterials(rcFinal, blindFinal, pricing.cementGradeKg);

  return {
    totalRcConcrete: round2(totalRcConcrete),
    totalBlinding: round2(totalBlinding),
    totalFormwork: round2(totalFormwork),
    totalSteelKg: round2(totalSteelKg),
    totalSteelTon: round2(totalSteelKg / 1000),
    totalExcavation: round2(totalExcavation),
    totalBackfillOrBerm: round2(totalBackfillOrBerm),
    mix,
  };
}

const SPACE_FIELDS: { key: keyof SpaceRow; kind: FinishKind }[] = [
  { key: "floor", kind: "floor" },
  { key: "wall", kind: "wall" },
  { key: "ceiling", kind: "ceiling" },
  { key: "door", kind: "door" },
  { key: "window", kind: "window" },
  { key: "sill", kind: "sill" },
  { key: "tyrolean", kind: "tyrolean" },
  { key: "plaster", kind: "plaster" },
];

export function buildBlockReport(
  panel: PanelState,
  items: CatalogItem[],
  wasteFor: (code: string) => number,
  formulaDefinitions: FormulaDefinition[] = [],
  finishDefinitions: FinishDefinition[] = [],
): Omit<BlockRecord, "id" | "createdAt"> {
  const name = panel.blockName.trim();
  const lines: ReportLine[] = [];
  const blockL = num(panel.length);
  const blockW = num(panel.width);
  const blockH = num(panel.height);

  if (cleanText(panel.insulation)) {
    const item = lookupItem(items, panel.insulation);
    const pct = item.code === "N/A" ? 0 : wasteFor(item.code);
    lines.push(
      makeLine(
        item,
        "insulation",
        `الكتلة ${name}`,
        "عزل السطح",
        baseQuantity("insulation", blockL, blockW, blockH, emptyOpen(), false, item.formula, formulaDefinitions),
        pct,
      ),
    );
  }

  if (cleanText(panel.facade)) {
    const item = lookupItem(items, panel.facade);
    const pct = item.code === "N/A" ? 0 : wasteFor(item.code);
    lines.push(
      makeLine(
        item,
        "facade",
        `الكتلة ${name}`,
        "أعمال الواجهات",
        baseQuantity("facade", blockL, blockW, blockH, emptyOpen(), false, item.formula, formulaDefinitions),
        pct,
      ),
    );
  }

  for (const space of panel.spaces) {
    const spaceName = space.name.trim();
    if (!spaceName) continue;
    const open = openingsOf(space);
    const geo = spaceGeometry(space);
    const L = geo.length;
    const W = geo.width;
    const H = num(space.height);
    for (const field of SPACE_FIELDS) {
      const selected = String(space[field.key] ?? "");
      if (!cleanText(selected)) continue;
      const item = lookupItem(items, selected);
      const metal = isMetalUnit(item.unit);
      const pct = item.code === "N/A" ? 0 : wasteFor(item.code);
      const raw = baseQuantity(field.kind, L, W, H, open, metal, item.formula, formulaDefinitions, geo);
      lines.push(makeLine(item, field.kind, spaceName, space.fn.trim(), round2(raw), pct));
    }
    for (const definition of finishDefinitions) {
      const selected = space.customFinishes?.[definition.id] ?? "";
      if (!cleanText(selected)) continue;
      const item = lookupItem(items, selected);
      const metal = isMetalUnit(item.unit);
      const pct = item.code === "N/A" ? 0 : wasteFor(item.code);
      const raw = baseQuantity(definition.baseKind, L, W, H, open, metal, definition.formulaId, formulaDefinitions, geo);
      lines.push(makeLine(item, definition.baseKind, spaceName, `${space.fn.trim()} — ${definition.label}`, round2(raw), pct));
    }
  }

  const pricing = panel.structuralPricing ?? DEFAULT_STRUCTURAL_PRICING;
  const pushStructLine = (
    code: string,
    spaceName: string,
    spaceType: string,
    desc: string,
    unit: string,
    baseQty: number,
    wastePct: number,
    price: number,
  ) => {
    if (baseQty <= 0) return;
    const { wasteQty, finalQty } = applyWaste(baseQty, wastePct);
    lines.push({
      code,
      spaceName,
      spaceType,
      desc,
      unit,
      baseQty: round2(baseQty),
      wastePct,
      wasteQty,
      finalQty,
      price,
      total: round2(finalQty * price),
      missing: false,
    });
  };

  for (const el of panel.structuralElements ?? []) {
    const elName = el.name.trim() || STRUCTURAL_KIND_LABELS[el.kind];
    const elType = STRUCTURAL_KIND_LABELS[el.kind];
    const calc = calcStructuralRow(el);

    if (calc.excavationVol > 0) {
      pushStructLine("STR-EXC", elName, elType, "حفر هندسي للأساسات والقواعد", "م³", calc.excavationVol, 0, pricing.excavationPrice);
    }
    if (calc.blindingVol > 0) {
      pushStructLine("STR-BLIND", elName, elType, "بيتون نظافة عيار 200 كغ/م³ أسفل الأساسات", "م³", calc.blindingVol, pricing.concreteWastePct, pricing.blindingPrice);
    }
    if (calc.concreteVol > 0) {
      pushStructLine("STR-RC", elName, elType, `بيتون مسلح عيار ${pricing.cementGradeKg} كغ/م³ (${elType})`, "م³", calc.concreteVol, pricing.concreteWastePct, pricing.rcConcretePrice);
    }
    if (calc.formworkArea > 0) {
      pushStructLine("STR-FORM", elName, elType, `قالب خشبي (طوبار) لزوم ${elType}`, "م²", calc.formworkArea, 0, pricing.formworkPrice);
    }
    if (calc.steelTon > 0) {
      pushStructLine("STR-STEEL", elName, elType, `حديد تسليح لزوم ${elType}`, "طن", calc.steelTon, pricing.steelWastePct, pricing.steelTonPrice);
    }
  }

  for (const ew of panel.earthworks ?? []) {
    const ewName = ew.name.trim() || (ew.kind === "excavation" ? "حفر عام" : ew.kind === "berm" ? "ساتر ترابي" : "ردم وتشكيل");
    const ewType = ew.kind === "excavation" ? "أعمال حفر" : ew.kind === "berm" ? "ساتر ترابي بميول" : "أعمال ردم";
    const calc = calcEarthworkRow(ew);

    if (ew.kind === "excavation") {
      pushStructLine("EW-EXC", ewName, ewType, `حفر ترابي هندسي (الحجم المنتفش للنقل: ${fmtLoose(calc.swollenVol)} م³)`, "م³", calc.bankVol, 0, pricing.excavationPrice);
    } else {
      pushStructLine(
        "EW-FILL",
        ewName,
        ewType,
        `${ewType} (العرض السفلي: ${fmtLoose(calc.bottomWidth)} م — مساحة الميول: ${fmtLoose(calc.sideSlopeArea)} م²)`,
        "م³",
        calc.bankVol,
        numExpr(ew.compactionPct),
        pricing.backfillPrice,
      );
    }
  }

  for (const extra of panel.extras ?? []) {
    if (!cleanText(extra.item)) continue;
    const item = lookupItem(items, extra.item);
    const pct = item.code === "N/A" ? 0 : wasteFor(item.code);
    lines.push(makeLine(item, "extra", "بند مباشر", "كمية مدخلة", round2(num(extra.qty)), pct));
  }

  const aggregate = aggregateLines(lines);
  return {
    name,
    snapshot: clonePanel(panel),
    lines,
    aggregate,
    detailTotal: lines.reduce((sum, line) => sum + line.total, 0),
    aggTotal: aggregate.reduce((sum, line) => sum + line.total, 0),
  };
}

function emptyOpen(): Openings {
  return { doorCount: 0, doorH: 0, doorW: 0, doorArea: 0, doorWidthTotal: 0, winCount: 0, winH: 0, winW: 0, winArea: 0 };
}

function aggregateLines(lines: ReportLine[]): ReportLine[] {
  const order: string[] = [];
  const map = new Map<string, ReportLine>();
  for (const line of lines) {
    const key = `${line.code}\u0001${line.desc}\u0001${line.unit}`;
    const existing = map.get(key);
    if (!existing) {
      order.push(key);
      map.set(key, {
        ...line,
        spaceName: "",
        spaceType: "",
        baseQty: line.baseQty,
        wasteQty: line.wasteQty,
        finalQty: line.finalQty,
      });
    } else {
      existing.baseQty += line.baseQty;
      existing.wasteQty += line.wasteQty;
      existing.finalQty += line.finalQty;
    }
  }
  return order.map((key) => {
    const line = map.get(key)!;
    const baseQty = round2(line.baseQty);
    const wasteQty = round2(line.wasteQty);
    const finalQty = round2(line.finalQty);
    return {
      ...line,
      baseQty,
      wasteQty,
      finalQty,
      total: finalQty * line.price,
    };
  });
}

export type ProjectItem = {
  code: string;
  desc: string;
  unit: string;
  qty: number;
  price: number;
  total: number;
};

export function buildProjectSummary(blocks: BlockRecord[]): {
  items: ProjectItem[];
  itemsTotal: number;
  blocks: { name: string; total: number }[];
  blocksTotal: number;
} {
  const order: string[] = [];
  const map = new Map<string, ProjectItem>();
  for (const block of blocks) {
    for (const line of block.lines) {
      if (!line.desc && !line.code) continue;
      const key = `${line.code}|${line.desc}|${line.unit}|${line.price}`;
      const existing = map.get(key);
      if (existing) {
        existing.qty += line.finalQty;
      } else {
        order.push(key);
        map.set(key, {
          code: line.code,
          desc: line.desc,
          unit: line.unit,
          qty: line.finalQty,
          price: line.price,
          total: 0,
        });
      }
    }
  }
  const items = order.map((key) => {
    const item = map.get(key)!;
    const qty = round2(item.qty);
    return { ...item, qty, total: qty * item.price };
  });
  const blockRows = blocks.map((block) => ({
    name: block.name,
    total: block.detailTotal,
  }));
  return {
    items,
    itemsTotal: items.reduce((sum, item) => sum + item.total, 0),
    blocks: blockRows,
    blocksTotal: blockRows.reduce((sum, block) => sum + block.total, 0),
  };
}

export function kpis(spaces: SpaceRow[]) {
  const named = spaces.filter((space) => space.name.trim() !== "");
  const floor = named.reduce((sum, space) => sum + spaceGeometry(space).area, 0);
  const doors = spaces.reduce((sum, space) => sum + openingsOf(space).doorCount, 0);
  const windows = spaces.reduce((sum, space) => sum + openingsOf(space).winCount, 0);
  const alerts = named.filter((space) => spaceIssue(space) !== null).length;
  return { spaces: named.length, floor, doors, windows, alerts };
}

export function clonePanel(panel: PanelState): PanelState {
  return {
    ...panel,
    spaces: panel.spaces.map((space) => ({
      ...space,
      customFinishes: space.customFinishes ? { ...space.customFinishes } : undefined,
      parts: space.parts?.map((part) => ({ ...part })),
      islands: space.islands?.map((island) => ({ ...island })),
    })),
    extras: (panel.extras ?? []).map((line) => ({ ...line })),
    structuralElements: (panel.structuralElements ?? []).map((el) => ({
      ...el,
      bars: el.bars?.map((b) => ({ ...b })),
    })),
    earthworks: (panel.earthworks ?? []).map((ew) => ({ ...ew })),
    structuralPricing: panel.structuralPricing
      ? { ...panel.structuralPricing }
      : { ...DEFAULT_STRUCTURAL_PRICING },
  };
}

export function emptySpace(id: string): SpaceRow {
  return {
    id,
    name: "",
    fn: "",
    length: "",
    width: "",
    height: "",
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

export function emptyStructuralRow(id: string, kind: StructuralElementKind = "footing"): StructuralRow {
  const defaultRatios: Record<StructuralElementKind, string> = {
    footing: "90",
    raft: "110",
    neck: "160",
    column: "180",
    beam: "150",
    slab: "120",
    wall: "130",
  };
  return {
    id,
    kind,
    name: "",
    count: "1",
    length: "",
    width: "",
    height: "",
    includeFormwork: true,
    includeBlinding: kind === "footing" || kind === "raft",
    blindingThickness: "0.10",
    blindingProjection: "0.10",
    includeExcavation: kind === "footing" || kind === "raft",
    excavationDepth: "",
    rebarMode: "ratio",
    steelRatio: defaultRatios[kind],
    bars: [],
    customConcreteExpr: "",
    customFormworkExpr: "",
  };
}

export function emptyEarthworkRow(id: string, kind: EarthworkRow["kind"] = "excavation"): EarthworkRow {
  return {
    id,
    kind,
    name: "",
    count: "1",
    length: "",
    topWidth: "",
    height: "",
    slopeDeg: kind === "berm" ? "56.3" : "0",
    swellPct: "25",
    compactionPct: kind === "excavation" ? "0" : "15",
  };
}

export function emptyExtra(id: string): ExtraLine {
  return { id, item: "", qty: "" };
}

export function emptyPanel(): PanelState {
  return {
    blockName: "",
    length: "",
    width: "",
    height: "",
    insulation: "",
    facade: "",
    spaces: [emptySpace("s1"), emptySpace("s2")],
    extras: [],
    structuralElements: [],
    earthworks: [],
    structuralPricing: { ...DEFAULT_STRUCTURAL_PRICING },
  };
}

export function fmt(n: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0);
}

export function fmtLoose(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

export function csvEscape(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function reportToCsv(block: BlockRecord, which: "detail" | "aggregate" = "detail"): string {
  const headers = [
    "كود البند",
    "اسم الفراغ",
    "نوع الفراغ",
    "وصف البند",
    "وحدة القياس",
    "الكمية النهائية",
    "السعر الإفرادي",
    "السعر الإجمالي للبند",
    "الكمية الأساسية",
    "نسبة الهدر %",
    "كمية الهدر",
  ];
  const source = which === "detail" ? block.lines : block.aggregate;
  const rows = source.map((line) =>
    [
      line.code,
      line.spaceName,
      line.spaceType,
      line.desc,
      line.unit,
      line.finalQty,
      line.price,
      round2(line.total),
      line.baseQty,
      line.wastePct,
      line.wasteQty,
    ]
      .map(csvEscape)
      .join(","),
  );
  return `\uFEFF${headers.join(",")}\n${rows.join("\n")}\n`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function shareNativeFile(filename: string, base64: string): Promise<void> {
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });
  await Share.share({
    title: filename,
    text: "تقرير حصر الكميات الهندسي",
    url: uri,
    dialogTitle: "حفظ أو مشاركة التقرير",
  });
}

export async function downloadBinary(
  filename: string,
  bytes: Uint8Array,
  mime = "application/octet-stream",
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await shareNativeFile(filename, bytesToBase64(bytes));
    } catch {
      if (typeof window !== "undefined") window.alert("تعذر فتح خيارات حفظ أو مشاركة الملف.");
    }
    return;
  }
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8"): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const bytes = new TextEncoder().encode(content);
      await shareNativeFile(filename, bytesToBase64(bytes));
    } catch {
      if (typeof window !== "undefined") window.alert("تعذر فتح خيارات حفظ أو مشاركة التقرير.");
    }
    return;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}