import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, ClipboardList, Lock, Unlock, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { usersApi, type UserDto, type RegistrationRequestDto } from '@/api/users';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';

type Tab = 'users' | 'registrations';

export function UsersPage() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Benutzerverwaltung</h1>

      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={<Users className="h-4 w-4" />}>
          Benutzer
        </TabButton>
        <TabButton
          active={tab === 'registrations'}
          onClick={() => setTab('registrations')}
          icon={<ClipboardList className="h-4 w-4" />}
        >
          Registrierungsanfragen
        </TabButton>
      </div>

      {tab === 'users' ? <UsersList /> : <RegistrationsList />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function UsersList() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: usersApi.listUsers,
  });

  const toggleLock = useMutation({
    mutationFn: ({ id, lock }: { id: number; lock: boolean }) => usersApi.toggleLock(id, lock),
    onSuccess: (_, { lock }) => {
      showToast('success', lock ? 'Benutzer gesperrt' : 'Benutzer entsperrt');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast('error', msg ?? 'Fehler');
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => usersApi.deleteUser(id),
    onSuccess: () => {
      showToast('success', 'Benutzer gelöscht');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast('error', msg ?? 'Fehler');
    },
  });

  if (isLoading) return <div className="text-slate-500 text-sm">Laden…</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">E-Mail</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Rolle</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u: UserDto) => (
            <UserRow
              key={u.id}
              user={u}
              onToggleLock={(lock) => toggleLock.mutate({ id: u.id, lock })}
              onDelete={() => {
                if (confirm(`Benutzer ${u.email} wirklich löschen?`)) {
                  deleteUser.mutate(u.id);
                }
              }}
            />
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                Keine Benutzer gefunden
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({
  user,
  onToggleLock,
  onDelete,
}: {
  user: UserDto;
  onToggleLock: (lock: boolean) => void;
  onDelete: () => void;
}) {
  const isLocked = user.locked_until ? new Date() < new Date(user.locked_until) : false;

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 font-medium text-slate-800">
        {user.first_name} {user.last_name}
        {user.must_change_password && (
          <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
            Pw. ändern
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-slate-600">{user.email}</td>
      <td className="px-4 py-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            user.role === 'admin'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {user.role === 'admin' ? 'Admin' : 'Benutzer'}
        </span>
      </td>
      <td className="px-4 py-3">
        {isLocked ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Gesperrt</span>
        ) : user.is_active ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Aktiv</span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Inaktiv</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {user.role !== 'admin' && (
            <>
              <button
                onClick={() => onToggleLock(!isLocked)}
                title={isLocked ? 'Entsperren' : 'Sperren'}
                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </button>
              <button
                onClick={onDelete}
                title="Löschen"
                className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function RegistrationsList() {
  const qc = useQueryClient();
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-registrations'],
    queryFn: usersApi.listRegistrations,
  });

  const approve = useMutation({
    mutationFn: (id: number) => usersApi.approveRegistration(id),
    onSuccess: () => {
      showToast('success', 'Genehmigt – Aktivierungslink gesendet');
      qc.invalidateQueries({ queryKey: ['admin-registrations'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast('error', msg ?? 'Fehler');
    },
  });

  const reject = useMutation({
    mutationFn: (id: number) => usersApi.rejectRegistration(id),
    onSuccess: () => {
      showToast('success', 'Anfrage abgelehnt');
      qc.invalidateQueries({ queryKey: ['admin-registrations'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast('error', msg ?? 'Fehler');
    },
  });

  if (isLoading) return <div className="text-slate-500 text-sm">Laden…</div>;

  const pending = requests.filter((r: RegistrationRequestDto) => r.status === 'pending');
  const others = requests.filter((r: RegistrationRequestDto) => r.status !== 'pending');

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Ausstehend ({pending.length})</h3>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">E-Mail</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Datum</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((r: RegistrationRequestDto) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.email}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(r.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => approve.mutate(r.id)}
                          loading={approve.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Genehmigen
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => reject.mutate(r.id)}
                          loading={reject.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Ablehnen
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Bearbeitet</h3>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">E-Mail</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Bearbeitet am</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {others.map((r: RegistrationRequestDto) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {r.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.reviewed_at
                        ? new Date(r.reviewed_at).toLocaleDateString('de-DE')
                        : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="text-center text-slate-400 py-12">Keine Registrierungsanfragen</div>
      )}
    </div>
  );
}
