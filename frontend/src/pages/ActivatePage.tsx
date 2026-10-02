import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Waves, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { authApi } from '@/api/auth';

export function ActivatePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Kein Aktivierungstoken gefunden.');
      return;
    }

    authApi
      .activate(token)
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setMessage(msg ?? 'Aktivierung fehlgeschlagen');
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <Waves className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Einlassüberwachung</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          {status === 'loading' && (
            <>
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto" />
              <p className="text-slate-600">Konto wird aktiviert…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
              <h2 className="text-lg font-semibold text-slate-800">Konto aktiviert</h2>
              <p className="text-sm text-slate-500">Ihr Konto wurde erfolgreich aktiviert.</p>
              <Link to="/login" className="inline-block text-sm text-blue-600 hover:underline">
                Jetzt anmelden
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-10 w-10 text-red-500 mx-auto" />
              <h2 className="text-lg font-semibold text-slate-800">Aktivierung fehlgeschlagen</h2>
              <p className="text-sm text-red-600">{message}</p>
              <Link to="/login" className="inline-block text-sm text-blue-600 hover:underline">
                Zur Anmeldung
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
