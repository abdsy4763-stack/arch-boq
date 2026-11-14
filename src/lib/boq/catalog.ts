import catalogJson from "@/data/catalog.json";
import listsJson from "@/data/lists.json";
import wasteJson from "@/data/waste.json";
import type { CatalogItem, FinishKind, ItemPatch, QuantityFormula } from "./types";

type Seed = {
  code: string;
  desc: string;
  unit: string;
  price: number | null;
  category: string;
  kind: string;
  allowedKinds?: FinishKind[];
  formula?: QuantityFormula;
};

export const LISTS = listsJson as {
  floors: string[];
  walls: string[];
  ceilings: string[];
  doors: string[];
  windows: string[];
  insulation: string[];
  facades: string[];
  sills: string[];
  tyrolean: string[];
  plaster: string[];
};

export type ListKey = keyof typeof LISTS;

const CATEGORY_LIST: Record<string, ListKey> = {
  "أعمال الأرضيات": "floors",
  " أعمال الأرضيات": "floors",
  "أعمال الجدران": "walls",
  "أعمال أسقف": "ceilings",
  "أعمال الأبواب": "doors",
  "أعمال النوافذ": "windows",
  "أعمال العزل": "insulation",
  "أعمال الواجهات": "facades",
  نعلات: "sills",
  براطيش: "tyrolean",
  "طينة جدران": "plaster",
  "طينة أسقف": "ceilings",
  طينة: "plaster",
};

const LIST_KIND: Record<ListKey, FinishKind> = {
  floors: "floor",
  walls: "wall",
  ceilings: "ceiling",
  doors: "door",
  windows: "window",
  insulation: "insulation",
  facades: "facade",
  sills: "sill",
  tyrolean: "tyrolean",
  plaster: "plaster",
};

export function defaultKinds(category: string, kind?: string): FinishKind[] {
  if (kind && Object.values(LIST_KIND).includes(kind as FinishKind)) return [kind as FinishKind];
  const list = CATEGORY_LIST[category];
  return list ? [LIST_KIND[list]] : ["extra"];
}

export function defaultFormula(kinds: FinishKind[]): QuantityFormula {
  switch (kinds[0]) {
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

const SEED: CatalogItem[] = (catalogJson.items as Seed[]).map((item) => ({
  code: item.code,
  desc: item.desc,
  unit: item.unit,
  price: item.price ?? 0,
  category: item.category,
  kind: item.kind,
  allowedKinds: item.allowedKinds ?? defaultKinds(item.category, item.kind),
  formula: item.formula ?? defaultFormula(item.allowedKinds ?? defaultKinds(item.category, item.kind)),
}));

const WASTE_SEED: Record<string, number> = {};
for (const row of wasteJson.rates) {
  WASTE_SEED[row.code] = row.waste ?? 0;
}

export const CATEGORIES = Array.from(
  new Set(SEED.map((item) => item.category).filter(Boolean)),
).sort((a, b) => a.localeCompare(b, "ar"));

export function seedWaste(code: string): number {
  return WASTE_SEED[code] ?? 0;
}

export function effectiveItems(
  patches: Record<string, ItemPatch>,
  customItems: CatalogItem[],
  hiddenCodes: string[],
): CatalogItem[] {
  const hidden = new Set(hiddenCodes);
  const seeded = SEED.filter((item) => !hidden.has(item.code)).map((item) => applyPatch(item, patches));
  const custom = customItems
    .filter((item) => !hidden.has(item.code))
    .map((item) => applyPatch({
      ...item,
      allowedKinds: item.allowedKinds?.length ? item.allowedKinds : defaultKinds(item.category, item.kind),
      formula: item.formula ?? defaultFormula(item.allowedKinds?.length ? item.allowedKinds : defaultKinds(item.category, item.kind)),
    }, patches));
  return [...seeded, ...custom];
}

function applyPatch(item: CatalogItem, patches: Record<string, ItemPatch>): CatalogItem {
  const patch = patches[item.code];
  if (!patch) return item;
  return {
    ...item,
    unit: patch.unit ?? item.unit,
    price: patch.price ?? item.price,
    category: patch.category ?? item.category,
    allowedKinds: patch.allowedKinds ?? item.allowedKinds,
    formula: patch.formula ?? item.formula,
  };
}

export function wastePercent(code: string, overrides: Record<string, number>): number {
  if (Object.prototype.hasOwnProperty.call(overrides, code)) return overrides[code] ?? 0;
  return seedWaste(code);
}

export function listOptions(key: ListKey, customItems: CatalogItem[]): string[] {
  const base = LISTS[key];
  const extra = customItems
    .filter((item) => CATEGORY_LIST[item.category] === key && item.desc.trim())
    .map((item) => item.desc.trim());
  const seen = new Set(base);
  return [...base, ...extra.filter((desc) => !seen.has(desc))];
}

export function itemsForKind(items: CatalogItem[], kind: FinishKind): string[] {
  return items.filter((item) => item.allowedKinds?.includes(kind)).map((item) => item.code);
}

export const SEED_COUNT = SEED.length;
