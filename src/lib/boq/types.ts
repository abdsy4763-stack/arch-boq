export type FinishKind =
  | "floor"
  | "wall"
  | "ceiling"
  | "door"
  | "window"
  | "sill"
  | "tyrolean"
  | "plaster"
  | "insulation"
  | "facade"
  | "extra";

export type QuantityFormula =
  | "floorArea"
  | "wallArea"
  | "ceilingArea"
  | "blockArea"
  | "facadeArea"
  | "doorArea"
  | "windowArea"
  | "sillLength"
  | "doorWidthTotal"
  | "direct";

export type FormulaScope = "arch" | "structural";

export type FormulaDefinition = {
  id: string;
  name: string;
  expression: string;
  scope?: FormulaScope;
  unit?: string;
  description?: string;
};

export type FinishDefinition = {
  id: string;
  label: string;
  baseKind: FinishKind;
  formulaId: string;
  /** اختياري: حصر البنود بقسم محدد من الكتالوج أو عرض كل الكتالوج */
  categoryFilter?: string;
  archived?: boolean;
};

export type SpaceTemplate = { id: string; name: string; data: Partial<Omit<SpaceRow, "id">> };

export type CatalogItem = {
  code: string;
  desc: string;
  unit: string;
  price: number;
  category: string;
  kind: string;
  allowedKinds?: FinishKind[];
  formula?: string;
};

export type ShapeMode = "rect" | "composite" | "direct";
export type ShapePart = { id: string; name: string; length: string; width: string; sign: "add" | "sub" };
export type Island = { id: string; name: string; length: string; width: string; deductCeiling: boolean };

export type SpaceRow = {
  id: string;
  name: string;
  fn: string;
  length: string;
  width: string;
  height: string;
  shapeMode?: ShapeMode;
  parts?: ShapePart[];
  perimeterExpr?: string;
  directArea?: string;
  islands?: Island[];
  doorCount: string;
  doorH: string;
  doorW: string;
  winCount: string;
  winH: string;
  winW: string;
  doorGroups?: OpeningGroup[];
  windowGroups?: OpeningGroup[];
  floor: string;
  wall: string;
  ceiling: string;
  door: string;
  window: string;
  sill: string;
  tyrolean: string;
  plaster: string;
  customFinishes?: Record<string, string>;
};

export type OpeningGroup = {
  id: string;
  name: string;
  count: string;
  height: string;
  width: string;
};

export type ExtraLine = {
  id: string;
  item: string;
  qty: string;
};

export type StructuralElementKind =
  | "footing"
  | "raft"
  | "neck"
  | "column"
  | "beam"
  | "slab"
  | "wall";

export type RebarBarGroup = {
  id: string;
  label: string;
  diameter: string;
  barsCount: string;
  barLength: string;
};

export type StructuralRow = {
  id: string;
  kind: StructuralElementKind;
  name: string;
  count: string;
  length: string;
  width: string;
  height: string;
  includeFormwork: boolean;
  includeBlinding?: boolean;
  blindingThickness?: string;
  blindingProjection?: string;
  includeExcavation?: boolean;
  excavationDepth?: string;
  rebarMode: "ratio" | "bars";
  steelRatio: string;
  bars?: RebarBarGroup[];
  /** معادلة مخصصة اختيارية لحجم البيتون أو مساحة القالب الخشبي لهذا العنصر */
  customConcreteExpr?: string;
  customFormworkExpr?: string;
};

export type EarthworkKind = "excavation" | "backfill" | "berm";

export type EarthworkRow = {
  id: string;
  kind: EarthworkKind;
  name: string;
  count: string;
  length: string;
  topWidth: string;
  height: string;
  slopeDeg: string;
  swellPct: string;
  compactionPct: string;
};

export type StructuralPricing = {
  rcConcretePrice: number;
  blindingPrice: number;
  formworkPrice: number;
  steelTonPrice: number;
  excavationPrice: number;
  backfillPrice: number;
  concreteWastePct: number;
  steelWastePct: number;
  cementGradeKg: number;
};

export type PanelState = {
  blockName: string;
  length: string;
  width: string;
  height: string;
  insulation: string;
  facade: string;
  spaces: SpaceRow[];
  extras: ExtraLine[];
  structuralElements?: StructuralRow[];
  earthworks?: EarthworkRow[];
  structuralPricing?: StructuralPricing;
};

export type ReportLine = {
  code: string;
  spaceName: string;
  spaceType: string;
  desc: string;
  unit: string;
  finalQty: number;
  price: number;
  total: number;
  baseQty: number;
  wastePct: number;
  wasteQty: number;
  missing: boolean;
};

export type BlockRecord = {
  id: string;
  name: string;
  createdAt: string;
  snapshot: PanelState;
  lines: ReportLine[];
  aggregate: ReportLine[];
  detailTotal: number;
  aggTotal: number;
};

export type ReportSettings = { companyName: string; projectName: string; signatureLabel: string };

export type ItemPatch = {
  unit?: string;
  price?: number;
  category?: string;
  allowedKinds?: FinishKind[];
  formula?: string;
};

export type TabId = "panel" | "structural" | "reports" | "project" | "database" | "waste";