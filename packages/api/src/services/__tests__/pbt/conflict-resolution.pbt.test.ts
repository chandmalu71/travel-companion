import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveConflict, type ChangeEntry } from '../../../routes/sync.js';

/**
 * Feature: travel-companion, Property 16: Conflict Resolution (Last Write Wins)
 *
 * For any pair of conflicting changes (local vs server) with timestamps,
 * the sync engine SHALL resolve using last-write-wins: the change with the
 * later timestamp wins. On equal timestamps, the server version wins.
 * Both versions are always preserved in the conflict entry.
 *
 * **Validates: Requirements 17.7, 13.5**
 */

// ─── Generators ──────────────────────────────────────────────────────────────

const entityType = fc.constantFrom(
  'trips',
  'bookings',
  'favorites',
  'timeline_events',
  'votes',
  'expenses',
  'documents',
);

const entityId = fc.uuid();

const operation = fc.constantFrom('create', 'update', 'delete') as fc.Arbitrary<
  'create' | 'update' | 'delete'
>;

const dataPayload = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
) as fc.Arbitrary<Record<string, unknown>>;

/** Generate a valid ISO 8601 timestamp within a reasonable range (using integer ms). */
const isoTimestamp = fc
  .integer({
    min: new Date('2020-01-01T00:00:00Z').getTime(),
    max: new Date('2030-12-31T23:59:59Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

/** Generate a ChangeEntry with a specific entityType and entityId for controlled conflicts. */
const changeEntry = (entType: string, entId: string): fc.Arbitrary<ChangeEntry> =>
  fc.record({
    entityType: fc.constant(entType),
    entityId: fc.constant(entId),
    operation,
    data: dataPayload,
    localTimestamp: isoTimestamp,
  });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 16: Conflict Resolution (Last Write Wins)', () => {
  it('the change with the later timestamp always wins', () => {
    fc.assert(
      fc.property(
        entityType,
        entityId,
        operation,
        operation,
        dataPayload,
        dataPayload,
        isoTimestamp,
        isoTimestamp,
        (entType, entId, localOp, serverOp, localData, serverData, ts1, ts2) => {
          // Ensure timestamps are different (later one should win)
          const earlier = ts1 < ts2 ? ts1 : ts2;
          const later = ts1 < ts2 ? ts2 : ts1;

          // Skip if timestamps are equal (separate property test)
          fc.pre(ts1 !== ts2);

          const localChange: ChangeEntry = {
            entityType: entType,
            entityId: entId,
            operation: localOp,
            data: localData,
            localTimestamp: later, // local has later timestamp
          };

          const serverChange: ChangeEntry = {
            entityType: entType,
            entityId: entId,
            operation: serverOp,
            data: serverData,
            localTimestamp: earlier, // server has earlier timestamp
          };

          const result = resolveConflict(localChange, serverChange);

          // Local has later timestamp, so local should win
          expect(result.resolvedVersion).toEqual(localData);

          // Now flip: server has later timestamp
          const localChange2: ChangeEntry = {
            entityType: entType,
            entityId: entId,
            operation: localOp,
            data: localData,
            localTimestamp: earlier,
          };

          const serverChange2: ChangeEntry = {
            entityType: entType,
            entityId: entId,
            operation: serverOp,
            data: serverData,
            localTimestamp: later,
          };

          const result2 = resolveConflict(localChange2, serverChange2);

          // Server has later timestamp, so server should win
          expect(result2.resolvedVersion).toEqual(serverData);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('on equal timestamps, server version wins', () => {
    fc.assert(
      fc.property(
        entityType,
        entityId,
        operation,
        operation,
        dataPayload,
        dataPayload,
        isoTimestamp,
        (entType, entId, localOp, serverOp, localData, serverData, timestamp) => {
          const localChange: ChangeEntry = {
            entityType: entType,
            entityId: entId,
            operation: localOp,
            data: localData,
            localTimestamp: timestamp, // same timestamp
          };

          const serverChange: ChangeEntry = {
            entityType: entType,
            entityId: entId,
            operation: serverOp,
            data: serverData,
            localTimestamp: timestamp, // same timestamp
          };

          const result = resolveConflict(localChange, serverChange);

          // On tie, server wins (serverTime >= localTime → server data chosen)
          expect(result.resolvedVersion).toEqual(serverData);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('both local and server versions are always preserved in the conflict entry', () => {
    fc.assert(
      fc.property(
        entityType,
        entityId,
        changeEntry('trips', 'fixed-id'),
        changeEntry('trips', 'fixed-id'),
        (entType, entId, localBase, serverBase) => {
          const localChange: ChangeEntry = { ...localBase, entityType: entType, entityId: entId };
          const serverChange: ChangeEntry = { ...serverBase, entityType: entType, entityId: entId };

          const result = resolveConflict(localChange, serverChange);

          // Both versions must be preserved
          expect(result.localVersion).toEqual(localChange.data);
          expect(result.serverVersion).toEqual(serverChange.data);
          expect(result.entityType).toBe(entType);
          expect(result.entityId).toBe(entId);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('the resolved version equals either the local or server version (never a merge)', () => {
    fc.assert(
      fc.property(
        entityType,
        entityId,
        changeEntry('trips', 'fixed-id'),
        changeEntry('trips', 'fixed-id'),
        (entType, entId, localBase, serverBase) => {
          const localChange: ChangeEntry = { ...localBase, entityType: entType, entityId: entId };
          const serverChange: ChangeEntry = { ...serverBase, entityType: entType, entityId: entId };

          const result = resolveConflict(localChange, serverChange);

          // Resolved version must be exactly one of the two — no merge
          const isLocalVersion =
            JSON.stringify(result.resolvedVersion) === JSON.stringify(localChange.data);
          const isServerVersion =
            JSON.stringify(result.resolvedVersion) === JSON.stringify(serverChange.data);

          expect(isLocalVersion || isServerVersion).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});
