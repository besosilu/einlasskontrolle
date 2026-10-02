import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Tag, Users, Loader2, EyeOff } from 'lucide-react';
import { pricesApi, type PriceItem, type PriceItemInput } from '@/api/prices';
import { showToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';

// ─── Price formatting ──────────────────────────────────────────────────────────
function formatPrice(price: string | number): string {
  return Number(price).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ─── Category config ───────────────────────────────────────────────────────────
const CATEGORIES: { key: 'membership' | 'course'; label: string; icon: typeof Users; accent: 'blue' | 'violet' }[] = [
  { key: 'membership', label: 'Mitgliedsbeiträge', icon: Users, accent: 'blue' },
  { key: 'course', label: 'Kurse', icon: Tag, accent: 'violet' },
];

const PERIOD_OPTIONS = ['monatlich', 'jährlich', 'einmalig', 'pro Einheit', 'pro Stunde', 'pro Semester'];

// ─── Form Dialog ───────────────────────────────────────────────────────────────
interface FormDialogProps {
  item: PriceItem | null;
  defaultCategory: 'membership' | 'course';
  onClose: () => void;
}

function FormDialog({ item, defaultCategory, onClose }: FormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = item !== null;

  const [form, setForm] = useState<PriceItemInput>({
    category: item?.category ?? defaultCategory,
    name: item?.name ?? '',
    description: item?.description ?? '',
    price: item ? Number(item.price) : 0,
    period: item?.period ?? '',
    active: item?.active ?? true,
  });

  const mutation = useMutation({
    mutationFn: isEdit
      ? (data: Partial<PriceItemInput>) => pricesApi.update(item!.id, data)
      : (data: PriceItemInput) => pricesApi.create(data as PriceItemInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
      showToast('success', isEdit ? 'Preis aktualisiert.' : 'Preis erstellt.');
      onClose();
    },
    onError: () => showToast('error', 'Fehler beim Speichern.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    mutation.mutate({
      ...form,
      description: form.description?.trim() || undefined,
      period: form.period?.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {isEdit ? 'Preis bearbeiten' : 'Neuer Preis'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Kategorie</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: cat.key }))}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                    form.category === cat.key
                      ? cat.key === 'membership'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-violet-200 bg-violet-50 text-violet-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  )}
                >
                  <cat.icon className="h-4 w-4" />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Bezeichnung *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="z.B. Erwachsene, Schwimmkurs Anfänger …"
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Price + Period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Preis (€) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Zeitraum</label>
              <input
                type="text"
                list="period-options"
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                placeholder="monatlich …"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <datalist id="period-options">
                {PERIOD_OPTIONS.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optionale Zusatzinfos …"
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Active toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <div
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              className={cn(
                'relative h-5 w-9 rounded-full transition-colors',
                form.active ? 'bg-blue-500' : 'bg-slate-200'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  form.active ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </div>
            <span className="text-sm text-slate-600">Aktiv (sichtbar)</span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.name.trim()}
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? 'Speichern …' : isEdit ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Price Card ────────────────────────────────────────────────────────────────
interface PriceCardProps {
  item: PriceItem;
  accent: 'blue' | 'violet';
  onEdit: () => void;
  onDelete: () => void;
}

function PriceCard({ item, accent, onEdit, onDelete }: PriceCardProps) {
  return (
    <div
      className={cn(
        'group relative flex items-center gap-4 rounded-xl border bg-white px-5 py-4 transition-all hover:shadow-sm',
        item.active ? 'border-slate-200' : 'border-slate-100 opacity-60'
      )}
    >
      {/* Color bar */}
      <div
        className={cn(
          'absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full',
          accent === 'blue' ? 'bg-blue-400' : 'bg-violet-400'
        )}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 pl-2">
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-800 truncate">{item.name}</p>
          {!item.active && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
              <EyeOff className="h-3 w-3" /> Inaktiv
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 text-xs text-slate-400 truncate">{item.description}</p>
        )}
      </div>

      {/* Price */}
      <div className="text-right shrink-0">
        <p className={cn(
          'text-lg font-bold tabular-nums',
          accent === 'blue' ? 'text-blue-700' : 'text-violet-700'
        )}>
          {formatPrice(item.price)}
        </p>
        {item.period && (
          <p className="text-xs text-slate-400">{item.period}</p>
        )}
      </div>

      {/* Actions (show on hover) */}
      <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Bearbeiten"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Löschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Category Section ──────────────────────────────────────────────────────────
interface CategorySectionProps {
  config: (typeof CATEGORIES)[number];
  items: PriceItem[];
  onAdd: () => void;
  onEdit: (item: PriceItem) => void;
  onDelete: (item: PriceItem) => void;
}

function CategorySection({ config, items, onAdd, onEdit, onDelete }: CategorySectionProps) {
  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            config.accent === 'blue' ? 'bg-blue-50' : 'bg-violet-50'
          )}>
            <config.icon className={cn(
              'h-4 w-4',
              config.accent === 'blue' ? 'text-blue-600' : 'text-violet-600'
            )} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">{config.label}</h2>
            <p className="text-xs text-slate-400">{items.length} Einträge</p>
          </div>
        </div>
        <button
          onClick={onAdd}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            config.accent === 'blue'
              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Hinzufügen
        </button>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
          Noch keine Einträge
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <PriceCard
              key={item.id}
              item={item}
              accent={config.accent}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export function PricesPage() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{
    open: boolean;
    item: PriceItem | null;
    defaultCategory: 'membership' | 'course';
  }>({ open: false, item: null, defaultCategory: 'membership' });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['prices'],
    queryFn: pricesApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: pricesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
      showToast('info', 'Preis gelöscht.');
    },
    onError: () => showToast('error', 'Fehler beim Löschen.'),
  });

  function handleDelete(item: PriceItem) {
    if (confirm(`"${item.name}" wirklich löschen?`)) {
      deleteMutation.mutate(item.id);
    }
  }

  const byCategory = (cat: 'membership' | 'course') =>
    items.filter((i) => i.category === cat);

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Preise & Kurse</h1>
          <p className="mt-1 text-sm text-slate-500">
            Mitgliedsbeiträge und Kurspreise verwalten
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : (
          <>
            {CATEGORIES.map((cat) => (
              <CategorySection
                key={cat.key}
                config={cat}
                items={byCategory(cat.key)}
                onAdd={() => setDialog({ open: true, item: null, defaultCategory: cat.key })}
                onEdit={(item) => setDialog({ open: true, item, defaultCategory: cat.key })}
                onDelete={handleDelete}
              />
            ))}
          </>
        )}
      </div>

      {dialog.open && (
        <FormDialog
          item={dialog.item}
          defaultCategory={dialog.defaultCategory}
          onClose={() => setDialog((d) => ({ ...d, open: false }))}
        />
      )}
    </>
  );
}
