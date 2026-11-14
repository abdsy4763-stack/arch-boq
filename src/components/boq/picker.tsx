import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { CatalogItem } from "@/lib/boq/types";

type Props = {
  label: string;
  value: string;
  options: string[];
  catalog?: CatalogItem[];
  onChange: (value: string) => void;
  compact?: boolean;
};

export function Picker({ label, value, options, catalog, onChange, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? options.filter((item) => item.toLowerCase().includes(q)) : options;
    const extra: { label: string; code: string }[] = [];
    if (q && catalog) {
      for (const item of catalog) {
        const hit =
          item.code.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q);
        if (!hit) continue;
        if (base.includes(item.desc) || extra.some((row) => row.label === item.desc)) continue;
        extra.push({ label: item.desc, code: item.code });
        if (extra.length >= 20) break;
      }
    }
    return {
      base: base.slice(0, 40).map((codeOrLabel) => {
        const found = catalog?.find((item) => item.code === codeOrLabel);
        return { label: found?.desc ?? codeOrLabel, code: found?.code ?? "" };
      }),
      extra,
    };
  }, [catalog, options, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className={
          "w-full rounded-lg border border-line bg-input text-start text-ink " +
          (compact ? "min-h-11 px-2 py-1.5 text-xs" : "min-h-11 px-3 py-2 text-sm")
        }
      >
        <span className="block text-xs font-medium text-muted">{label}</span>
        <span className={"mt-0.5 block leading-snug " + (value ? "line-clamp-2" : "text-muted")}>
          {(catalog?.find((item) => item.code === value)?.desc ?? value) || "اختر من القائمة"}
        </span>
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-3 md:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label={label}
            className="flex max-h-[calc(100dvh-1.5rem)] min-h-0 w-full max-w-xl flex-col overflow-hidden rounded-card bg-card shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-line px-3 py-3">
              <Search className="size-4 shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`بحث في ${label} أو كود البند`}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {value ? (
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-danger"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  مسح
                </button>
              ) : null}
              <button type="button" aria-label="إغلاق" className="rounded-md p-1" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {results.base.length === 0 && results.extra.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  {options.length === 0 && !query.trim()
                    ? "اكتب كود البند أو جزءاً من الوصف للبحث في القاعدة."
                    : "لا توجد نتائج."}
                </p>
              ) : null}
              {results.base.map((item) => (
                <OptionRow
                  key={item.label}
                  label={item.label}
                  code={item.code}
                  selected={item.label === value || item.code === value}
                  onPick={() => {
                    onChange(item.code || item.label);
                    setOpen(false);
                  }}
                />
              ))}
              {results.extra.length > 0 ? (
                <p className="bg-band px-3 py-1.5 text-xs font-medium text-muted">من قاعدة البيانات</p>
              ) : null}
              {results.extra.map((item) => (
                <OptionRow
                  key={item.code + item.label}
                  label={item.label}
                  code={item.code}
                  selected={item.label === value || item.code === value}
                  onPick={() => {
                    onChange(item.code || item.label);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function OptionRow({
  label,
  code,
  selected,
  onPick,
}: {
  label: string;
  code: string;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={
        "block w-full border-b border-line px-3 py-3 text-start text-sm leading-relaxed " +
        (selected ? "bg-ok-bg" : "hover:bg-band")
      }
    >
      {code ? <span className="num mb-1 block text-xs font-semibold text-teal">{code}</span> : null}
      {label}
    </button>
  );
}
