import type { EarthworkRow, StructuralRow, PanelState, BlockRecord, ReportLine } from "./types";

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
// 3. الحسابات الإنشائية والترابية الدقيقة
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
  const excavationVol = row.includeExcavation ? count * (L + 2 * bp + 1) * (W + 2 * bp + 1) * exD : 0; // تم إضافة +1 كمسافة عمل (Working Space)

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
// 4. بناء ملخص المشروع (تطبيق التقريب المالي)
// ==========================================

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
        // تم تطبيق التقريب هنا لمنع تراكم أخطاء الفواصل (1.4e-14)
        existing.total = round2(existing.total + line.total); 
      } else {
        itemsMap.set(key, {
          code: line.code,
          desc: line.desc,
          unit: line.unit,
          price: line.price,
          qty: line.finalQty,
          total: round2(line.total), // تقريب دقيق للإجمالي
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
