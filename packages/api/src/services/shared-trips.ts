/**
 * Shared Trip Collaboration Service
 *
 * Manages distributed trip organization where multiple users share
 * a single trip with role-based access, merged timelines, and
 * expense visibility controls.
 *
 * Roles: owner, co-owner, editor, viewer
 * Expense types: shared (visible to all, split) or personal (owner-only)
 * Booking assignment: shared trips → own trips → create new
 *
 * Implements Requirement 28
 */

import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TripRole = 'owner' | 'co-owner' | 'editor' | 'viewer';

export interface TripMember {
  userId: string;
  email: string;
  displayName: string;
  role: TripRole;
  joinedAt: string;
  departed: boolean;
  departedAt: string | null;
}

export interface SharedTripBooking {
  id: string;
  ownerId: string;
  ownerName: string;
  type: 'flight' | 'hotel' | 'car_rental';
  summary: string;
  startDate: string | null;
  endDate: string | null;
  ownerDeparted: boolean;
  greyedOut: boolean; // true if owner departed and booking is in the future
}

export interface SharedExpense {
  id: string;
  payerId: string;
  payerName: string;
  amount: number;
  currency: string;
  category: string;
  merchantName: string | null;
  date: string;
  isShared: boolean;
  splitAmong: string[]; // user IDs
}

export interface MemberBalance {
  userId: string;
  displayName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class SharedTripService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Get a member's role in a trip.
   */
  async getMemberRole(tripId: string, userId: string): Promise<TripRole | null> {
    // Check if owner
    const trip = await this.db
      .selectFrom('trips')
      .select('owner_id')
      .where('id', '=', tripId)
      .executeTakeFirst();

    if (trip?.owner_id === userId) return 'owner';

    // Check member role
    const member = await this.db
      .selectFrom('trip_members')
      .select('access_level')
      .where('trip_id', '=', tripId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!member) return null;
    return member.access_level as TripRole;
  }

  /**
   * Check if a user can perform an action based on their role.
   */
  canPerformAction(role: TripRole | null, action: 'view' | 'edit' | 'manage' | 'delete'): boolean {
    if (!role) return false;

    switch (action) {
      case 'view':
        return true; // All roles can view
      case 'edit':
        return role !== 'viewer';
      case 'manage':
        return role === 'owner' || role === 'co-owner';
      case 'delete':
        return role === 'owner';
    }
  }

  /**
   * Assign co-owner role to a member.
   */
  async assignCoOwner(tripId: string, actingUserId: string, targetUserId: string): Promise<void> {
    const actingRole = await this.getMemberRole(tripId, actingUserId);
    if (!this.canPerformAction(actingRole, 'manage')) {
      throw new Error('Only owners and co-owners can assign roles');
    }

    await this.db
      .updateTable('trip_members')
      .set({ access_level: 'co-owner' })
      .where('trip_id', '=', tripId)
      .where('user_id', '=', targetUserId)
      .execute();
  }

  /**
   * Get all members of a shared trip with their roles and status.
   */
  async getTripMembers(tripId: string): Promise<TripMember[]> {
    const trip = await this.db
      .selectFrom('trips')
      .innerJoin('users', 'users.id', 'trips.owner_id')
      .select(['trips.owner_id', 'users.display_name', 'users.email', 'trips.created_at'])
      .where('trips.id', '=', tripId)
      .executeTakeFirst();

    const members: TripMember[] = [];

    // Add owner
    if (trip) {
      members.push({
        userId: trip.owner_id,
        email: trip.email,
        displayName: trip.display_name ?? 'Owner',
        role: 'owner',
        joinedAt: new Date(trip.created_at).toISOString(),
        departed: false,
        departedAt: null,
      });
    }

    // Add other members
    const tripMembers = await this.db
      .selectFrom('trip_members')
      .innerJoin('users', 'users.id', 'trip_members.user_id')
      .select([
        'trip_members.user_id',
        'users.email',
        'users.display_name',
        'trip_members.access_level',
        'trip_members.invited_at',
        'trip_members.departed',
        'trip_members.departed_at',
      ])
      .where('trip_members.trip_id', '=', tripId)
      .execute();

    for (const m of tripMembers) {
      members.push({
        userId: m.user_id!,
        email: m.email,
        displayName: m.display_name ?? 'Member',
        role: m.access_level as TripRole,
        joinedAt: new Date(m.invited_at).toISOString(),
        departed: m.departed ?? false,
        departedAt: m.departed_at ? new Date(m.departed_at).toISOString() : null,
      });
    }

    return members;
  }

