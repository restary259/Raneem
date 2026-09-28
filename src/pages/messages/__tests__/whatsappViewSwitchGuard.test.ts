import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const PAGE = path.resolve(__dirname, '..', 'WhatsAppInboxPage.tsx');

/**
 * The WhatsApp workspace must not offer an in-page Admin/Team view switch.
 *
 * Team mode is derived from the route/role (`inboxOnly`), so an admin can grant
 * a team member WhatsApp access without a control that lets an admin silently
 * drop into the simplified view (and that was a dead control on the team route).
 *
 * The team-mode RENDERING (`if (teamMode)`) must stay: it is what a granted team
 * member sees on `/team/whatsapp`.
 */
describe('WhatsApp workspace view-switch guard', () => {
  const source = fs.readFileSync(PAGE, 'utf8');

  it('does not render an Admin/Team toggle', () => {
    expect(source).not.toContain('adminTeamToggle');
    expect(source).not.toContain('adminTeamPreview');
    expect(source).not.toContain('setAdminTeamPreview');
  });

  it('derives team mode from the route/role, not UI state', () => {
    expect(source).toMatch(/const teamMode = inboxOnly;/);
  });

  it('keeps the team-mode rendering a granted team member relies on', () => {
    expect(source).toContain('if (teamMode)');
  });

  it('does not reference the removed toggle locale keys', () => {
    expect(source).not.toContain('tabs.viewToggle');
    expect(source).not.toContain('tabs.team');
  });
});
