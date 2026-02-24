# Chrome Web Store Listing Copy

## Product Name
X to Notion Idea Saver

## Short Description (<= 132 chars)
Save high-signal X posts to your Notion ideas database in one click, with duplicate protection and clear save status.

## Detailed Description
Capture viral post ideas from X without breaking your flow.

X to Notion Idea Saver adds a lightweight `Save idea` action directly on posts in `x.com`. Click once and the post is written to your Notion database with only the most important fields.

### What it does
- Adds an in-feed save action on X posts
- Saves to your Notion database with:
  - Auto-generated title from post ID
  - Canonical post URL
  - Original post timestamp (when available)
  - Save timestamp
- Prevents duplicates by checking post URL before insert
- Shows clear save feedback (`Saving`, `Saved`, `Already saved`, `Retry`)

### Why it is useful
- Stop losing ideas in bookmarks and tabs
- Build a structured swipe file of viral formats
- Keep your ideation workflow inside Notion

### Setup
1. Create a Notion internal integration.
2. Share your target Notion database with that integration.
3. Paste your integration token and database ID in extension settings.
4. Run `Test Connection`.

### Data model
Required Notion properties:
- `Title` (title)
- `Post URL` (url)
- `Saved At` (date)

Optional properties:
- `Posted At` (date)

## Single Purpose Statement
This extension helps users save selected X posts into their own Notion database for idea capture and research.

## Category Suggestion
Productivity
