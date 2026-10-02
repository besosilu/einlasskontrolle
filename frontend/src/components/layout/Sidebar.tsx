import { NavLink } from 'react-router-dom';
import { ScanLine, BarChart3, Upload, Waves, Euro, Users, ScrollText } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';

const baseNavItems = [
  { to: '/', icon: ScanLine, label: 'Einlass' },
  { to: '/stats', icon: BarChart3, label: 'Statistiken' },
  { to: '/prices', icon: Euro, label: 'Preise' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/logs', icon: ScrollText, label: 'Protokoll' },
];

export function Sidebar() {
  const { isAdmin } = useAuth();

  const navItems = isAdmin
    ? [...baseNavItems, { to: '/users', icon: Users, label: 'Benutzer' }]
    : baseNavItems;

  return (
    <aside className="flex h-full w-56 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-100">
        <Waves className="h-6 w-6 text-blue-600" />
        <div>
          <p className="text-sm font-bold text-slate-800 leading-tight">Einlass</p>
          <p className="text-xs text-slate-500 leading-tight">Überwachung</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              )
            }
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
