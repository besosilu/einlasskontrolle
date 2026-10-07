import Papa from 'papaparse';

export interface MemberCsvRow {
  memberNumber: string;
  lastName: string;
  firstName: string;
}

export interface ParseResult {
  rows: MemberCsvRow[];
  errors: { line: number; content: string; reason: string }[];
}

export function parseMemberCsv(content: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(content, {
    delimiter: ';',
    header: false,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows: MemberCsvRow[] = [];
  const errors: { line: number; content: string; reason: string }[] = [];

  for (let i = 0; i < result.data.length; i++) {
    const raw = result.data[i];
    const lineNum = i + 1;

    // Support both header row (if present) and raw positional
    let cols = Object.values(raw).map((v) => (v ?? '').toString().trim());

    // Manually typed rows sometimes use commas, e.g. "0;Macholl, Lukas" or "0, Rahli, Lina"
    if (cols.length < 3 && cols.some((c) => c.includes(','))) {
      cols = cols.flatMap((c) => c.split(',')).map((c) => c.trim());
    }

    // Skip header rows
    if (
      cols[0]?.toLowerCase().includes('mitglied') ||
      cols[1]?.toLowerCase() === 'name' ||
      cols[2]?.toLowerCase() === 'vorname'
    ) {
      continue;
    }

    const [memberNumber, lastName, firstName] = cols;

    if (!lastName || !firstName) {
      errors.push({
        line: lineNum,
        content: cols.join(';'),
        reason: 'Name oder Vorname fehlt',
      });
      continue;
    }

    rows.push({
      memberNumber: memberNumber || '',
      lastName,
      firstName,
    });
  }

  return { rows, errors };
}
