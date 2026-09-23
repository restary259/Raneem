# Let students chat with their own team member

Today a student can only open the "Team Member" chat once their file has reached the final, fully-paid stage. In the live data almost no student is at that stage, so for nearly everyone the button fails with "Chat with your team member is available once your case is completed." The chat itself already exists and works — only the condition for opening it is too strict.

## What changes

1. **Open the chat from day one.** A student can start the conversation as soon as they have a team member, at any stage of their file.
2. **Pick the right person.** The chat opens with the team member handling their file. If nobody is handling it yet, it falls back to the team member who created their account.
3. **Clearer message when nobody is assigned.** If neither exists, the student sees "A team member hasn't been assigned to you yet — you'll be able to message them once one is." instead of the current wording about a completed case.
4. **Tab always reachable.** The "Team Member" tab is shown even when the student has no case conversation and no payout conversation, so they can always reach their team member.

Everything else stays exactly as it is: the same conversation screen, the same one-thread-per-pair reuse, the same restriction that a student can still only write in their own case, payout, or team-member conversation.

## Technical notes

- Update `start_student_team_member_thread()` (the only place the rule lives): drop the `status = 'enrollment_paid'` filter; resolve the counterpart as the most recent non-deleted case's `assigned_to`, falling back to `profiles.created_by` of the calling student; raise a distinct error when neither resolves. Thread reuse, `purpose = 'team_member'` tagging, participant inserts, and `SECURITY DEFINER` + student-role check stay unchanged.
- `send_direct_message` already permits students in `purpose = 'team_member'` threads — no change.
- `src/pages/messages/StudentMessagesPage.tsx`: render the Team Member tab regardless of `hasTabs`, and map the new "no team member yet" error to a new key.
- New i18n key `messagesInbox.teamThreadNoMember` in EN + AR (parity guard); existing `teamThreadNoCase` left in place.

## Verification

Sign in as a real student in the preview and confirm the Team Member tab opens a working conversation with their assigned team member, messages send and appear on the team member's side, and the tab is present even with no other conversations. Build plus the i18n parity and title tests must pass.
