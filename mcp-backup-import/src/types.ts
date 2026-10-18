export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, { rowCount: number; rows: Record<string, unknown>[] }>;
}
