# X to Notion Idea Saver

Production-grade Chrome extension (Manifest V3) for capturing X post ideas directly into Notion.

## Core behavior

- Injects a resilient `Save idea` action onto X posts
- Saves only key post details to Notion with one click
- Prevents duplicates by canonical post URL
- Handles repeated rapid clicks with in-flight dedupe locks
- Maps common Notion errors into clear UX messages

## UX and reliability features

- High-contrast, stateful button UX (`Saving`, `Saved`, `Already saved`, `Retry`)
- Non-blocking toast feedback for success/failure
- Robust selector strategy for dynamic X DOM updates
- Connection diagnostics page with schema health checks
- Optional schema warnings (missing/mismatched optional fields)

## Notion schema requirements

### Required (must exist with exact type)

- `Title` (title)
- `Post URL` (url)
- `Saved At` (date)

### Optional (recommended)

- `Posted At` (date)

## Security model

- `notionToken` is stored in `chrome.storage.local` only (not synced).
- `notionDatabaseId` and `enabledOnX` are stored in `chrome.storage.sync`.

## Setup

1. Create a Notion internal integration and copy its token.
2. Share your target Notion database with that integration.
3. Open `chrome://extensions`, enable Developer mode, then click `Load unpacked`.
4. Select this repository folder.
5. Open extension options:
   - Paste token
   - Paste database ID or full Notion database URL
   - Click `Save Settings`
   - Click `Test Connection`

## Local development

Run test suite:

```bash
npm test
```

No build step is required for this codebase.

## Chrome Web Store package resources

Prepared store artifacts are in:
- `docs/chrome-web-store/listing-copy.md`
- `docs/chrome-web-store/privacy-policy.md`
- `docs/chrome-web-store/permission-rationale.md`
- `docs/chrome-web-store/submission-checklist.md`

Extension icons are in:
- `assets/icons/icon16.png`
- `assets/icons/icon32.png`
- `assets/icons/icon48.png`
- `assets/icons/icon128.png`
