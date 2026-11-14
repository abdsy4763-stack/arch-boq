import assert from "node:assert/strict";
import { test } from "node:test";
import { baseQuantity, buildBlockReport, emptySpace, emptyPanel, kpis, numExpr, spaceGeometry, spaceIssue } from "./engine.ts";

const open = { doorCount: 2, doorH: 2.1, doorW: 0.9, doorArea: 2 * 2.1 * 0.9, doorWidthTotal: 1.8, winCount: 1, winH: 1.2, winW: 1, winArea: 1.2 };
// الصيغ القديمة حرفياً (قبل التعديل)
function oldQty(kind: string, L: number, W: number, H: number): number {
  switch (kind) {
    case "floor": case "ceiling": case "insulation": return L * W;
    case "wall": case "plaster": return Math.max(0, 2 * (L + W) * H - (open.doorArea + open.winArea));
    case "facade": return 2 * (L + W) * H;
    case "sill": return Math.max(0, 2 * (L + W) - open.doorWidthTotal);
    case "tyrolean": return open.doorWidthTotal;
    case "door": return open.doorArea;
    case "window": return open.winArea;
  }
  return 0;
}

test("المستطيل: النتائج مطابقة تماماً للصيغ القديمة (بدون geo وبـ geo)", () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) {
    const L = Math.round(rnd() * 1500) / 100, W = Math.round(rnd() * 1200) / 100, H = Math.round(200 + rnd() * 150) / 100;
    const sp = { ...emptySpace("x"), length: String(L), width: String(W), height: String(H) };
    const geo = spaceGeometry(sp);
    for (const k of ["floor", "ceiling", "insulation", "wall", "plaster", "facade", "sill", "tyrolean", "door", "window"] as const) {
      const expected = oldQty(k, L, W, H);
      assert.equal(baseQuantity(k, L, W, H, open, false), expected, k + " بدون geo");
      assert.equal(baseQuantity(k, L, W, H, open, false, undefined, [], geo), expected, k + " مع geo");
    }
    for (const f of ["floorArea", "wallArea", "ceilingArea", "blockArea", "facadeArea", "sillLength"] as const) {
      const map: Record<string, string> = { floorArea: "floor", wallArea: "wall", ceilingArea: "ceiling", blockArea: "floor", facadeArea: "facade", sillLength: "sill" };
      assert.equal(baseQuantity("extra", L, W, H, open, false, f, [], geo), oldQty(map[f], L, W, H), f);
    }
  }
});

test("معادلة حرة قديمة تعطي نفس النتيجة للمستطيل", () => {
  const defs = [{ id: "f1", name: "x", expression: "floorArea+perimeter*height-wallArea+ceilingArea" }];
  const sp = { ...emptySpace("x"), length: "4", width: "3.5", height: "3" };
  const geo = spaceGeometry(sp);
  const v = baseQuantity("extra", 4, 3.5, 3, open, false, "f1", defs, geo);
  const a = 14, p = 15, wall = p * 3 - (open.doorArea + open.winArea);
  assert.ok(Math.abs(v - (a + p * 3 - wall + a)) < 1e-9);
});

test("numExpr", () => {
  assert.equal(numExpr("3.33"), 3.33); assert.equal(numExpr("3,33"), 3.33);
  assert.ok(Math.abs(numExpr("3.33+5.04+3.33+5.04") - 16.74) < 1e-9);
  assert.ok(Math.abs(numExpr("333/100") - 3.33) < 1e-12);
  assert.equal(numExpr("(2+3)*2"), 10); assert.equal(numExpr("٣٫٥"), 3.5);
  assert.equal(numExpr("abc"), 0); assert.equal(numExpr("alert(1)"), 0); assert.equal(numExpr(""), 0); assert.equal(numExpr("3..3"), 0);
});

test("مركّب: L بجمع جزأين وطرح جزء", () => {
  const L = { ...emptySpace("l"), name: "L", height: "3", shapeMode: "composite" as const, perimeterExpr: "6+5+2+3+4+2",
    parts: [{ id: "a", name: "", length: "6", width: "2", sign: "add" as const }, { id: "b", name: "", length: "4", width: "3", sign: "add" as const }] };
  assert.equal(spaceGeometry(L).area, 24);
  const sub = { ...L, parts: [{ id: "a", name: "", length: "6", width: "5", sign: "add" as const }, { id: "b", name: "", length: "2", width: "3", sign: "sub" as const }] };
  assert.equal(spaceGeometry(sub).area, 24);
  assert.equal(spaceGeometry(sub).perimeter, 22);
  assert.equal(spaceIssue(L), null);
  assert.ok(spaceIssue({ ...L, perimeterExpr: "" }));
  assert.ok(spaceIssue({ ...L, parts: [] }));
});

