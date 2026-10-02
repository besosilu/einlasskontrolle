import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { entriesApi } from '@/api/entries';
import { showToast } from '@/components/ui/Toast';

interface NotesDialogProps {
  entryId: number;
  entryDateStr: string;
  memberName: string;
  currentNotes: string | null;
  open: boolean;
  onClose: () => void;
}

export function NotesDialog({ entryId, entryDateStr, memberName, currentNotes, open, onClose }: NotesDialogProps) {
  const [text, setText] = useState(currentNotes ?? '');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => entriesApi.updateNotes(entryId, text.trim() || null),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['entries', entryDateStr] });
      showToast('success', 'Notiz gespeichert.');
      onClose();
    },
    onError: () => showToast('error', 'Fehler beim Speichern.'),
  });

  return (
    <Dialog open={open} onClose={onClose} title="Notiz bearbeiten">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </div>
        </div>
        <div className="flex-1">
          <p className="font-medium text-slate-800">{memberName}</p>
          <textarea
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            rows={3}
            placeholder="Notiz eingeben..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Speichern
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
