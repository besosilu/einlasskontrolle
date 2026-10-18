import postgres from 'postgres';
import type { BackupPayload } from './types.js';

// Muss mit backend/src/services/backup.service.ts (SCHEMA_VERSION) übereinstimmen.
export const SUPPORTED_SCHEMA_VERSION = 1;

// Feste Spalten-Whitelist pro schemaVersion - Identifier kommen NIE aus der Exportdatei selbst
// (die Datei liefert nur Werte), das schließt SQL-Injection über Spaltennamen aus.
const TABLE_COLUMNS: Record<string, string[]> = {
  members: ['id', 'member_number', 'last_name', 'first_name', 'source', 'created_at', 'updated_at'],
  import_logs: [
    'id',
    'filename',
    'imported_at',
    'records_total',
    'records_created',
    'records_updated',
    'records_skipped',
    'errors',
  ],
  price_items: [
    'id',
    'category',
    'name',
    'description',
    'price',
    'period',
    'active',
    'sort_order',
    'created_at',
    'updated_at',
  ],
  entries: ['id', 'member_id', 'entry_time', 'entry_date', 'method', 'notes', 'created_by'],
  import_member_links: ['import_id', 'member_id', 'action'],
};

const CONFLICT_COLUMNS: Record<string, string[]> = {
  members: ['id'],
  import_logs: ['id'],
  price_items: ['id'],
  entries: ['id'],
  import_member_links: ['import_id', 'member_id'],
};

// Reihenfolge wegen Fremdschlüsseln: members/import_logs/price_items zuerst (unabhängig bzw.
// Ziel einer Referenz), dann entries (braucht members), dann import_member_links (braucht beide).
const IMPORT_ORDER = ['members', 'import_logs', 'price_items', 'entries', 'import_member_links'];

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY,
    member_number VARCHAR(50) UNIQUE,
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    records_total INTEGER NOT NULL,
    records_created INTEGER NOT NULL,
    records_updated INTEGER NOT NULL,
    records_skipped INTEGER NOT NULL,
    errors JSONB NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS price_items (
    id INTEGER PRIMARY KEY,
    category VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    period VARCHAR(50),
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    entry_time TIMESTAMPTZ NOT NULL,
    entry_date DATE NOT NULL,
    method VARCHAR(10) NOT NULL,
    notes TEXT,
    created_by VARCHAR(100)
  );
  CREATE TABLE IF NOT EXISTS import_member_links (
    import_id INTEGER NOT NULL REFERENCES import_logs(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    action VARCHAR(10) NOT NULL,
    PRIMARY KEY (import_id, member_id)
  );
`;

function getConnectionString(): string {
  const url = process.env['CENTRAL_DATABASE_URL'];
  if (!url) {
    throw new Error('CENTRAL_DATABASE_URL ist nicht gesetzt (siehe mcp-backup-import/README.md).');
  }
  return url;
}

async function upsertRows(
  tx: postgres.TransactionSql,
  table: string,
  rows: Record<string, unknown>[],
  conflictCols: string[],
): Promise<void> {
  if (rows.length === 0) return;

  // Nur bekannte Spalten übernehmen - unbekannte Schlüssel in der Exportdatei werden ignoriert,
  // statt sie (auch nur als Wert) blind durchzureichen.
  const knownColumns = TABLE_COLUMNS[table]!;
  const presentColumns = knownColumns.filter((c) => c in (rows[0] ?? {}));
  const updateColumns = presentColumns.filter((c) => !conflictCols.includes(c));
  const colList = presentColumns.map((c) => `"${c}"`).join(', ');
  const conflictList = conflictCols.map((c) => `"${c}"`).join(', ');
  const setClause = updateColumns.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');
  const conflictAction = setClause.length > 0 ? `DO UPDATE SET ${setClause}` : 'DO NOTHING';

  for (const row of rows) {
    const placeholders = presentColumns.map((_, i) => `$${i + 1}`).join(', ');
    const values = presentColumns.map((c) => row[c]);
    await tx.unsafe(
      `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})
       ON CONFLICT (${conflictList}) ${conflictAction}`,
      values as never[],
    );
  }
}

export async function importBackupIntoTargetDb(payload: BackupPayload): Promise<Record<string, number>> {
  const sql = postgres(getConnectionString(), { max: 5 });
  try {
    const importedRows: Record<string, number> = {};
    await sql.begin(async (tx) => {
      await tx.unsafe(SCHEMA_SQL);
      for (const table of IMPORT_ORDER) {
        const rows = payload.tables[table]?.rows ?? [];
        await upsertRows(tx, table, rows, CONFLICT_COLUMNS[table]!);
        importedRows[table] = rows.length;
      }
    });
    return importedRows;
  } finally {
    await sql.end();
  }
}
