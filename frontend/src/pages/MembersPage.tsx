import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { membersApi } from '@/api/members';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { MemberEditDialog } from '@/components/members/MemberEditDialog';
import type { Member } from '@/types';

const PAGE_SIZE = 25;

const SOURCE_LABELS: Record<string, { label: string; variant: 'info' | 'default' | 'success' }> = {
  scan: { label: 'Scan', variant: 'info' },
  manual: { label: 'Manuell', variant: 'default' },
  import: { label: 'Import', variant: 'success' },
};

export function MembersPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ['members-list', debouncedSearch, page],
    queryFn: () =>
      membersApi.list({ search: debouncedSearch, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  });

  const members = data?.members ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Mitglieder</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche nach Name oder Mitgliedsnummer..."
          className="pl-9"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Mitgliedsnummer</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Quelle</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Markierungen</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Laden…
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Keine Mitglieder gefunden
                </td>
              </tr>
            ) : (
              members.map((m) => <MemberRow key={m.id} member={m} onEdit={() => setEditingMember(m)} />)
            )}
          </tbody>
        </table>

        {total > 0 && (
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={total} pageSize={PAGE_SIZE} />
        )}
      </div>

      <MemberEditDialog member={editingMember} onClose={() => setEditingMember(null)} />
    </div>
  );
}

function MemberRow({ member, onEdit }: { member: Member; onEdit: () => void }) {
  const source = SOURCE_LABELS[member.source] ?? { label: member.source, variant: 'default' as const };

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 font-medium text-slate-800">
        {member.lastName}, {member.firstName}
      </td>
      <td className="px-4 py-3 text-slate-600">{member.memberNumber ?? '–'}</td>
      <td className="px-4 py-3">
        <Badge variant={source.variant}>{source.label}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {member.needsNewCard && <Badge variant="warning">Neue Karte</Badge>}
          {member.isTrainer && <Badge variant="info">Trainer</Badge>}
          {member.isTrial && <Badge variant="default">Schnupperer</Badge>}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end">
          <button
            onClick={onEdit}
            title="Bearbeiten"
            className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function Pagination({
  page, pageCount, onPage, total, pageSize,
}: {
  page: number; pageCount: number; onPage: (p: number) => void; total: number; pageSize: number;
}) {
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
      <p className="text-xs text-slate-400">{from}–{to} von {total}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-xs text-slate-600">
          {page + 1} / {pageCount}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount - 1}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
