# ABU Pinterest Gallery

## WebKit Spotlight Flash Fix
On real iPhones (Safari or Chrome), WebKit can show a single white frame when an overlay animation starts. To avoid this, the spotlight animation includes a WebKit-safe path:

- Keep the gallery container composited on the GPU during the animation.
- Avoid switching the body to `position: fixed` on iOS (use `overflow: hidden` instead).
- Delay scroll-lock by one extra frame on iOS to allow a clean first paint.
- Use a non-white background while spotlight is open to avoid a white flash if WebKit repaints.

These changes reduce compositor flicker without altering the spotlight UX.
