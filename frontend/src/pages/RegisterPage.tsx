import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Waves, UserPlus } from 'lucide-react';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }
    if (form.password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <Waves className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Einlassüberwachung</h1>
          <p className="text-sm text-slate-500 mt-1">Schwimmverein</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-2">
                <UserPlus className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Anfrage eingereicht</h2>
              <p className="text-sm text-slate-500">
                Ihre Registrierungsanfrage wurde eingereicht. Sie erhalten eine E-Mail, sobald Ihr Konto genehmigt wurde.
              </p>
              <Link to="/login" className="inline-block text-sm text-blue-600 hover:underline">
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-800 mb-6">Registrieren</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vorname</label>
                    <Input
                      type="text"
                      value={form.firstName}
                      onChange={set('firstName')}
                      placeholder="Max"
                      autoFocus
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nachname</label>
                    <Input
                      type="text"
                      value={form.lastName}
                      onChange={set('lastName')}
                      placeholder="Mustermann"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-Mail</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="max@beispiel.de"
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Passwort</label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={set('password')}
                    placeholder="Mindestens 8 Zeichen"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Passwort wiederholen</label>
                  <Input
                    type="password"
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    placeholder="Passwort wiederholen"
                    autoComplete="new-password"
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <Button type="submit" loading={loading} className="w-full mt-2">
                  <UserPlus className="h-4 w-4" />
                  Registrieren
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-slate-500">
                Bereits registriert?{' '}
                <Link to="/login" className="text-blue-600 hover:underline">
                  Anmelden
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
