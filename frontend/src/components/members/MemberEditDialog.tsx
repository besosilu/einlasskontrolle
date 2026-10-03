import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { showToast } from '@/components/ui/Toast';
import { membersApi } from '@/api/members';
import type { Member } from '@/types';

interface MemberEditDialogProps {
  member: Member | null;
  onClose: () => void;
}

function extractErrorMessage(err: unknown): string {
  const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return msg ?? 'Fehler beim Speichern';
}

export function MemberEditDialog({ member, onClose }: MemberEditDialogProps) {
  const queryClient = useQueryClient();

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [needsNewCard, setNeedsNewCard] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialRegistrationDate, setTrialRegistrationDate] = useState('');

  useEffect(() => {
    if (!member) return;
    setLastName(member.lastName);
    setFirstName(member.firstName);
    setMemberNumber(member.memberNumber ?? '');
    setNeedsNewCard(member.needsNewCard);
    setIsTrainer(member.isTrainer);
    setIsTrial(member.isTrial);
    setTrialRegistrationDate(member.trialRegistrationDate ?? '');
  }, [member]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!member) return;
      await membersApi.update(member.id, {
        lastName,
        firstName,
        memberNumber: memberNumber || undefined,
      });
      await membersApi.updateFlags(member.id, {
        needsNewCard,
        isTrainer,
        isTrial,
        trialRegistrationDate: isTrial ? trialRegistrationDate || null : null,
      });
    },
    onSuccess: () => {
      showToast('success', 'Mitglied aktualisiert');
      queryClient.invalidateQueries({ queryKey: ['members-list'] });
      queryClient.invalidateQueries({ queryKey: ['member-search'] });
      onClose();
    },
    onError: (err: unknown) => showToast('error', extractErrorMessage(err)),
  });

  return (
    <Dialog open={!!member} onClose={onClose} title="Mitglied bearbeiten">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nachname" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <Input label="Vorname" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <Input
          label="Mitgliedsnummer"
          value={memberNumber}
          onChange={(e) => setMemberNumber(e.target.value)}
        />

        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={needsNewCard}
              onChange={(e) => setNeedsNewCard(e.target.checked)}
              className="rounded border-slate-300"
            />
            Neue Karte benötigt
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isTrainer}
              onChange={(e) => setIsTrainer(e.target.checked)}
              className="rounded border-slate-300"
            />
            Trainer
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isTrial}
              onChange={(e) => setIsTrial(e.target.checked)}
              className="rounded border-slate-300"
            />
            Schnupperer (Trial)
          </label>
          {isTrial && (
            <div className="pl-6">
              <Input
                label="Anmeldedatum"
                type="date"
                value={trialRegistrationDate}
                onChange={(e) => setTrialRegistrationDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Abbrechen
        </Button>
        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          Speichern
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
