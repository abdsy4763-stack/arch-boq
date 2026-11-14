// 1. التقريب المالي الدقيق (تُستخدم لمنع فوارق الفواصل العائمة مثل 0.1 + 0.2)
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// 2. تطبيع النصوص والأرقام (دعم الأرقام الهندية والفواصل العربية)
export function normalizeNumString(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "0";
  if (typeof val === "number") return val.toString();
  
  let normalized = val.trim();
  if (!normalized) return "0";

  // تحويل الأرقام الهندية إلى إنجليزية
  const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  arabicNumbers.forEach((arNum, i) => {
    normalized = normalized.replace(new RegExp(arNum, 'g'), i.toString());
  });

  // توحيد الفواصل العربية أو الإنجليزية إلى نقطة عشرية قياسية
  normalized = normalized.replace(/[٫,]/g, ".");
  
  return normalized;
}

// 3. التحويل الآمن للأرقام الفردية
export function num(value: any): number {
  const parsed = parseFloat(normalizeNumString(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

// 4. واجهة نتيجة المعادلة الجديدة
export interface FormulaResult {
  value: number;
  error: string | null;
}

// 5. التقييم الآمن للمعادلات الرياضية (لا تفشل بصمت بعد الآن)
export function evaluateFormula(expr: string, vars: Record<string, number>): FormulaResult {
  try {
    if (!expr || !expr.trim()) return { value: 0, error: null };
    
    // تطبيع المعادلة (للسماح بكتابة .5 أو ٠٫٥ بشكل طبيعي)
    const safeExpr = normalizeNumString(expr).replace(/\s+/g, "");
    
    const varNames = Object.keys(vars);
    const varValues = Object.values(vars);
    
    // بناء الدالة بأمان
    const fn = new Function(...varNames, `return ${safeExpr};`);
    const result = fn(...varValues);
    
    if (typeof result !== "number" || Number.isNaN(result) || !Number.isFinite(result)) {
      return { value: 0, error: "خطأ رياضي (تأكد من عدم القسمة على صفر)" };
    }
    
    if (result < 0) {
      return { value: 0, error: "النتيجة سالبة (تم قصها إلى الصفر)" };
    }
    
    return { value: result, error: null };
  } catch (err) {
    return { value: 0, error: "خطأ في الصياغة (تحقق من الأقواس والعمليات)" };
  }
}

// 6. تحديث دوال التنسيق لتعتمد التقريب الجديد
export function fmt(value: number): string {
  return round2(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtLoose(value: number): string {
  return round2(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}
