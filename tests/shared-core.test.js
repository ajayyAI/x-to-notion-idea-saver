const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../src/shared-core.js");

test("normalizePostUrl canonicalizes valid x.com and twitter.com URLs", () => {
  assert.equal(
    core.normalizePostUrl("https://x.com/naval/status/1938273648273648?t=abc"),
    "https://x.com/naval/status/1938273648273648"
  );
  assert.equal(
    core.normalizePostUrl("https://twitter.com/naval/status/1938273648273648"),
    "https://x.com/naval/status/1938273648273648"
  );
  assert.equal(core.normalizePostUrl("/naval/status/1938273648273648"), "https://x.com/naval/status/1938273648273648");
  assert.equal(
    core.normalizePostUrl("https://x.com/i/web/status/1938273648273648"),
    "https://x.com/i/web/status/1938273648273648"
  );
  assert.equal(
    core.normalizePostUrl("https://twitter.com/i/status/1938273648273648?ref=abc"),
    "https://x.com/i/web/status/1938273648273648"
  );
});

test("normalizePostUrl rejects invalid status URLs", () => {
  assert.equal(core.normalizePostUrl("https://x.com/home"), null);
  assert.equal(core.normalizePostUrl("https://example.com/naval/status/1"), null);
  assert.equal(core.normalizePostUrl("not-a-url"), null);
});

test("extractStatusIdFromPostUrl supports canonical and i/web links", () => {
  assert.equal(core.extractStatusIdFromPostUrl("https://x.com/naval/status/1938273648273648"), "1938273648273648");
  assert.equal(core.extractStatusIdFromPostUrl("https://x.com/i/web/status/1938273648273648"), "1938273648273648");
  assert.equal(core.extractStatusIdFromPostUrl("/i/status/1938273648273648"), "1938273648273648");
  assert.equal(core.extractStatusIdFromPostUrl("https://x.com/home"), null);
});

test("buildCanonicalPostUrl chooses handle format when available", () => {
  assert.equal(
    core.buildCanonicalPostUrl("1938273648273648", "naval"),
    "https://x.com/naval/status/1938273648273648"
  );
  assert.equal(
    core.buildCanonicalPostUrl("1938273648273648", ""),
    "https://x.com/i/web/status/1938273648273648"
  );
  assert.equal(core.buildCanonicalPostUrl("", "naval"), null);
});

test("buildMinimalTitle uses statusId when available", () => {
  assert.equal(core.buildMinimalTitle("1938273648273648"), "X post 1938273648273648");
  assert.equal(core.buildMinimalTitle(""), "Saved X post");
});

test("normalizeDatabaseId accepts raw IDs and notion URLs", () => {
  assert.equal(
    core.normalizeDatabaseId("12345678123412341234123456789abc"),
    "12345678-1234-1234-1234-123456789abc"
  );
  assert.equal(
    core.normalizeDatabaseId("12345678-1234-1234-1234-123456789abc"),
    "12345678-1234-1234-1234-123456789abc"
  );
  assert.equal(
    core.normalizeDatabaseId("https://www.notion.so/workspace/Ideas-12345678123412341234123456789abc"),
    "12345678-1234-1234-1234-123456789abc"
  );
});

test("buildTitle falls back to handle when post has no text", () => {
  assert.equal(core.buildTitle("   ", "naval"), "X post by @naval");
  assert.equal(core.buildTitle("", ""), "Saved X post");
});

test("buildAuthorLabel combines name and handle", () => {
  assert.equal(core.buildAuthorLabel("naval", "Naval"), "Naval (@naval)");
  assert.equal(core.buildAuthorLabel("naval", ""), "@naval");
});

test("normalizeISODate returns null for invalid date values", () => {
  assert.equal(core.normalizeISODate("invalid"), null);
  assert.match(core.normalizeISODate("2025-11-20T10:00:00Z"), /^2025-11-20T10:00:00\.000Z$/);
});

test("evaluateDatabaseSchema detects missing and mismatched properties", () => {
  const result = core.evaluateDatabaseSchema({
    Title: { type: "title" },
    "Post URL": { type: "rich_text" },
    "Saved At": { type: "date" }
  });

  assert.deepEqual(result.missingRequired, []);
  assert.deepEqual(result.missingOptional, ["Posted At"]);
  assert.deepEqual(result.mismatchedRequired, [{ name: "Post URL", expected: "url", actual: "rich_text" }]);
  assert.deepEqual(result.mismatchedOptional, []);
  assert.equal(result.isWriteSafe, false);
});

test("evaluateDatabaseSchema marks minimum write-safe schema", () => {
  const result = core.evaluateDatabaseSchema({
    Title: { type: "title" },
    "Post URL": { type: "url" },
    "Saved At": { type: "date" }
  });
  assert.equal(result.isWriteSafe, true);
});
