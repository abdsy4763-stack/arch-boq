import { useState } from "react";

export function WelcomeOverlay({ onClose, onDemo }: { onClose: () => void; onDemo: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    ["مرحباً بك في حصر الكميات", "أدخل بيانات الكتلة والفراغات، وسيحسب التطبيق الكميات والهدر تلقائياً."],
    ["سرّع الإدخال بالقوالب", "استخدم قوالب غرفة النوم والصالة والمطبخ والحمام والشرفة، أو احفظ قالباً خاصاً بك."],
    ["طبّق التشطيبات دفعة واحدة", "حدد عدة فراغات ثم اختر بند تشطيب واحداً لتطبيقه عليها بسرعة."],
  ] as const;
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-navy/70 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-card border border-line bg-card p-6 shadow-2xl"><div className="mb-4 flex gap-1">{steps.map((item, index) => <span key={item[0]} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-teal" : "bg-line"}`} />)}</div><h2 className="text-xl font-bold">{steps[step][0]}</h2><p className="mt-3 leading-relaxed text-muted">{steps[step][1]}</p>{step === 2 ? <button type="button" onClick={onDemo} className="mt-5 w-full rounded-lg bg-teal px-4 py-3 font-semibold text-on-teal">جرّب مشروعاً تجريبياً</button> : null}<div className="mt-5 flex items-center justify-between gap-2"><button type="button" className="text-sm text-muted" onClick={onClose}>تخطي</button><button type="button" className="rounded-lg bg-navy px-4 py-3 text-sm font-semibold text-on-navy" onClick={() => step < 2 ? setStep((value) => value + 1) : onClose()}>{step < 2 ? "التالي" : "ابدأ الآن"}</button></div></div></div>;
}
