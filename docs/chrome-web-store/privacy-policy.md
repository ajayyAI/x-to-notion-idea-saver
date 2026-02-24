# Privacy Policy

**Last updated:** February 24, 2026

X to Notion Idea Saver is a client-side Chrome extension. It does not operate a backend service.

## What this extension does
The extension lets a user save selected X posts to the user's own Notion database.

## Data the extension handles
When you click `Save idea`, the extension processes:
- Post URL
- Post timestamp (if available)
- Save timestamp
- Post ID-derived title string

It also stores extension settings:
- Notion integration token
- Notion database ID
- Enable/disable preference for button injection on x.com

## Where data is stored
- `Notion integration token`: stored in `chrome.storage.local` on your device.
- `Notion database ID` and `enabledOnX` preference: stored in `chrome.storage.sync`.

## Where data is sent
Data is sent only to:
- `https://api.notion.com/*` to create/query pages in your Notion database

The extension runs on:
- `https://x.com/*` to detect posts and show the save action

No extension data is sent to any developer-owned servers.

## Data sharing
We do not sell user data.
We do not share data with third-party advertisers or analytics providers.
Data you choose to save is transmitted directly to your Notion workspace via Notion APIs.

## Authentication and security
- The extension uses the token you provide for your own Notion integration.
- The token is used only to call Notion APIs needed for save and duplicate-check workflows.
- You can remove stored settings at any time by clearing extension storage or uninstalling the extension.

## Analytics and tracking
This extension does not include analytics trackers, ad SDKs, or telemetry endpoints.

## Changes to this policy
If this policy changes, the `Last updated` date will be revised.

## Contact
For privacy questions, use the support contact listed in the Chrome Web Store listing.
