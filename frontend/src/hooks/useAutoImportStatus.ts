import { useQuery } from '@tanstack/react-query';
import { importApi } from '@/api/import';

// Schnell abfragen, solange gerade verarbeitet wird, sonst nur gelegentlich. Reine Leseabfrage ohne Eingabefeld,
// stört also die Tastatureingabe des Handscanners nicht.
export function useAutoImportStatus() {
  return useQuery({
    queryKey: ['auto-import-status'],
    queryFn: importApi.getAutoStatus,
    refetchInterval: (query) => (query.state.data?.state === 'processing' ? 2_000 : 10_000),
  });
}
