# Update the DARB logo everywhere

## Goal
Use the uploaded blue chat-and-headphones mark as DARB’s single logo across the website, installed desktop/mobile app, browser tab, loading and offline screens, account screens, onboarding, notifications, emails, and search/social brand metadata.

## Implementation
1. **Prepare one master brand asset**
   - Preserve the uploaded transparent PNG without stretching or recoloring it.
   - Store the main website asset through the project’s managed asset delivery.
   - Replace the two older blue logo variants currently used across public and account pages.

2. **Create installation and browser icons**
   - Generate exact 192×192 and 512×512 standard app icons.
   - Generate separate 192×192 and 512×512 maskable icons with safe padding so phone launchers do not crop the headphones or speech-bubble tail.
   - Generate a compact 64×64 browser favicon and Apple touch icon from the same mark.
   - Keep the existing install manifest names, shortcuts, standalone behavior, and Arabic direction unchanged.

3. **Replace every active brand placement**
   - Public header.
   - Student sign-in and account activation.
   - Student onboarding.
   - Startup/loading screen and offline page.
   - Installed desktop/mobile app icon and manifest shortcuts.
   - Browser tab/favicon and Apple home-screen icon.
   - Web-notification icon references, correcting the currently referenced missing icon filenames.
   - Search/structured brand metadata and social-sharing logo references.
   - Transactional and authentication email branding, including both email rendering paths.

4. **Remove stale logo fallbacks**
   - Remove or stop referencing the obsolete favicon and old logo variants once all active references use the new artwork.
   - Keep unrelated school, destination, and partner logos unchanged.

## Verification
- Confirm every logo reference resolves successfully and no old DARB logo path remains active.
- Check the website header, sign-in, activation, onboarding, loading, and offline views.
- Check manifest/icon dimensions, transparency, maskable safe area, favicon, and notification paths.
- Verify install appearance at phone and desktop icon sizes.
- Check Arabic RTL and English layouts at mobile and desktop widths.
- Run the project’s automated checks and inspect the latest preview status.

## Release note
Installed apps and social/email branding update after the next publish. Existing installed icons may remain cached until the browser or operating system refreshes the app metadata; reinstalling the app forces the new icon immediately.
