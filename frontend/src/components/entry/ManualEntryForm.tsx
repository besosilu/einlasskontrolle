import { useState } from 'react';
import { format } from 'date-fns';
import { UserPlus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { entriesApi } from '@/api/entries';
import { membersApi } from '@/api/members';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MemberAutocomplete } from './MemberAutocomplete';
import { ManualWarningDialog } from './ManualWarningDialog';
import { TrialWarningDialog } from './TrialWarningDialog';
import { showToast } from '@/components/ui/Toast';
import type { Member, Warning, EntryResult } from '@/types';

interface ManualEntryFormProps {
  onEntryCreated: () => void;
  entryDate?: string;
}

export function ManualEntryForm({ onEntryCreated, entryDate }: ManualEntryFormProps) {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [pendingWarning, setPendingWarning] = useState<Warning | null>(null);
  const [pendingResult, setPendingResult] = useState<EntryResult | null>(null);

  const queryClient = useQueryClient();
  const resolvedDateStr = entryDate ?? format(new Date(), 'yyyy-MM-dd');

  function refresh() {
    queryClient.refetchQueries({ queryKey: ['entries', resolvedDateStr] });
    queryClient.invalidateQueries({ queryKey: ['today-count'] });
  }

  const mutation = useMutation({
    mutationFn: entriesApi.create,
    onSuccess: (result) => {
      if (result.warnings.length > 0) {
        setPendingWarning(result.warnings[0]);
        setPendingResult(result);
        if (!result.alreadyCheckedIn) refresh();
      } else {
        handleSuccess(result);
      }
    },
    onError: () => {
      showToast('error', 'Fehler beim Einlassen. Bitte erneut versuchen.');
    },
  });

  function handleSuccess(result: EntryResult) {
    const name = `${result.member.firstName} ${result.member.lastName}`;
    showToast('success', `${name} wurde eingelassen.`);
    refresh();
    setSelectedMember(null);
    setLastName('');
    setFirstName('');
    onEntryCreated();
  }

  function handleSelectMember(member: Member) {
    setSelectedMember(member);
    setLastName(member.lastName);
    setFirstName(member.firstName);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data = selectedMember
      ? { memberId: selectedMember.id, method: 'manual' as const, entryDate }
      : { lastName: lastName.trim(), firstName: firstName.trim(), method: 'manual' as const, entryDate };

    if (!selectedMember && (!lastName.trim() || !firstName.trim())) {
      showToast('warning', 'Bitte Name und Vorname eingeben.');
      return;
    }

    mutation.mutate(data);
  }

  const memberName = pendingResult
    ? `${pendingResult.member.firstName} ${pendingResult.member.lastName}`
    : '';

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3">
        <MemberAutocomplete
          onSelect={handleSelectMember}
          placeholder="Mitglied suchen..."
        />

        <div className="flex gap-2">
          <Input
            placeholder="Nachname"
            value={lastName}
            onChange={(e) => { setLastName(e.target.value); setSelectedMember(null); }}
            className="flex-1"
          />
          <Input
            placeholder="Vorname"
            value={firstName}
            onChange={(e) => { setFirstName(e.target.value); setSelectedMember(null); }}
            className="flex-1"
          />
        </div>

        <Button
          type="submit"
          loading={mutation.isPending}
          disabled={!lastName.trim() && !firstName.trim() && !selectedMember}
          className="w-full"
        >
          <UserPlus className="h-4 w-4" />
          Manuell hinzufügen
        </Button>
      </form>

      <ManualWarningDialog
        warning={pendingWarning?.type !== 'trial_training' ? pendingWarning : null}
        memberName={memberName}
        onConfirm={() => {
          if (pendingResult && !pendingResult.alreadyCheckedIn) {
            handleSuccess(pendingResult);
          }
          setPendingWarning(null);
          setPendingResult(null);
        }}
        onClose={() => {
          if (pendingResult && !pendingResult.alreadyCheckedIn) {
            handleSuccess(pendingResult);
          }
          setPendingWarning(null);
          setPendingResult(null);
        }}
      />

      <TrialWarningDialog
        warning={pendingWarning?.type === 'trial_training' ? pendingWarning : null}
        memberName={memberName}
        memberId={pendingResult?.member.id ?? null}
        onConfirm={(registrationDate) => {
          if (pendingResult?.member.id) {
            membersApi.updateFlags(pendingResult.member.id, { trialRegistrationDate: registrationDate });
          }
          if (pendingResult && !pendingResult.alreadyCheckedIn) {
            handleSuccess(pendingResult);
          }
          setPendingWarning(null);
          setPendingResult(null);
        }}
        onSkip={() => {
          if (pendingResult && !pendingResult.alreadyCheckedIn) {
            handleSuccess(pendingResult);
          }
          setPendingWarning(null);
          setPendingResult(null);
        }}
      />
    </>
  );
}
