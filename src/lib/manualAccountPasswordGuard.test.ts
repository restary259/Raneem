import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FUNCTIONS_ROOT = path.resolve(__dirname, '..', '..', 'supabase', 'functions');

function readFunction(name: string): string {
  return fs.readFileSync(path.join(FUNCTIONS_ROOT, name, 'index.ts'), 'utf8');
}

/**
 * Invariant: every MANUALLY-created non-admin account (admin dashboard via
 * create-team-member, agent dashboard via agent-create-account) is handed a
 * temporary password, so profiles.must_change_password must be stamped true and
 * verified before that password is returned. The email-invite activation path
 * (accept-invitation) is the opposite: the invitee chooses their own password,
 * so the flag must stay false there.
 */
describe('manual account creation forces a password change', () => {
  for (const fn of ['create-team-member', 'agent-create-account']) {
    describe(fn, () => {
      const source = readFunction(fn);

      it('stamps must_change_password = true in a dedicated update', () => {
        expect(source).toMatch(/\.update\(\{[^}]*must_change_password:\s*true/s);
      });

      it('fails the request when the stamp cannot be written', () => {
        expect(source).toMatch(/if\s*\(stampError\)/);
        expect(source).toMatch(/stampError[\s\S]{0,600}?\b500\b/);
      });

      it('re-selects the flag and fails when it is not persisted', () => {
        expect(source).toMatch(/\.select\(\s*["']must_change_password["']\s*\)/);
        expect(source).toMatch(/stampCheck\?\.must_change_password\s*!==\s*true/);
        expect(source).toMatch(/must_change_password verification failed[\s\S]{0,600}?\b500\b/);
      });


      it('verifies the flag before returning the temporary password', () => {
        const verifyIndex = source.indexOf('must_change_password !== true');
        const successIndex = source.indexOf('success: true');
        expect(verifyIndex).toBeGreaterThan(-1);
        expect(successIndex).toBeGreaterThan(verifyIndex);
      });
    });
  }

  it('invite activation keeps must_change_password false', () => {
    const source = readFunction('accept-invitation');
    expect(source).toMatch(/must_change_password:\s*false/);
    expect(source).not.toMatch(/must_change_password:\s*true/);
  });
});
