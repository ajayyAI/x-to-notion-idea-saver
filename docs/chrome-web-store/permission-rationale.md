# Chrome Web Store Permission Rationale

## Summary
This extension requires minimal permissions to inject a save action on X and write selected post data to a user-configured Notion database.

## Permissions

### `storage`
Used to persist extension configuration:
- Notion token (`chrome.storage.local`)
- Notion database ID (`chrome.storage.sync`)
- Feature toggle (`enabledOnX`)

No other local browser data is accessed.

## Host Permissions

### `https://x.com/*`
Required to:
- Render the `Save idea` button inside X post UI
- Read selected post details (URL and timestamp) after explicit user click

The extension does not scrape unrelated pages outside x.com.

### `https://api.notion.com/*`
Required to:
- Validate database configuration
- Query existing entries for duplicate detection
- Create pages in the user's Notion database

No non-Notion third-party APIs are called.

## Data access principles
- Access is purpose-limited to idea capture workflow.
- User action is required to trigger save operations.
- No advertising, analytics, or profiling permissions are requested.
