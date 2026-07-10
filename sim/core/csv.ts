/**
 * Minimal RFC-4180-style CSV parser, sufficient for `Music Database.csv`
 * (quoted fields containing commas and escaped double quotes, CRLF or LF).
 *
 * The real pipeline parses the CSV with @rollup/plugin-dsv at build time
 * (vite.config.ts); the simulator reads the same file at runtime, so it needs
 * a parser that works outside vite without adding dependencies.
 */

export type CsvRow = Record<string, string>;

export function parseCsvText(text: string): CsvRow[] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRecord();
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || record.length) pushRecord();

  const [header, ...rows] = records;
  if (!header) return [];
  return rows.map((cells) =>
    Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ''])),
  );
}
