// Tests for the multi-statement SQL validator. Zero dependencies.
// Run: node test.mjs   (CI runs this automatically on every push)

import { hasMultipleStatements } from "./worker.js";

const cases = [
  // [sql, expectMultiple]

  // Single statements — must be accepted
  ["SELECT * FROM users", false],
  ["SELECT * FROM users;", false],
  ["SELECT 'it''s a test; not two'", false],
  ["SELECT 'a;b' AS x", false],
  ['SELECT ";" AS col', false],
  ['SELECT * FROM "weird;table"', false],
  ["SELECT 1 -- comment with ; semicolon", false],
  ["SELECT 1 /* block; comment */", false],
  ["-- leading comment\nSELECT 1;", false],
  ["SELECT 1; -- trailing comment", false],
  ["SELECT 1; /* trailing block */", false],
  ["SELECT 1;;  ;", false],
  ["SELECT 1;\n-- done\n/* really done */", false],
  ["SELECT 1 /* unterminated ; comment", false],

  // Multiple statements — must be rejected
  ["SELECT 1; SELECT 2", true],
  ["SELECT 1;SELECT 2", true],
  ["INSERT INTO t VALUES ('a;b'); DELETE FROM t", true],
  ["SELECT 1; -- hide\nDROP TABLE users", true],
  ["SELECT 1; 'second statement starting with a string'", true],
  ['SELECT 1; "ident"', true],
];

let failures = 0;
for (const [sql, want] of cases) {
  const got = hasMultipleStatements(sql);
  if (got !== want) {
    failures++;
    console.error(`FAIL ${JSON.stringify(sql)} → got ${got}, want ${want}`);
  }
}

if (failures) {
  console.error(`\n${failures}/${cases.length} tests failed`);
  process.exit(1);
}
console.log(`All ${cases.length} tests passed`);

// --- Trimming: what actually gets sent to D1 ---
import { analyzeStatement } from "./worker.js";

const trimCases = [
  // [input, what D1 should receive]
  ["SELECT 1; -- test", "SELECT 1"],
  ["SELECT 1;", "SELECT 1"],
  ["SELECT 1; /* done */", "SELECT 1"],
  ["SELECT 1;;  ;", "SELECT 1"],
  ["SELECT 1", "SELECT 1"],
  ["SELECT 'a;b'; -- ok", "SELECT 'a;b'"],
  ["SELECT 1 -- no semicolon", "SELECT 1 -- no semicolon"],
];

let trimFailures = 0;
for (const [sql, want] of trimCases) {
  const a = analyzeStatement(sql);
  const got = a.end === null ? sql : sql.slice(0, a.end);
  if (a.multiple || got !== want) {
    trimFailures++;
    console.error(`FAIL trim ${JSON.stringify(sql)} → ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}

if (trimFailures) {
  console.error(`\n${trimFailures}/${trimCases.length} trim tests failed`);
  process.exit(1);
}
console.log(`All ${trimCases.length} trim tests passed`);
