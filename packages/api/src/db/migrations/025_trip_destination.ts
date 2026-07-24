import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('trips')
    .addColumn('destination', 'varchar(200)')
    .execute();

  // Index for searching by destination
  await sql`CREATE INDEX idx_trips_destination ON trips (destination) WHERE destination IS NOT NULL`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_trips_destination`.execute(db);

  await db.schema
    .alterTable('trips')
    .dropColumn('destination')
    .execute();
}
