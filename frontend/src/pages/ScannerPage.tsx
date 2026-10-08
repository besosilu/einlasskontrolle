import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QrCode, CheckCircle, XCircle } from 'lucide-react';
import { format, isToday, isFuture } from 'date-fns';
import { de } from 'date-fns/locale';
import { entriesApi } from '@/api/entries';
import { useScanner } from '@/hooks/useScanner';
import { ManualEntryForm } from '@/components/entry/ManualEntryForm';
import { EntryList } from '@/components/entry/EntryList';
import { MiniCalendar } from '@/components/entry/MiniCalendar';
import { ManualWarningDialog } from '@/components/entry/ManualWarningDialog';
import { TrialWarningDialog } from '@/components/entry/TrialWarningDialog';
import { DashboardCards } from '@/components/dashboard/DashboardCards';
import { showToast } from '@/components/ui/Toast';
import { membersApi } from '@/api/members';
import type { Warning, EntryResult } from '@/types';
import { cn } from '@/utils/cn';

type ScanFeedback = { type: 'success' | 'error' | 'warning'; name?: string } | null;

export function ScannerPage() {
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>(null);
  const [pendingWarning, setPendingWarning] = useState<Warning | null>(null);
  const [pendingResult, setPendingResult] = useState<EntryResult | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const queryClient = useQueryClient();

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedToday = isToday(selectedDate);

  const scanMutation = useMutation({
    mutationFn: (qrCode: string) =>
      entriesApi.scan({ qrCode, entryDate: isSelectedToday ? undefined : selectedDateStr }),
    onSuccess: (result) => {
      const name = `${result.member.firstName} ${result.member.lastName}`;

      if (result.alreadyCheckedIn) {
        setScanFeedback({ type: 'warning', name });
        setPendingWarning(result.warnings[0] ?? null);
        setPendingResult(result);
        return;
      }

      if (result.warnings.length > 0) {
        setPendingWarning(result.warnings[0]);
        setPendingResult(result);
      }

      setScanFeedback({ type: 'success', name });
      queryClient.refetchQueries({ queryKey: ['entries', selectedDateStr] });
      queryClient.invalidateQueries({ queryKey: ['today-count'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setTimeout(() => setScanFeedback(null), 3000);
    },
    onError: () => {
      setScanFeedback({ type: 'error' });
      setTimeout(() => setScanFeedback(null), 3000);
      showToast('error', 'QR-Code nicht erkannt. Mitglied nicht gefunden.');
    },
  });

  useScanner({
    onScan: (code) => {
      if (!isFuture(selectedDate)) scanMutation.mutate(code);
    },
    enabled: !pendingWarning,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <DashboardCards />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Einlasskontrolle</h1>
        {!isSelectedToday && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
            Datum: {format(selectedDate, 'dd.MM.yyyy')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Scanner-Status */}
        <div className="space-y-4">
          <div
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-all duration-300',
              scanMutation.isPending
                ? 'border-blue-300 bg-blue-50'
                : scanFeedback?.type === 'success'
                ? 'border-emerald-300 bg-emerald-50'
                : scanFeedback?.type === 'error'
                ? 'border-red-300 bg-red-50'
                : scanFeedback?.type === 'warning'
                ? 'border-amber-300 bg-amber-50'
                : 'border-slate-200 bg-white'
            )}
          >
            {scanFeedback?.type === 'success' ? (
              <>
                <CheckCircle className="h-14 w-14 text-emerald-500" />
                <p className="mt-3 font-semibold text-emerald-700">{scanFeedback.name}</p>
                <p className="text-sm text-emerald-600">Erfolgreich eingelassen</p>
              </>
            ) : scanFeedback?.type === 'error' ? (
              <>
                <XCircle className="h-14 w-14 text-red-400" />
                <p className="mt-3 font-semibold text-red-600">Unbekannter QR-Code</p>
                <p className="text-sm text-red-500">Mitglied nicht gefunden</p>
              </>
            ) : scanFeedback?.type === 'warning' ? (
              <>
                <QrCode className="h-14 w-14 text-amber-400" />
                <p className="mt-3 font-semibold text-amber-700">{scanFeedback.name}</p>
                <p className="text-sm text-amber-600">Bereits heute eingelassen</p>
              </>
            ) : (
              <>
                <QrCode className={cn('h-14 w-14', scanMutation.isPending ? 'text-blue-400 animate-pulse' : 'text-slate-300')} />
                <p className="mt-3 text-sm font-medium text-slate-500">
                  {scanMutation.isPending ? 'Wird verarbeitet...' : 'Scanner bereit'}
                </p>
                <p className="text-xs text-slate-400">QR-Code scannen oder unten manuell eingeben</p>
              </>
            )}
          </div>

          {/* Manuelle Eingabe */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Manuelle Eingabe</h2>
            <ManualEntryForm
              onEntryCreated={() => {}}
              entryDate={isSelectedToday ? undefined : selectedDateStr}
            />
          </div>
        </div>

        {/* Tagesliste + Mini-Kalender */}
        <div className="rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden">
          {/* Kalender-Header (kollabiert, kompakt) */}
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <MiniCalendar
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              currentMonth={calendarMonth}
              onMonthChange={setCalendarMonth}
              onToday={() => { setSelectedDate(new Date()); setCalendarMonth(new Date()); }}
            />
          </div>

          {/* Liste */}
          <div className="flex-1 p-5">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-700">
                {isToday(selectedDate)
                  ? 'Einlässe heute'
                  : format(selectedDate, 'dd. MMMM yyyy', { locale: de })}
              </h2>
            </div>
            <EntryList date={selectedDate} />
          </div>
        </div>
      </div>

      <ManualWarningDialog
        warning={pendingWarning?.type !== 'trial_training' ? pendingWarning : null}
        memberName={
          pendingResult
            ? `${pendingResult.member.firstName} ${pendingResult.member.lastName}`
            : ''
        }
        onConfirm={() => {
          setPendingWarning(null);
          setPendingResult(null);
          setTimeout(() => setScanFeedback(null), 2000);
        }}
        onClose={() => {
          setPendingWarning(null);
          setPendingResult(null);
          setTimeout(() => setScanFeedback(null), 2000);
        }}
      />

      <TrialWarningDialog
        warning={pendingWarning?.type === 'trial_training' ? pendingWarning : null}
        memberName={
          pendingResult
            ? `${pendingResult.member.firstName} ${pendingResult.member.lastName}`
            : ''
        }
        memberId={pendingResult?.member.id ?? null}
        onConfirm={(registrationDate) => {
          if (pendingResult?.member.id) {
            membersApi.updateFlags(pendingResult.member.id, { trialRegistrationDate: registrationDate });
          }
          setPendingWarning(null);
          setPendingResult(null);
          setTimeout(() => setScanFeedback(null), 2000);
        }}
        onSkip={() => {
          setPendingWarning(null);
          setPendingResult(null);
          setTimeout(() => setScanFeedback(null), 2000);
        }}
      />
    </div>
  );
}
