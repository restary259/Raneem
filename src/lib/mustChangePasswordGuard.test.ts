import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '..');
// Generated types legitimately contain the column name in insert/update shapes.
const SKIP_FILES = new Set([
  path.join(SRC_ROOT, 'integrations', 'supabase', 'types.ts'),
]);

function collectSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSources(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      if (!SKIP_FILES.has(full)) out.push(full);
    }
  }
  return out;
}

describe('must_change_password write guard', () => {
  it('no source file writes profiles.must_change_password directly', () => {
    // Object-literal writes look like `must_change_password: <expr>` inside
    // .from('profiles').update({...}). Reads use .select('must_change_password')
    // (no colon); the lookahead after the colon excludes type annotations like
    // `: boolean`. (Lookahead must sit before any \s* consumption, or
    // backtracking lets the annotation slip past.)
    const directWrite = /must_change_password\s*:(?!\s*(?:boolean|string|number|unknown)\b)/;
    const offenders = collectSources(SRC_ROOT).filter((file) =>
      directWrite.test(fs.readFileSync(file, 'utf8')),
    );
    expect(
      offenders,
      `Do not write profiles.must_change_password directly — use the change-own-password server boundary (restrict_profiles_write blocks non-admin writes).\nOffenders:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