  /**
   * Get merged timeline of all members' bookings for the shared trip.
   */
  async getMergedTimeline(tripId: string): Promise<SharedTripBooking[]> {
    const bookings = await this.db
      .selectFrom('bookings')
      .innerJoin('users', 'users.id', 'bookings.user_id')
      .leftJoin('trip_members', (join) =>
        join
          .onRef('trip_members.user_id', '=', 'bookings.user_id')
          .on('trip_members.trip_id', '=', tripId),
      )
      .select([
        'bookings.id',
        'bookings.user_id',
        'users.display_name',
        'bookings.type',
        'trip_members.departed',
      ])
      .where('bookings.trip_id', '=', tripId)
      .execute();

    const now = new Date();
    const result: SharedTripBooking[] = [];

    for (const b of bookings) {
      const departed = b.departed ?? false;
      // TODO: get actual dates from type-specific detail tables
      result.push({
        id: b.id,
        ownerId: b.user_id,
        ownerName: b.display_name ?? 'Unknown',
        type: b.type as 'flight' | 'hotel' | 'car_rental',
        summary: `${b.display_name}'s ${b.type}`,
        startDate: null, // populated from detail tables
        endDate: null,
        ownerDeparted: departed,
        greyedOut: departed, // Grey out if departed (refine with date check)
      });
    }

    return result;
  }

  /**
   * Handle member departure from a shared trip.
   * Bookings stay (greyed out), expenses remain for settlement.
   */
  async memberDepart(tripId: string, userId: string): Promise<void> {
    await this.db
      .updateTable('trip_members')
      .set({
        departed: true,
        departed_at: new Date(),
        access_level: 'viewer', // Downgrade to viewer on departure
      })
      .where('trip_id', '=', tripId)
      .where('user_id', '=', userId)
      .execute();

    // Log in activity feed
    await this.db
      .insertInto('activity_feed')
      .values({
        trip_id: tripId,
        user_id: userId,
        action: 'member_departed',
        entity_type: 'trip',
        entity_id: tripId,
      })
      .execute();
  }

  /**
   * Find shared trips for a user that match a booking (for auto-assignment).
   * Priority: shared trips first, then own trips.
   */
  async findSharedTripsForBooking(
    userId: string,
    bookingStart: string | null,
    bookingDestination: string | null,
  ): Promise<Array<{ tripId: string; tripName: string; matchType: string; isShared: boolean }>> {
    const matches: Array<{ tripId: string; tripName: string; matchType: string; isShared: boolean }> = [];

    // Get all shared trips where user is a member
    const sharedTripIds = await this.db
      .selectFrom('trip_members')
      .select('trip_id')
      .where('user_id', '=', userId)
      .where('departed', '=', false)
      .execute();

    const sharedTrips = sharedTripIds.length > 0
      ? await this.db
          .selectFrom('trips')
          .select(['id', 'name', 'start_date', 'end_date'])
          .where('id', 'in', sharedTripIds.map((t) => t.trip_id))
          .execute()
      : [];

    // Get own trips
    const ownTrips = await this.db
      .selectFrom('trips')
      .select(['id', 'name', 'start_date', 'end_date'])
      .where('owner_id', '=', userId)
      .execute();

    // Check shared trips first (priority)
    for (const trip of sharedTrips) {
      const match = matchTripToBooking(trip, bookingStart, bookingDestination);
      if (match) {
        matches.push({ tripId: trip.id, tripName: trip.name, matchType: match, isShared: true });
      }
    }

    // Then own trips
    for (const trip of ownTrips) {
      // Skip if already matched as shared
      if (matches.some((m) => m.tripId === trip.id)) continue;

      const match = matchTripToBooking(trip, bookingStart, bookingDestination);
      if (match) {
        matches.push({ tripId: trip.id, tripName: trip.name, matchType: match, isShared: false });
      }
    }

    return matches;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchTripToBooking(
  trip: { start_date: string | null; end_date: string | null; name: string },
  bookingStart: string | null,
  bookingDestination: string | null,
): string | null {
  // Date overlap check
  if (bookingStart && trip.start_date && trip.end_date) {
    const bStart = new Date(bookingStart);
    const tStart = new Date(trip.start_date);
    const tEnd = new Date(trip.end_date);
    const buffer = 24 * 60 * 60 * 1000;

    if (bStart >= new Date(tStart.getTime() - buffer) &&
        bStart <= new Date(tEnd.getTime() + buffer)) {
      return 'date_overlap';
    }
  }

  // Destination match
  if (bookingDestination) {
    const destLower = bookingDestination.toLowerCase();
    const nameLower = trip.name.toLowerCase();
    if (nameLower.includes(destLower) || destLower.includes(nameLower)) {
      return 'destination_match';
    }
  }

  return null;
}
