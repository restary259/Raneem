# Fix desktop navigation dropdown placement

## Goal
Make the “About DARB” dropdown open directly beneath its navigation label, remain reachable while the pointer moves into it, and keep every item reliably clickable.

## Changes
- Adjust the shared desktop navigation menu positioning so each dropdown is anchored to its own trigger instead of the left edge of the full navigation group.
- Remove the empty vertical hover gap between the trigger and panel while preserving the existing appearance, animation, keyboard focus, and click destinations.
- Apply the same positioning behavior to the other desktop dropdowns so Study in Germany, Find Your Study Path, Resources, and About DARB behave consistently.
- Preserve the mobile menu and all navigation labels/routes unchanged.

## Verification
- Test pointer movement from each trigger into its dropdown and click every About DARB item.
- Check English, Arabic, and Hebrew desktop layouts for correct LTR/RTL anchoring.
- Capture desktop screenshots at laptop and wide-screen sizes, including the About menu open.
- Confirm keyboard navigation, focus states, no horizontal overflow, and a clean preview build.

## Technical detail
The screenshot and current shared menu code show the dropdown viewport positioned from the navigation root’s left edge. The fix will move desktop content positioning to the active menu item/trigger boundary and maintain a continuous interactive region between trigger and content.
