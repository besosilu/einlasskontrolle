import { NavLink, Outlet } from 'react-router-dom';
import { Waves } from 'lucide-react';
import { Header } from './Header';
import { useNavItems } from './Sidebar';
import { ToastContainer } from '@/components/ui/Toast';

// Modernes Layout: Navigation als Pillen in der Kopfzeile statt Seitenleiste. Der freie Platz gehört
// den Inhalten (Listen und Tabellen auf einem 13"-Laptop), die Seiten selbst bleiben unverändert.
export function ModernShell() {
  const navItems = useNavItems();

  const brandAndNav = (
    <div className="flex min-w-0 items-center gap-5">
      <div className="flex flex-shrink-0 items-center gap-2">
        <span className="m-brand-mark flex h-8 w-8 items-center justify-center rounded-xl">
          <Waves className="h-4 w-4" />
        </span>
        <span className="hidden text-sm font-bold tracking-tight text-slate-800 xl:block">Einlass</span>
      </div>

      <nav className="m-nav flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Hauptnavigation">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className="m-nav-link">
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <Header leading={brandAndNav} />
      <main className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <Outlet />
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
