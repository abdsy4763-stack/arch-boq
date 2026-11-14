import React from 'react';
import ReactDOM from 'react-dom/client';
import * as ShellModule from './components/boq/shell';
import './styles.css';

// التقاط المكون الرئيسي تلقائياً أياً كان اسم التصدير في shell.tsx
const AppShell =
  (ShellModule as any).ArchBoqShell ||
  (ShellModule as any).BoqShell ||
  (ShellModule as any).Shell ||
  (ShellModule as any).default ||
  Object.values(ShellModule).find((exp) => typeof exp === 'function');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {AppShell ? <AppShell /> : <div>خطأ في تحميل واجهة التطبيق</div>}
  </React.StrictMode>
);