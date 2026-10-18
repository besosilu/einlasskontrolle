import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { listBackupsTool } from './tools/listBackups.js';
import { generateBackupTool } from './tools/generateBackup.js';
import { importBackupTool } from './tools/importBackup.js';

const server = new McpServer({ name: 'mcp-backup-import', version: '1.0.0' });

server.tool(
  'list_backups',
  'Listet die auf dem Einlasskontrolle-Server vorhandenen Sicherungsdateien auf (Dateiname, Größe, Zeitstempel).',
  {},
  async () => listBackupsTool(),
);

server.tool(
  'generate_backup',
  'Erzeugt auf dem Einlasskontrolle-Server jetzt eine neue Sicherungsdatei (JSON-Export von Mitgliedern, Einträgen usw.).',
  {},
  async () => generateBackupTool(),
);

server.tool(
  'import_backup',
  'Importiert eine Sicherungsdatei des Einlasskontrolle-Servers in die zentrale Backup-Datenbank. ' +
    'Idempotent (Upsert) - mehrfacher Import derselben Datei erzeugt keine Duplikate. Ohne Angabe wird die neueste Sicherung verwendet.',
  { filename: z.string().optional().describe('Dateiname der Sicherung; ohne Angabe wird die neueste verwendet.') },
  async ({ filename }) => importBackupTool(filename),
);

const transport = new StdioServerTransport();
await server.connect(transport);