test("كتلة داخلية: خصم الأرضية والسقف وإضافة المحيط", () => {
  // ممر 3.33 × 5.04 فيه كتلة خلاءات 2.0 × 3.2 (مثال)
  const sp = { ...emptySpace("c"), name: "00-03", length: "3.33", width: "5.04", height: "3.1",
    islands: [{ id: "i", name: "الخلاءات", length: "2", width: "3.2", deductCeiling: true }] };
  const g = spaceGeometry(sp);
  assert.ok(Math.abs(g.area - (3.33 * 5.04 - 6.4)) < 1e-9);
  assert.ok(Math.abs(g.ceilingArea - g.area) < 1e-12);
  assert.ok(Math.abs(g.perimeter - (2 * (3.33 + 5.04) + 2 * (2 + 3.2))) < 1e-9);
  const noCeil = { ...sp, islands: [{ ...sp.islands[0], deductCeiling: false }] };
  assert.ok(Math.abs(spaceGeometry(noCeil).ceilingArea - 3.33 * 5.04) < 1e-9);
  // جدران = المحيط الكلي × الارتفاع − الفتحات
  const wall = baseQuantity("wall", g.length, g.width, 3.1, open, false, undefined, [], g);
  assert.ok(Math.abs(wall - (g.perimeter * 3.1 - (open.doorArea + open.winArea))) < 1e-9);
  // كتلة أكبر من الفراغ لا تعطي مساحة سالبة
  const big = { ...sp, islands: [{ id: "i", name: "", length: "9", width: "9", deductCeiling: true }] };
  assert.equal(spaceGeometry(big).area, 0);
  assert.ok(spaceIssue({ ...big, name: "x" }));
});

test("مباشر", () => {
  const d = { ...emptySpace("d"), height: "3", shapeMode: "direct" as const, directArea: "12.5", perimeterExpr: "14" };
  assert.deepEqual([spaceGeometry(d).area, spaceGeometry(d).perimeter], [12.5, 14]);
  assert.equal(spaceIssue(d), null);
  assert.ok(spaceIssue({ ...d, directArea: "" }));
});

test("التقرير الكامل والمؤشرات: مستطيل + مركّب + كتلة داخلية", () => {
  const items = [
    { code: "F1", desc: "أرضية بلاط", unit: "م2", price: 10, category: "c", kind: "", formula: "floorArea" },
    { code: "W1", desc: "دهان جدران", unit: "م2", price: 2, category: "c", kind: "", formula: "wallArea" },
    { code: "C1", desc: "سقف", unit: "م2", price: 3, category: "c", kind: "", formula: "ceilingArea" },
  ];
  const rect = { ...emptySpace("r"), name: "غرفة", fn: "نوم", length: "4", width: "3", height: "3", floor: "F1", wall: "W1", ceiling: "C1" };
  const comp = { ...emptySpace("k"), name: "ممر", fn: "ممر", height: "3", floor: "F1", wall: "W1", ceiling: "C1", shapeMode: "composite" as const, perimeterExpr: "2*(5+4)",
    parts: [{ id: "a", name: "", length: "5", width: "4", sign: "add" as const }],
    islands: [{ id: "i", name: "خلاءات", length: "2", width: "1", deductCeiling: true }] };
  const panel = { ...emptyPanel(), blockName: "B", spaces: [rect, comp] };
  const r = buildBlockReport(panel, items, () => 0);
  const get = (space: string, code: string) => r.lines.find((l) => l.spaceName === space && l.code === code)!.baseQty;
  assert.equal(get("غرفة", "F1"), 12); assert.equal(get("غرفة", "W1"), 42); assert.equal(get("غرفة", "C1"), 12);
  assert.equal(get("ممر", "F1"), 18); assert.equal(get("ممر", "C1"), 18); assert.equal(get("ممر", "W1"), (18 + 6) * 3);
  const k = kpis(panel.spaces);
  assert.equal(k.floor, 30); assert.equal(k.alerts, 0);
});
