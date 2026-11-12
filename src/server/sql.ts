/**
 * Split a SQL file into top-level statements without breaking quoted strings,
 * dollar-quoted blocks, or line comments. Used by the tenant migration runner.
 */
export function splitStatements(source: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  let quote: string | null = null;
  let dollarTag: string | null = null;
  let lineComment = false;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (lineComment) {
      current += ch;
      if (ch === '\n') lineComment = false;
      i += 1;
      continue;
    }

    if (dollarTag) {
      current += ch;
      if (source.startsWith(dollarTag, i)) {
        current += dollarTag.slice(1);
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      i += 1;
      continue;
    }

    if (quote) {
      current += ch;
      if (ch === quote) {
        if (next === quote) {
          current += next;
          i += 2;
          continue;
        }
        quote = null;
      }
      i += 1;
      continue;
    }

    if (ch === '-' && next === '-') {
      lineComment = true;
      current += ch;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      i += 1;
      continue;
    }

    if (ch === '$') {
      const match = source.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (ch === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}
