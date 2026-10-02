import { useState } from 'react';
import { Trash2, CreditCard, GraduationCap, FlaskConical, MessageSquare } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { entriesApi } from '@/api/entries';
import { membersApi } from '@/api/members';
import { EntryMethodBadge } from './EntryMethodBadge';
import { NotesDialog } from './NotesDialog';
import { formatTime } from '@/utils/dateUtils';
import { showToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import type { Entry } from '@/types';

interface EntryCardProps {
  entry: Entry;
}

export function EntryCard({ entry }: EntryCardProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const queryClient = useQueryClient();
  const entryDateStr = entry.entryDate.slice(0, 10);

  const deleteMutation = useMutation({
    mutationFn: () => entriesApi.delete(entry.id),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['entries', entryDateStr] });
      queryClient.invalidateQueries({ queryKey: ['today-count'] });
      showToast('info', 'Eintrag wurde entfernt.');
    },
    onError: () => showToast('error', 'Fehler beim Löschen.'),
  });

  const flagMutation = useMutation({
    mutationFn: (data: { needsNewCard?: boolean; isTrainer?: boolean; isTrial?: boolean; trialRegistrationDate?: string | null }) =>
      membersApi.updateFlags(entry.member.id, data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['entries', entryDateStr] });
    },
    onError: () => showToast('error', 'Fehler beim Speichern.'),
  });

  const { needsNewCard, isTrainer, isTrial } = entry.member;
  const hasNotes = !!entry.notes;

  return (
    <>
      <div className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
        needsNewCard ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-white hover:border-slate-200',
      )}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-medium text-slate-800 truncate">
              {entry.member.lastName}, {entry.member.firstName}
            </p>
            {isTrainer && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700">
                <GraduationCap className="h-3 w-3" />ÜL
              </span>
            )}
            {isTrial && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-100 px-1.5 py-0.5 text-xs font-medium text-teal-700">
                <FlaskConical className="h-3 w-3" />Schnupper
              </span>
            )}
            {needsNewCard && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                <CreditCard className="h-3 w-3" />Neuer Ausweis
              </span>
            )}
          </div>
          {entry.member.memberNumber && (
            <p className="text-xs text-slate-400">#{entry.member.memberNumber}</p>
          )}
          {entry.notes && (
            <p className="mt-1 text-xs text-slate-500 italic">
              <MessageSquare className="inline h-3 w-3 mr-0.5 text-slate-400" />
              {entry.notes}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <EntryMethodBadge method={entry.method} />
          <span className="text-sm text-slate-500 tabular-nums ml-1">{formatTime(entry.entryTime)}</span>

          <button
            onClick={() => flagMutation.mutate({ needsNewCard: !needsNewCard })}
            disabled={flagMutation.isPending}
            title={needsNewCard ? 'Ausweis-Kennzeichen entfernen' : 'Neuer Ausweis notwendig'}
            className={cn('rounded p-1 transition-colors', needsNewCard ? 'text-amber-500 hover:bg-amber-100' : 'text-slate-300 hover:bg-amber-50 hover:text-amber-400')}
          >
            <CreditCard className="h-4 w-4" />
          </button>

          <button
            onClick={() => flagMutation.mutate({ isTrainer: !isTrainer })}
            disabled={flagMutation.isPending}
            title={isTrainer ? 'Übungsleiter-Status entfernen' : 'Als Übungsleiter markieren'}
            className={cn('rounded p-1 transition-colors', isTrainer ? 'text-violet-500 hover:bg-violet-100' : 'text-slate-300 hover:bg-violet-50 hover:text-violet-400')}
          >
            <GraduationCap className="h-4 w-4" />
          </button>

          <button
            onClick={() => flagMutation.mutate({ isTrial: !isTrial })}
            disabled={flagMutation.isPending}
            title={isTrial ? 'Schnupper-Training-Status entfernen' : 'Als Schnupper-Training markieren'}
            className={cn('rounded p-1 transition-colors', isTrial ? 'text-teal-500 hover:bg-teal-100' : 'text-slate-300 hover:bg-teal-50 hover:text-teal-400')}
          >
            <FlaskConical className="h-4 w-4" />
          </button>

          <button
            onClick={() => setNotesOpen(true)}
            title={hasNotes ? 'Notiz bearbeiten' : 'Notiz hinzufügen'}
            className={cn('rounded p-1 transition-colors', hasNotes ? 'text-blue-500 hover:bg-blue-100' : 'text-slate-300 hover:bg-blue-50 hover:text-blue-400')}
          >
            <MessageSquare className="h-4 w-4" />
          </button>

          <button
            onClick={() => { if (confirm('Eintrag wirklich löschen?')) deleteMutation.mutate(); }}
            className="ml-1 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-400 transition-colors"
            title="Eintrag löschen"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <NotesDialog
        entryId={entry.id}
        entryDateStr={entryDateStr}
        memberName={`${entry.member.firstName} ${entry.member.lastName}`}
        currentNotes={entry.notes}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
      />
    </>
  );
}
