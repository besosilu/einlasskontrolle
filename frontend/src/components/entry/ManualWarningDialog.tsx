import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import type { Warning } from '@/types';

interface ManualWarningDialogProps {
  warning: Warning | null;
  memberName: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ManualWarningDialog({
  warning,
  memberName,
  onConfirm,
  onClose,
}: ManualWarningDialogProps) {
  if (!warning) return null;

  const isAlreadyCheckedIn = warning.type === 'already_checked_in';

  return (
    <Dialog
      open={!!warning}
      onClose={onClose}
      title={isAlreadyCheckedIn ? 'Bereits eingelassen' : 'Hinweis: Häufige manuelle Einlässe'}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
        </div>
        <div>
          <p className="font-medium text-slate-800">{memberName}</p>
          <p className="mt-1 text-sm text-slate-600">{warning.message}</p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Schliessen
        </Button>
        {!isAlreadyCheckedIn && (
          <Button onClick={onConfirm}>Verstanden, weiter</Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
