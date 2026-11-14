import { useEffect, useMemo, useState } from "react";
import {
  Database,
  Download,
  HardHat,
  LayoutDashboard,
  Percent,
  RotateCcw,
  Share2,
  Sigma,
  Table2,
  Upload,
} from "lucide-react";
import { effectiveItems } from "@/lib/boq/catalog";
import { COPYRIGHT_TEXT, CREATOR_SIGNATURE } from "@/lib/boq/branding";
import { downloadText } from "@/lib/boq/engine";
import { useBoq } from "@/lib/boq/store";
import type { TabId } from "@/lib/boq/types";
import { DatabaseView, ProjectView, WasteView } from "./lists";
import { PanelView } from "./panel";
import { ReportsView } from "./reports";
import { StructuralView } from "./structural";
import { WelcomeOverlay } from "./welcome";

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "panel", label: "المعماري", icon: LayoutDashboard },
  { id: "structural", label: "الإنشائي", icon: HardHat },
  { id: "reports", label: "التقارير", icon: Table2 },
  { id: "project", label: "الإجمالي", icon: Sigma },
  { id: "database", label: "البنود", icon: Database },
  { id: "waste", label: "الهدر", icon: Percent },
];

export function BoqApp() {
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const tab = useBoq((s) => s.tab);
  const setTab = useBoq((s) => s.setTab);
  const notice = useBoq((s) => s.notice);
  const setNotice = useBoq((s) => s.setNotice);
  const undoLast = useBoq((s) => s.undoLast);
  const undoSnapshot = useBoq((s) => s.undoSnapshot);
  const patches = useBoq((s) => s.patches);
  const generate = useBoq((s) => s.generate);
  const customItems = useBoq((s) => s.customItems);
  const hiddenCodes = useBoq((s) => s.hiddenCodes);
  const loadDemoProject = useBoq((s) => s.loadDemoProject);
  const catalog = useMemo(
    () => effectiveItems(patches, customItems, hiddenCodes),
    [patches, customItems, hiddenCodes],
  );

  useEffect(() => {
    void useBoq.persist.rehydrate();
    if (!localStorage.getItem("boq-welcome-seen")) setWelcomeOpen(true);
    const reminderKey = "boq-last-backup-reminder";
    const remind = () => {
      const last = Number(localStorage.getItem(reminderKey) ?? 0);
      if (!last || Date.now() - last > 7 * 24 * 60 * 60 * 1000)
        setNotice("يتم حفظ المسودة تلقائياً على هذا الجهاز. يُنصح بتصدير نسخة احتياطية.");
    };
    remind();
    const timer = window.setInterval(remind, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const backup = () => {
    const state = useBoq.getState();
    void downloadText(
      "نسخة-احتياطية-حصر-الكميات.json",
      JSON.stringify(
        {
          version: 4,
          panel: state.panel,
          blocks: state.blocks,
          patches: state.patches,
          customItems: state.customItems,
          hiddenCodes: state.hiddenCodes,
          wasteOverrides: state.wasteOverrides,
          formulaDefinitions: state.formulaDefinitions,
          finishDefinitions: state.finishDefinitions,
          templates: state.templates,
          reportSettings: state.reportSettings,
        },
        null,
        2,
      ),
      "application/json",
    );
    localStorage.setItem("boq-last-backup-reminder", String(Date.now()));
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-navy bg-navy text-on-navy">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs text-on-navy/80">منظومة حصر الكميات الهندسية (المعماري والإنشائي)</p>
            <h1 className="text-base font-bold leading-tight md:text-lg">
              لوحة الكتل والإنشائي والتقارير والهدر
            </h1>
          </div>
          <div className="no-print flex gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-teal px-3 text-xs font-semibold text-on-teal"
              onClick={() => {
                const state = useBoq.getState();
                downloadText(
                  "مشروع-حصر-الكميات.json",
                  JSON.stringify(
                    {
                      version: 1,
                      panel: state.panel,
                      blocks: state.blocks,
                      patches: state.patches,
                      customItems: state.customItems,
                      hiddenCodes: state.hiddenCodes,
                      wasteOverrides: state.wasteOverrides,
                      formulaDefinitions: state.formulaDefinitions,
                      finishDefinitions: state.finishDefinitions,
                      templates: state.templates,
                      reportSettings: state.reportSettings,
                    },
                    null,
                    2,
                  ),
                  "application/json",
                );
              }}
            >
              <Download className="size-4" />
              حفظ
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1 rounded-lg border border-on-navy/30 px-3 text-xs font-semibold"
              onClick={backup}
            >
              <Share2 className="size-4" />
              مشاركة النسخة
            </button>
            <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-on-navy/30 px-3 text-xs font-semibold">
              <Upload className="size-4" />
              استيراد
              <input
                type="file"
                accept="application/json"
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    const data = JSON.parse(await file.text());
                    if (!data || typeof data !== "object") throw new Error("bad");
                    useBoq.getState().replaceAll(data);
                  } catch {
                    setNotice("تعذر قراءة ملف المشروع.");
                  }
                }}
              />
            </label>
          </div>
        </div>
        <nav className="no-print mx-auto hidden max-w-6xl gap-1 px-4 pb-3 md:flex">
          {TABS.map((item) => (
            <TabButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />
          ))}
        </nav>
      </header>

      {notice ? (
        <div className="no-print mx-auto flex max-w-6xl items-start justify-between gap-3 px-4 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="rounded-lg border border-line bg-amber-bg px-3 py-2 text-sm text-ink">{notice}</p>
            {undoSnapshot ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-teal bg-card px-3 py-2 text-sm font-semibold text-teal"
                onClick={undoLast}
              >
                <RotateCcw className="size-4" />
                تراجع
              </button>
            ) : null}
          </div>
          <button type="button" className="text-sm text-muted" onClick={() => setNotice(null)}>
            إغلاق
          </button>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-4 pb-24 md:pb-10">
        {tab === "panel" ? <PanelView catalog={catalog} /> : null}
        {tab === "structural" ? <StructuralView /> : null}
        {tab === "reports" ? <ReportsView /> : null}
        {tab === "project" ? <ProjectView /> : null}
        {tab === "database" ? <DatabaseView /> : null}
        {tab === "waste" ? <WasteView /> : null}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-24 text-center text-xs text-muted md:pb-6">
        <div className="mx-auto inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-line bg-card/80 px-4 py-2 shadow-sm">
          <span>{CREATOR_SIGNATURE}</span>
          <span aria-hidden="true">•</span>
          <span>{COPYRIGHT_TEXT}</span>
        </div>
      </footer>

      {tab === "panel" || tab === "structural" ? (
        <button
          type="button"
          onClick={generate}
          className="no-print fixed bottom-20 right-4 z-[60] inline-flex h-12 items-center gap-2 rounded-full bg-teal px-5 text-sm font-bold text-on-teal shadow-lg shadow-navy/20 ring-2 ring-white/70 transition hover:bg-teal-deep md:bottom-20 md:right-6"
          aria-label="توليد تقرير الكتلة"
        >
          <Sigma className="size-5" />
          توليد التقرير
        </button>
      ) : null}

      {welcomeOpen ? (
        <WelcomeOverlay
          onClose={() => {
            localStorage.setItem("boq-welcome-seen", "1");
            setWelcomeOpen(false);
          }}
          onDemo={() => {
            loadDemoProject();
            localStorage.setItem("boq-welcome-seen", "1");
            setWelcomeOpen(false);
          }}
        />
      ) : null}

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-card md:hidden">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={
              "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold " +
              (tab === item.id ? "text-teal" : "text-muted")
            }
          >
            <item.icon className="size-5" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function TabButton({
  item,
  active,
  onClick,
}: {
  item: (typeof TABS)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold " +
        (active ? "bg-teal text-on-teal" : "text-on-navy")
      }
    >
      <Icon className="size-4" />
      {item.label}
    </button>
  );
}