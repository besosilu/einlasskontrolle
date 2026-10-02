import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Warning } from '@/types';

interface TrialWarningDialogProps {
  warning: Warning | null;
  memberName: string;
  memberId: number | null;
  onConfirm: (registrationDate: string) => void;
  onSkip: () => void;
}

export function TrialWarningDialog({
  warning,
  memberName,
  onConfirm,
  onSkip,
}: TrialWarningDialogProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  if (!warning || warning.type !== 'trial_training') return null;

  return (
    <Dialog
      open={!!warning}
      onClose={onSkip}
      title="Schnupper-Training: Anmeldung erfassen"
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100">
            <FlaskConical className="h-5 w-5 text-teal-600" />
          </div>
        </div>
        <div className="flex-1">
          <p className="font-medium text-slate-800">{memberName}</p>
          <p className="mt-1 text-sm text-slate-600">{warning.message}</p>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Datum der Anmeldungsbestätigung
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onSkip}>
          Später
        </Button>
        <Button
          onClick={() => onConfirm(date)}
          disabled={!date}
        >
          Anmeldung speichern
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
