Placeholder install icons live in this folder.

Replace these files before shipping:
- `icon-192.png`: 192x192 PNG app icon for Android/PWA install surfaces.
- `icon-512.png`: 512x512 PNG app icon for Android/PWA install surfaces.
- `apple-touch-icon.png`: 180x180 PNG icon for iOS home screen install.

Recommended source asset:
- Start from a 1024x1024 PNG master with generous padding around the mark.
- Export square variants with a solid background so the icon reads well on phone home screens.
- Keep the important artwork inside the center safe zone because the manifest marks the icons as `maskable`.

Current files are placeholders so the app already has a valid installable icon pipeline.
