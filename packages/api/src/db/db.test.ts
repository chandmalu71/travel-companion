import { describe, it, expect } from 'vitest';
import { createDatabase, createMigrator } from './index.js';
import * as migration001 from './migrations/001_core_tables.js';
import * as migration002 from './migrations/002_supporting_tables.js';

describe('Database module', () => {
  it('exports createDatabase function', () => {
    expect(createDatabase).toBeDefined();
    expect(typeof createDatabase).toBe('function');
  });

  it('exports createMigrator function', () => {
    expect(createMigrator).toBeDefined();
    expect(typeof createMigrator).toBe('function');
  });
});

describe('Migration 001 - Core Tables', () => {
  it('exports up and down functions', () => {
    expect(migration001.up).toBeDefined();
    expect(typeof migration001.up).toBe('function');
    expect(migration001.down).toBeDefined();
    expect(typeof migration001.down).toBe('function');
  });
});

describe('Migration 002 - Supporting Tables', () => {
  it('exports up and down functions', () => {
    expect(migration002.up).toBeDefined();
    expect(typeof migration002.up).toBe('function');
    expect(migration002.down).toBeDefined();
    expect(typeof migration002.down).toBe('function');
  });
});
