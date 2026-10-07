import sql from '../lib/db.js';
import { parseMemberCsv } from '../lib/csvParser.js';

export async function importMembersFromCsv(fileContent: string, filename: string, entryDateOverride?: string) {
  const { rows, errors } = parseMemberCsv(fileContent);

  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsSkipped = 0;
  const memberLinks: Array<{ memberId: number; action: string }> = [];
  const importErrors = [...errors];

  const now = new Date();
  let entryDate: Date;
  let entryTime: Date;
  if (entryDateOverride) {
    const [y, m, d] = entryDateOverride.split('-').map(Number);
    entryDate = new Date(y, m - 1, d);
    entryTime = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
  } else {
    entryDate = new Date(now);
    entryDate.setHours(0, 0, 0, 0);
    entryTime = now;
  }

  // Each row runs in its own savepoint so a failing row does not abort the whole import
  let importLogId!: number;
  const seenMemberNumbers = new Set<string>();
  const linkedMemberIds = new Set<number>();

  await sql.begin(async (tx) => {
    for (const row of rows) {
      // Member number 0 (or empty) means the member was entered manually instead of scanned
      const isManual = /^0*$/.test(row.memberNumber);

      // A member number that appears more than once in the file is only imported the first time
      if (!isManual) {
        if (seenMemberNumbers.has(row.memberNumber)) {
          recordsSkipped++;
          continue;
        }
        seenMemberNumbers.add(row.memberNumber);
      }

      try {
        const method = isManual ? 'manual' : 'scan';
        const { memberId, action, hasEntry } = await tx.savepoint(async (sp) => {
          let memberId: number;
          let action: 'created' | 'updated' | 'skipped';

          if (!isManual) {
            const [existing] = await sp<{ id: number; last_name: string; first_name: string }[]>`
              SELECT id, last_name, first_name FROM members WHERE member_number = ${row.memberNumber}
            `;
            if (!existing) {
              const [created] = await sp<{ id: number }[]>`
                INSERT INTO members (member_number, last_name, first_name, source)
                VALUES (${row.memberNumber}, ${row.lastName}, ${row.firstName}, 'import')
                RETURNING id
              `;
              memberId = created.id;
              action = 'created';
            } else {
              const nameChanged = existing.last_name !== row.lastName || existing.first_name !== row.firstName;
              if (nameChanged) {
                await sp`
                  UPDATE members SET last_name = ${row.lastName}, first_name = ${row.firstName}, updated_at = now()
                  WHERE id = ${existing.id}
                `;
                action = 'updated';
              } else {
                action = 'skipped';
              }
              memberId = existing.id;
            }
          } else {
            const [existing] = await sp<{ id: number }[]>`
              SELECT id FROM members
              WHERE last_name ILIKE ${row.lastName} AND first_name ILIKE ${row.firstName}
              LIMIT 1
            `;
            if (!existing) {
              const [created] = await sp<{ id: number }[]>`
                INSERT INTO members (member_number, last_name, first_name, source)
                VALUES (NULL, ${row.lastName}, ${row.firstName}, 'import')
                RETURNING id
              `;
              memberId = created.id;
              action = 'created';
            } else {
              memberId = existing.id;
              action = 'skipped';
            }
          }

          const [existingEntry] = await sp<{ id: number }[]>`
            SELECT id FROM entries WHERE member_id = ${memberId} AND entry_date = ${entryDate} LIMIT 1
          `;
          if (!existingEntry) {
            await sp`
              INSERT INTO entries (member_id, method, entry_date, entry_time)
              VALUES (${memberId}, ${method}, ${entryDate}, ${entryTime})
            `;
          }

          return { memberId, action, hasEntry: !!existingEntry };
        });

        // Only count once the row's savepoint has been committed
        if (action === 'created') recordsCreated++;
        else if (action === 'updated') recordsUpdated++;
        else recordsSkipped++;

        // The same member may be matched by several rows (e.g. manual entries); link it only once
        if (!linkedMemberIds.has(memberId)) {
          linkedMemberIds.add(memberId);
          memberLinks.push({ memberId, action: hasEntry ? 'skipped' : action });
        }
      } catch (err) {
        importErrors.push({
          line: rows.indexOf(row) + 1,
          content: `${row.memberNumber};${row.lastName};${row.firstName}`,
          reason: err instanceof Error ? err.message : 'Unbekannter Fehler',
        });
      }
    }

    const [log] = await tx<{ id: number }[]>`
      INSERT INTO import_logs (filename, records_total, records_created, records_updated, records_skipped, errors)
      VALUES (
        ${filename}, ${rows.length}, ${recordsCreated}, ${recordsUpdated}, ${recordsSkipped},
        ${JSON.stringify(importErrors)}
      )
      RETURNING id
    `;
    importLogId = log.id;

    for (const link of memberLinks) {
      await tx`
        INSERT INTO import_member_links (import_id, member_id, action)
        VALUES (${importLogId}, ${link.memberId}, ${link.action})
      `;
    }
  });

  return {
    importId: importLogId,
    recordsTotal: rows.length,
    recordsCreated,
    recordsUpdated,
    recordsSkipped,
    errors: importErrors,
  };
}

type ImportLogRow = {
  id: number; filename: string; imported_at: Date;
  records_total: number; records_created: number; records_updated: number; records_skipped: number;
  errors: unknown;
};

function mapImportLog(r: ImportLogRow) {
  return {
    id: r.id,
    filename: r.filename,
    importedAt: r.imported_at,
    recordsTotal: r.records_total,
    recordsCreated: r.records_created,
    recordsUpdated: r.records_updated,
    recordsSkipped: r.records_skipped,
    errors: r.errors,
  };
}

export async function getImportLogs(limit = 20, offset = 0) {
  const [rows, countResult] = await Promise.all([
    sql<ImportLogRow[]>`
      SELECT id, filename, imported_at, records_total, records_created, records_updated, records_skipped, errors
      FROM import_logs ORDER BY imported_at DESC LIMIT ${limit} OFFSET ${offset}
    `,
    sql<[{ count: string }]>`SELECT COUNT(*) AS count FROM import_logs`,
  ]);
  return { logs: rows.map(mapImportLog), total: Number(countResult[0].count) };
}

export async function deleteImportLog(id: number) {
  await sql`DELETE FROM import_logs WHERE id = ${id}`;
}

export async function getImportLogById(id: number) {
  const [log] = await sql<{
    id: number; filename: string; imported_at: Date;
    records_total: number; records_created: number; records_updated: number; records_skipped: number;
    errors: unknown;
  }[]>`
    SELECT id, filename, imported_at, records_total, records_created, records_updated, records_skipped, errors
    FROM import_logs WHERE id = ${id}
  `;
  if (!log) return null;

  const links = await sql<{
    member_id: number; action: string;
    m_id: number; member_number: string | null; last_name: string; first_name: string;
  }[]>`
    SELECT iml.member_id, iml.action,
           m.id AS m_id, m.member_number, m.last_name, m.first_name
    FROM import_member_links iml
    JOIN members m ON m.id = iml.member_id
    WHERE iml.import_id = ${id}
  `;

  return {
    id: log.id,
    filename: log.filename,
    importedAt: log.imported_at,
    recordsTotal: log.records_total,
    recordsCreated: log.records_created,
    recordsUpdated: log.records_updated,
    recordsSkipped: log.records_skipped,
    errors: log.errors,
    memberLinks: links.map((l) => ({
      memberId: l.member_id,
      action: l.action,
      member: { id: l.m_id, memberNumber: l.member_number, lastName: l.last_name, firstName: l.first_name },
    })),
  };
}
