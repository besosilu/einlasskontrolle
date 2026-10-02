import { useState } from 'react';
import { Users, LogOut, KeyRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { entriesApi } from '@/api/entries';
import { authApi } from '@/api/auth';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/utils/dateUtils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { showToast } from '@/components/ui/Toast';

export function Header() {
  const { data } = useQuery({
    queryKey: ['today-count'],
    queryFn: entriesApi.getTodayCount,
    refetchInterval: 10_000,
  });

  const { logout, firstName, lastName, email } = useAuth();
  const navigate = useNavigate();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const displayName = firstName && lastName ? `${firstName} ${lastName}` : (email ?? '');

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      showToast('success', 'Passwort erfolgreich geändert');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      showToast('error', 'Aktuelles Passwort falsch');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
        <p className="text-sm text-slate-500">{formatDate(new Date())}</p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">
              {data?.count ?? 0} heute eingelassen
            </span>
          </div>

          <span className="text-sm text-slate-500 hidden sm:block">{displayName}</span>

          <button
            onClick={() => setShowPasswordForm(true)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Passwort ändern"
          >
            <KeyRound className="h-4 w-4" />
          </button>

          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Abmelden"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {showPasswordForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800 mb-5">Passwort ändern</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Aktuelles Passwort</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Neues Passwort</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">Speichern</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); }}
                  className="flex-1"
                >
                  Abbrechen
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
