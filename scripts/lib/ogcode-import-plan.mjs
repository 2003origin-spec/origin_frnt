/**
 * Pure planning for scripts/import-ogcode-questions.mjs: which ogcode_questions
 * rows the bank import owns, and which source_index each bank row gets.
 *
 * ogcode_questions also holds rows the bank files cannot recreate:
 *   - teacher-contributed questions (is_contributed, synced at publish time);
 *   - contest-import questions (is_contest_import), referenced by contest papers.
 * The import must never delete or overwrite those.
 *
 * source_index is UNIQUE. Contributed rows take MAX(source_index)+1, so they sit
 * right after the bank. Numbering the bank 1..N again on re-import collides with
 * them as soon as the bank grows, and the whole import rolls back. Bank rows are
 * therefore numbered in bank order with every index held by a row the import
 * does not touch skipped, and bank rows already in the table are first parked on
 * unused negative indices so they can be renumbered in any order.
 */

/** Ids the importer mints: `ogcode_<code>_<NNNN>`, code from subjectCodeFromSubject (+ `nf_`). */
export const BANK_ID_PATTERN = /^ogcode_(?:nf_)?(?:phy|chem|math|bio|gen)_\d{4,}$/u;

/**
 * @typedef {{ id: string, source_index: number, is_contributed?: boolean | null, is_contest_import?: boolean | null }} ExistingRow
 */

/** @param {ExistingRow} row */
export function isBankOwnedRow(row) {
  return !row.is_contributed && !row.is_contest_import && BANK_ID_PATTERN.test(row.id);
}

/**
 * @param {{ incomingIds: readonly string[], existingRows: readonly ExistingRow[], replace: boolean }} input
 * @returns {{
 *   sourceIndexById: Map<string, number>,
 *   protectedIds: string[],
 *   staleOwnedIds: string[],
 *   parking: { id: string, source_index: number }[],
 * }}
 *   sourceIndexById — final index for every incoming row that will be written;
 *   protectedIds    — incoming ids that already belong to a non-bank row (skipped, never overwritten);
 *   staleOwnedIds   — bank rows no longer in the bank (deleted only with --replace, else kept in place);
 *   parking         — temporary negative indices for bank rows about to be renumbered.
 */
export function planBankImport({ incomingIds, existingRows, replace }) {
  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  const incoming = new Set(incomingIds);
  if (incoming.size !== incomingIds.length) {
    throw new Error("Duplicate ids in the OGCode import set.");
  }

  const protectedIds = [];
  const parking = [];
  const reserved = new Set();
  const staleOwnedIds = [];

  let lowest = 0;
  for (const row of existingRows) lowest = Math.min(lowest, row.source_index);
  let nextParking = lowest - 1;

  for (const row of existingRows) {
    const owned = isBankOwnedRow(row);
    if (!owned) {
      reserved.add(row.source_index);
      continue;
    }
    if (incoming.has(row.id)) {
      parking.push({ id: row.id, source_index: nextParking });
      nextParking -= 1;
      continue;
    }
    staleOwnedIds.push(row.id);
    if (!replace) reserved.add(row.source_index);
  }

  const sourceIndexById = new Map();
  let candidate = 1;
  for (const id of incomingIds) {
    const existing = existingById.get(id);
    if (existing && !isBankOwnedRow(existing)) {
      protectedIds.push(id);
      continue;
    }
    while (reserved.has(candidate)) candidate += 1;
    sourceIndexById.set(id, candidate);
    candidate += 1;
  }

  return { sourceIndexById, protectedIds, staleOwnedIds, parking };
}
