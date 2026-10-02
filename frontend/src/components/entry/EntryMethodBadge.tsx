import { QrCode, Pencil } from 'lucide-react';
import { cn } from '@/utils/cn';

interface EntryMethodBadgeProps {
  method: 'scan' | 'manual';
  size?: 'sm' | 'md';
}

export function EntryMethodBadge({ method, size = 'sm' }: EntryMethodBadgeProps) {
  const isSmall = size === 'sm';

  if (method === 'scan') {
    return (
      <span
        title="Per Scan eingelassen"
        className={cn(
          'inline-flex items-center gap-1 rounded-full font-medium',
          'bg-cyan-50 text-cyan-700 border border-cyan-200',
          isSmall ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
        )}
      >
        <QrCode className={isSmall ? 'h-3 w-3' : 'h-4 w-4'} />
        Scan
      </span>
    );
  }

  return (
    <span
      title="Manuell eingelassen"
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        'bg-violet-50 text-violet-700 border border-violet-200',
        isSmall ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      )}
    >
      <Pencil className={isSmall ? 'h-3 w-3' : 'h-4 w-4'} />
      Manuell
    </span>
  );
}
