import type { EarthworkRow, StructuralRow, PanelState, BlockRecord, ReportLine, SpaceRecord, ExtraRecord } from "./types";
import { CATEGORIES } from "./catalog";

// ==========================================
// 1. أدوات الرياضيات والتقريب المالي الدقيق
// ==========================================

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeNumString(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "0";
  if (typeof val === "number") return val.toString();
  
  let normalized = val.trim();
  if (!normalized) return "0";

  const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  arabicNumbers.forEach((arNum, i) => {
    normalized = normalized.replace(new RegExp(arNum, 'g'), i.toString());
  });

  normalized = normalized.replace(/[٫,]/g, ".");
  return normalized;
}

export function num(value: any): number {
  const parsed = parseFloat(normalizeNumString(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface FormulaResult {
  value: number;
  error: string | null;
}

export function evaluateFormula(expr: string, vars: Record<string, number>): FormulaResult {
  try {
    if (!expr || !expr.trim()) return { value: 0, error: null };
    
    const safeExpr = normalizeNumString(expr).replace(/\s+/g, "");
    const varNames = Object.keys(vars);
    const varValues = Object.values(vars);
    
    const fn = new Function(...varNames, `return ${safeExpr};`);
    const result = fn(...varValues);
    
    if (typeof result !== "number" || Number.isNaN(result) || !Number.isFinite(result)) {
      return { value: 0, error: "خطأ رياضي" };
    }
    if (result < 0) {
      return { value: 0, error: "النتيجة سالبة" };
    }
    
    return { value: result, error: null };
  } catch (err) {
    return { value: 0, error: "خطأ في الصياغة" };
  }
}

export function numExpr(expr: string): number {
  return evaluateFormula(expr, {}).value;
}

export function fmt(value: number): string {
  return round2(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtLoose(value: number): string {
  return round2(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
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
// 2. الثوابت والمتغيرات الهندسية (المعماري والإنشائي)
// ==========================================

export const ARCH_VARIABLES_INFO = [
  { key: "floorArea", label: "مساحة الأرضية", sample: 16 },
  { key: "perimeter", label: "المحيط", sample: 16 },
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

export const DEFAULT_STRUCTURAL_PRICING = {
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

export function describeFormulaAr(expr: string): string {
  if (!expr) return "مباشر";
  let desc = expr;
  const dict: Record<string, string> = {
    floorArea: "مساحة الأرضية", perimeter: "المحيط", wallArea: "مساحة الجدران",
    ceilingArea: "مساحة السقف", doorArea: "مساحة الأبواب", windowArea: "مساحة النوافذ",
    doorWidthTotal: "عروض الأبواب", blockArea: "الكتلة", facadeArea: "الواجهات",
    count: "العدد", L: "الطول", W: "العرض", H: "الارتفاع"
  };
  Object.keys(dict).forEach((key) => {
    desc = desc.replace(new RegExp(`\\b${key}\\b`, "g"), dict[key]);
  });
  return desc;
}

// ==========================================
// 3. الحسابات المعمارية والإنشائية والترابية الدقيقة
// ==========================================

export function emptySpace(): SpaceRecord {
  return {
    id: "space-" + Date.now(),
    name: "غرفة جديدة",
    type: "room",
    width: "4",
    length: "4",
    height: "3",
    count: "1",
    doors: [],
    windows: [],
    finishes: [],
  };
}

export function emptyExtra(): ExtraRecord {
  return {
    id: "extra-" + Date.now(),
    name: "",
    code: "",
    count: "1",
    length: "",
    width: "",
    height: "",
    factor: "",
    active: true,
  };
}

export function emptyStructuralRow(kind: StructuralRow["kind"]): StructuralRow {
  return {
    id: "struct-" + Date.now(),
    kind,
    name: "",
    count: "1",
    length: "1",
    width: "1",
    height: "1",
    steelRatio: "100",
    rebarMode: "ratio",
    bars: [],
    includeFormwork: true,
    includeBlinding: kind === "footing" || kind === "raft",
    includeExcavation: kind === "footing" || kind === "raft",
  };
}

export function emptyEarthworkRow(kind: EarthworkRow["kind"]): EarthworkRow {
  return {
    id: "ew-" + Date.now(),
    kind,
    name: "",
    count: "1",
    length: "10",
    topWidth: "2",
    height: "1",
    slopeDeg: "0",
    swellPct: "20",
    compactionPct: "15",
  };
}

export function emptyPanel(): PanelState {
  return {
    blockName: "",
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

export function spaceGeometry(space: SpaceRecord) {
  const w = numExpr(space.width);
  const l = numExpr(space.length);
  const h = numExpr(space.height);
  
  let doorArea = 0;
  let doorWidthTotal = 0;
  for (const d of space.doors) {
    const dW = numExpr(d.width);
    const dH = numExpr(d.height);
    const dc = numExpr(d.count);
    doorArea += dW * dH * dc;
    doorWidthTotal += dW * dc;
  }
  
  let windowArea = 0;
  for (const win of space.windows) {
    const wW = numExpr(win.width);
    const wH = numExpr(win.height);
    const wc = numExpr(win.count);
    windowArea += wW * wH * wc;
  }
  
  const floorArea = w * l;
  const perimeter = (w + l) * 2;
  const wallArea = Math.max(0, perimeter * h - doorArea - windowArea);
  
  return {
    floorArea: round2(floorArea),
    perimeter: round2(perimeter),
    wallArea: round2(wallArea),
    ceilingArea: round2(floorArea),
    doorArea: round2(doorArea),
    windowArea: round2(windowArea),
    doorWidthTotal: round2(doorWidthTotal),
  };
}

export function spaceIssue(space: SpaceRecord) {
  const w = numExpr(space.width);
  const l = numExpr(space.length);
  const h = numExpr(space.height);
  if (w <= 0 || l <= 0 || h <= 0) return "أبعاد الغرفة غير صالحة.";
  
  const geo = spaceGeometry(space);
  if (geo.wallArea === 0 && (geo.doorArea > 0 || geo.windowArea > 0)) {
    return "مساحة الفتحات (أبواب/نوافذ) أكبر من مساحة الجدران نفسها!";
  }
  return null;
}

export function kpis(panel: PanelState) {
  let totalFloor = 0;
  let totalWall = 0;
  for (const space of panel.spaces) {
    const count = numExpr(space.count);
    const geo = spaceGeometry(space);
    totalFloor += geo.floorArea * count;
    totalWall += geo.wallArea * count;
  }
  return {
    totalFloor: round2(totalFloor),
    totalWall: round2(totalWall),
  };
}

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
  } else {
    if (row.kind === "footing") formworkArea = count * 2 * (L + W) * H;
    else if (row.kind === "column" || row.kind === "neck") formworkArea = count * 2 * (L + W) * H;
    else if (row.kind === "beam") formworkArea = count * (L * W + 2 * L * H);
    else if (row.kind === "slab") formworkArea = count * L * W;
    else if (row.kind === "wall") formworkArea = count * 2 * L * H;
    else formworkArea = count * 2 * (L + W) * H; 
  }
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
  
  const exD = row.excavationDepth ? numExpr(row.excavationDepth) : (H + bt);
  const excavationVol = row.includeExcavation ? count * (L + 2 * bp + 1) * (W + 2 * bp + 1) * exD : 0; // تم إضافة +1 كمسافة عمل

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

  for (const el of panel.structuralElements || []) {
    const r = calcStructuralRow(el);
    totalRcConcrete += r.concreteVol;
    totalFormwork += r.formworkArea;
    totalSteelKg += r.steelKg;
    totalBlinding += r.blindingVol;
    totalExcavation += r.excavationVol;
  }

  for (const ew of panel.earthworks || []) {
    const r = calcEarthworkRow(ew);
    if (ew.kind === "excavation") {
      totalExcavation += r.bankVol;
    } else {
      totalBackfillOrBerm += r.swollenVol;
    }
  }

  const pricing = panel.structuralPricing || DEFAULT_STRUCTURAL_PRICING;
  const concreteWaste = pricing.concreteWastePct / 100;
  const volWithWaste = (totalRcConcrete + totalBlinding) * (1 + concreteWaste);
  const cementGrade = pricing.cementGradeKg || 350;
  const cementKg = volWithWaste * cementGrade;

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
// 4. بناء ملخص المشروع وتقارير الكتل
// ==========================================

export function baseQuantity(
  space: SpaceRecord,
  formulaId: string,
  formulaDefinitions: any[],
  customExpr?: string
): number {
  if (customExpr) {
    const geo = spaceGeometry(space);
    const vars = {
      ...geo,
      blockArea: 0,
      facadeArea: 0,
      totalDoorArea: geo.doorArea,
      totalWindowArea: geo.windowArea,
      totalDoorWidth: geo.doorWidthTotal,
    };
    return evaluateFormula(customExpr, vars).value;
  }

  const geo = spaceGeometry(space);
  switch (formulaId) {
    case "floorArea": return geo.floorArea;
    case "wallArea": return geo.wallArea;
    case "ceilingArea": return geo.ceilingArea;
    case "doorArea": return geo.doorArea;
    case "windowArea": return geo.windowArea;
    case "doorWidthTotal": return geo.doorWidthTotal;
    case "sillLength": return Math.max(0, geo.perimeter - geo.doorWidthTotal);
    case "direct": return 1;
    default: {
      const def = formulaDefinitions.find(f => f.id === formulaId);
      if (def) {
        const vars = {
          ...geo,
          blockArea: 0,
          facadeArea: 0,
          totalDoorArea: geo.doorArea,
          totalWindowArea: geo.windowArea,
          totalDoorWidth: geo.doorWidthTotal,
        };
        return evaluateFormula(def.expression, vars).value;
      }
      return 0;
    }
  }
}

export function buildBlockReport(
  panel: PanelState,
  catalog: any[],
  formulaDefs: any[],
  wasteOverrides: Record<string, number>
): BlockRecord {
  const lines: ReportLine[] = [];
  
  // تجميع الأعمال المعمارية
  for (const space of panel.spaces) {
    const spaceCount = numExpr(space.count);
    for (const fin of space.finishes) {
      if (!fin.code) continue;
      const item = catalog.find(i => i.code === fin.code);
      if (!item) continue;
      
      const bQty = baseQuantity(space, fin.formulaId ?? item.formula, formulaDefs, fin.customFormulaExpr);
      if (bQty <= 0) continue;
      
      const netQty = bQty * spaceCount;
      const wastePct = wasteOverrides[item.code] ?? (item.defaultWaste || 0);
      const finalQty = netQty * (1 + wastePct / 100);
      
      lines.push({
        id: `${space.id}-${fin.id}`,
        code: item.code,
        desc: item.desc,
        unit: item.unit,
        price: item.price,
        netQty: round2(netQty),
        wastePct,
        finalQty: round2(finalQty),
        total: round2(finalQty * item.price),
        spaceName: space.name,
      });
    }
  }

  // تجميع الأعمال الإضافية
  for (const extra of panel.extras) {
    if (!extra.active || !extra.code) continue;
    const item = catalog.find(i => i.code === extra.code);
    if (!item) continue;
    
    const count = numExpr(extra.count);
    const w = numExpr(extra.width) || 1;
    const l = numExpr(extra.length) || 1;
    const h = numExpr(extra.height) || 1;
    const f = numExpr(extra.factor) || 1;
    
    const netQty = count * w * l * h * f;
    const wastePct = wasteOverrides[item.code] ?? (item.defaultWaste || 0);
    const finalQty = netQty * (1 + wastePct / 100);
    
    lines.push({
      id: extra.id,
      code: item.code,
      desc: item.desc,
      unit: item.unit,
      price: item.price,
      netQty: round2(netQty),
      wastePct,
      finalQty: round2(finalQty),
      total: round2(finalQty * item.price),
      spaceName: "أعمال إضافية",
    });
  }

  // تجميع الأعمال الإنشائية
  const pricing = panel.structuralPricing || DEFAULT_STRUCTURAL_PRICING;
  for (const el of panel.structuralElements || []) {
    const res = calcStructuralRow(el);
    if (res.concreteVol > 0) {
      lines.push({
        id: `${el.id}-conc`,
        code: "STR-CONC",
        desc: `بيتون مسلح - ${STRUCTURAL_KIND_LABELS[el.kind] || el.kind} (${el.name})`,
        unit: "م³",
        price: pricing.rcConcretePrice,
        netQty: res.concreteVol,
        wastePct: pricing.concreteWastePct,
        finalQty: round2(res.concreteVol * (1 + pricing.concreteWastePct / 100)),
        total: round2(res.concreteVol * (1 + pricing.concreteWastePct / 100) * pricing.rcConcretePrice),
        spaceName: "أعمال إنشائية",
      });
    }
    if (res.steelKg > 0) {
      lines.push({
        id: `${el.id}-steel`,
        code: "STR-STEEL",
        desc: `حديد تسليح - ${STRUCTURAL_KIND_LABELS[el.kind] || el.kind} (${el.name})`,
        unit: "طن",
        price: pricing.steelTonPrice,
        netQty: res.steelTon,
        wastePct: pricing.steelWastePct,
        finalQty: round2(res.steelTon * (1 + pricing.steelWastePct / 100)),
        total: round2(res.steelTon * (1 + pricing.steelWastePct / 100) * pricing.steelTonPrice),
        spaceName: "أعمال إنشائية",
      });
    }
    if (res.formworkArea > 0) {
      lines.push({
        id: `${el.id}-form`,
        code: "STR-FORM",
        desc: `قالب خشبي (طوبار) - ${STRUCTURAL_KIND_LABELS[el.kind] || el.kind} (${el.name})`,
        unit: "م²",
        price: pricing.formworkPrice,
        netQty: res.formworkArea,
        wastePct: 0,
        finalQty: res.formworkArea,
        total: round2(res.formworkArea * pricing.formworkPrice),
        spaceName: "أعمال إنشائية",
      });
    }
    if (res.blindingVol > 0) {
      lines.push({
        id: `${el.id}-blind`,
        code: "STR-BLIND",
        desc: `بيتون نظافة - ${STRUCTURAL_KIND_LABELS[el.kind] || el.kind} (${el.name})`,
        unit: "م³",
        price: pricing.blindingPrice,
        netQty: res.blindingVol,
        wastePct: pricing.concreteWastePct,
        finalQty: round2(res.blindingVol * (1 + pricing.concreteWastePct / 100)),
        total: round2(res.blindingVol * (1 + pricing.concreteWastePct / 100) * pricing.blindingPrice),
        spaceName: "أعمال إنشائية",
      });
    }
    if (res.excavationVol > 0) {
      lines.push({
        id: `${el.id}-exc`,
        code: "EW-EXC-F",
        desc: `حفر قواعد - ${STRUCTURAL_KIND_LABELS[el.kind] || el.kind} (${el.name})`,
        unit: "م³",
        price: pricing.excavationPrice,
        netQty: res.excavationVol,
        wastePct: 0, // الهدر والانتفاش غير مطبق هنا بشكل افتراضي
        finalQty: res.excavationVol,
        total: round2(res.excavationVol * pricing.excavationPrice),
        spaceName: "أعمال ترابية",
      });
    }
  }

  for (const ew of panel.earthworks || []) {
    const res = calcEarthworkRow(ew);
    const isExcavation = ew.kind === "excavation";
    const qty = isExcavation ? res.bankVol : res.swollenVol;
    const finalQty = isExcavation 
      ? round2(res.bankVol * (1 + numExpr(ew.swellPct) / 100))
      : round2(res.swollenVol * (1 + numExpr(ew.compactionPct) / 100));
      
    lines.push({
      id: `${ew.id}-ew`,
      code: isExcavation ? "EW-EXC" : (ew.kind === "backfill" ? "EW-FILL" : "EW-BERM"),
      desc: `${isExcavation ? "حفر عام" : (ew.kind === "backfill" ? "ردم" : "ساتر ترابي")} (${ew.name})`,
      unit: "م³",
      price: isExcavation ? pricing.excavationPrice : pricing.backfillPrice,
      netQty: qty,
      wastePct: isExcavation ? numExpr(ew.swellPct) : numExpr(ew.compactionPct),
      finalQty,
      total: round2(finalQty * (isExcavation ? pricing.excavationPrice : pricing.backfillPrice)),
      spaceName: "أعمال ترابية",
    });
  }

  // تجميع الأسطر للحصول على الإجمالي الكلي للكتلة
  const aggregateMap = new Map<string, ReportLine>();
  for (const line of lines) {
    const key = `${line.code}|${line.unit}`;
    if (aggregateMap.has(key)) {
      const ex = aggregateMap.get(key)!;
      ex.netQty = round2(ex.netQty + line.netQty);
      ex.finalQty = round2(ex.finalQty + line.finalQty);
      ex.total = round2(ex.total + line.total);
    } else {
      aggregateMap.set(key, { ...line });
    }
  }

  const aggregate = Array.from(aggregateMap.values());
  const detailTotal = round2(aggregate.reduce((sum, line) => sum + line.total, 0));

  return {
    id: "block-" + Date.now(),
    name: panel.blockName.trim() || "كتلة بدون اسم",
    timestamp: Date.now(),
    panelState: clonePanel(panel),
    lines,
    aggregate,
    detailTotal,
  };
}

export function buildProjectSummary(blocks: BlockRecord[]) {
  const itemsMap = new Map<string, any>();
  let blocksTotal = 0;
  
  const blockSummaries = blocks.map((block) => {
    blocksTotal += block.detailTotal;
    
    block.aggregate.forEach((line: ReportLine) => {
      const key = `${line.code}|${line.unit}`;
      if (itemsMap.has(key)) {
        const existing = itemsMap.get(key);
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
    });
    
    return { name: block.name, total: round2(block.detailTotal) };
  });
  
  return {
    items: Array.from(itemsMap.values()).sort((a, b) => b.total - a.total),
    itemsTotal: round2(blocksTotal),
    blocksTotal: round2(blocksTotal),
    blocks: blockSummaries,
  };
}
