import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/**
 * Kysely database interface defining all tables and their column types.
 */
export interface Database {
  users: UsersTable;
  user_preferences: UserPreferencesTable;
  trips: TripsTable;
  trip_members: TripMembersTable;
  bookings: BookingsTable;
  flight_details: FlightDetailsTable;
  hotel_details: HotelDetailsTable;
  car_rental_details: CarRentalDetailsTable;
  favorites: FavoritesTable;
  collections: CollectionsTable;
  favorite_collections: FavoriteCollectionsTable;
  timeline_events: TimelineEventsTable;
  votes: VotesTable;
  expenses: ExpensesTable;
  expense_groups: ExpenseGroupsTable;
  group_members: GroupMembersTable;
  expense_splits: ExpenseSplitsTable;
  expense_split_members: ExpenseSplitMembersTable;
  split_preferences: SplitPreferencesTable;
  settlements: SettlementsTable;
  documents: DocumentsTable;
  scheduled_notifications: ScheduledNotificationsTable;
  notification_preferences: NotificationPreferencesTable;
  gap_alerts: GapAlertsTable;
  activity_feed: ActivityFeedTable;
  share_links: ShareLinksTable;
  highlights: HighlightsTable;
  email_connections: EmailConnectionsTable;
  source_attachments: SourceAttachmentsTable;
  supported_languages: SupportedLanguagesTable;
  supported_currencies: SupportedCurrenciesTable;
  locale_configs: LocaleConfigsTable;
  translation_keys: TranslationKeysTable;
  translations: TranslationsTable;
}

// --- Users ---

export interface UsersTable {
  id: Generated<string>;
  email: string;
  cognito_sub: string;
  display_name: string;
  avatar_url: string | null;
  email_verified: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

// --- User Preferences ---

export interface UserPreferencesTable {
  user_id: string;
  interests: Generated<string[]>;
  dietary_preferences: Generated<string[]>;
  allergies: Generated<string[]>;
  language: Generated<string>;
  display_currencies: Generated<string[]>;
  locale_code: string | null;
  date_format_override: string | null;
  time_format_override: string | null;
  number_format_override: string | null;
  units: string | null;
  updated_at: Generated<Date>;
}

export type UserPreference = Selectable<UserPreferencesTable>;
export type NewUserPreference = Insertable<UserPreferencesTable>;
export type UserPreferenceUpdate = Updateable<UserPreferencesTable>;

// --- Trips ---

export interface TripsTable {
  id: Generated<string>;
  owner_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  budget: ColumnType<string | null, string | null, string | null>;
  budget_currency: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Trip = Selectable<TripsTable>;
export type NewTrip = Insertable<TripsTable>;
export type TripUpdate = Updateable<TripsTable>;

// --- Trip Members ---

export interface TripMembersTable {
  id: Generated<string>;
  trip_id: string;
  user_id: string | null;
  email: string | null;
  access_level: 'view' | 'edit';
  invited_at: Generated<Date>;
  accepted_at: Date | null;
}

export type TripMember = Selectable<TripMembersTable>;
export type NewTripMember = Insertable<TripMembersTable>;
export type TripMemberUpdate = Updateable<TripMembersTable>;

// --- Bookings ---

export interface BookingsTable {
  id: Generated<string>;
  user_id: string;
  trip_id: string | null;
  type: 'flight' | 'hotel' | 'car_rental';
  source: Generated<'email' | 'manual'>;
  source_email_id: string | null;
  source_attachment_id: string | null;
  checked_in: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Booking = Selectable<BookingsTable>;
export type NewBooking = Insertable<BookingsTable>;
export type BookingUpdate = Updateable<BookingsTable>;

// --- Flight Details ---

export interface FlightDetailsTable {
  booking_id: string;
  airline: string | null;
  flight_number: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  departure_time: Date | null;
  arrival_time: Date | null;
  departure_lat: ColumnType<string | null, string | null, string | null>;
  departure_lng: ColumnType<string | null, string | null, string | null>;
  arrival_lat: ColumnType<string | null, string | null, string | null>;
  arrival_lng: ColumnType<string | null, string | null, string | null>;
  checkin_window_opens: Date | null;
  checkin_window_closes: Date | null;
  confirmation_number: string | null;
  seat: string | null;
  terminal: string | null;
  gate: string | null;
  baggage_allowance: string | null;
  cabin_class: string | null;
  traveller_names: string | null; // JSON array
  notes: string | null;
  price: ColumnType<string | null, string | null, string | null>;
  currency: string | null;
}

export type FlightDetail = Selectable<FlightDetailsTable>;
export type NewFlightDetail = Insertable<FlightDetailsTable>;
export type FlightDetailUpdate = Updateable<FlightDetailsTable>;

// --- Hotel Details ---

export interface HotelDetailsTable {
  booking_id: string;
  hotel_name: string | null;
  address: string | null;
  checkin_date: string | null;
  checkout_date: string | null;
  latitude: ColumnType<string | null, string | null, string | null>;
  longitude: ColumnType<string | null, string | null, string | null>;
  confirmation_number: string | null;
  room_type: string | null;
  number_of_guests: number | null;
  contact_phone: string | null;
  traveller_names: string | null; // JSON array
  notes: string | null;
  price_per_night: ColumnType<string | null, string | null, string | null>;
  total_price: ColumnType<string | null, string | null, string | null>;
  currency: string | null;
}

export type HotelDetail = Selectable<HotelDetailsTable>;
export type NewHotelDetail = Insertable<HotelDetailsTable>;
export type HotelDetailUpdate = Updateable<HotelDetailsTable>;

// --- Car Rental Details ---

export interface CarRentalDetailsTable {
  booking_id: string;
  company: string | null;
  vehicle_type: string | null;
  pickup_location: string | null;
  return_location: string | null;
  pickup_time: Date | null;
  return_time: Date | null;
  pickup_lat: ColumnType<string | null, string | null, string | null>;
  pickup_lng: ColumnType<string | null, string | null, string | null>;
  return_lat: ColumnType<string | null, string | null, string | null>;
  return_lng: ColumnType<string | null, string | null, string | null>;
  confirmation_number: string | null;
  vehicle_class: string | null;
  driver_names: string | null; // JSON array
  insurance: string | null;
  fuel_policy: string | null;
  extras: string | null; // JSON array
  notes: string | null;
  total_price: ColumnType<string | null, string | null, string | null>;
  currency: string | null;
  pickup_latitude: ColumnType<string | null, string | null, string | null>;
  pickup_longitude: ColumnType<string | null, string | null, string | null>;
}

export type CarRentalDetail = Selectable<CarRentalDetailsTable>;
export type NewCarRentalDetail = Insertable<CarRentalDetailsTable>;
export type CarRentalDetailUpdate = Updateable<CarRentalDetailsTable>;


// --- Favorites ---

export interface FavoritesTable {
  id: Generated<string>;
  user_id: string;
  trip_id: string | null;
  name: string;
  category: string | null;
  place_id: string | null;
  location_lat: ColumnType<string | null, string | null, string | null>;
  location_lng: ColumnType<string | null, string | null, string | null>;
  rating: ColumnType<string | null, string | null, string | null>;
  notes: string | null;
  added_by: string | null;
  created_at: Generated<Date>;
}

export type Favorite = Selectable<FavoritesTable>;
export type NewFavorite = Insertable<FavoritesTable>;
export type FavoriteUpdate = Updateable<FavoritesTable>;

// --- Collections ---

export interface CollectionsTable {
  id: Generated<string>;
  user_id: string;
  name: string;
  created_at: Generated<Date>;
}

export type Collection = Selectable<CollectionsTable>;
export type NewCollection = Insertable<CollectionsTable>;
export type CollectionUpdate = Updateable<CollectionsTable>;

// --- Favorite Collections (junction table) ---

export interface FavoriteCollectionsTable {
  favorite_id: string;
  collection_id: string;
}

export type FavoriteCollection = Selectable<FavoriteCollectionsTable>;
export type NewFavoriteCollection = Insertable<FavoriteCollectionsTable>;

// --- Timeline Events ---

export interface TimelineEventsTable {
  id: Generated<string>;
  trip_id: string;
  title: string;
  event_time: Date | null;
  all_day: Generated<boolean>;
  location: string | null;
  notes: string | null;
  event_type: 'booking' | 'favorite' | 'custom';
  reference_id: string | null;
  added_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type TimelineEvent = Selectable<TimelineEventsTable>;
export type NewTimelineEvent = Insertable<TimelineEventsTable>;
export type TimelineEventUpdate = Updateable<TimelineEventsTable>;

// --- Votes ---

export interface VotesTable {
  id: Generated<string>;
  trip_id: string;
  user_id: string;
  entity_type: 'favorite' | 'timeline_event';
  entity_id: string;
  vote_value: number;
  created_at: Generated<Date>;
}

export type Vote = Selectable<VotesTable>;
export type NewVote = Insertable<VotesTable>;
export type VoteUpdate = Updateable<VotesTable>;

// --- Expenses ---

export interface ExpensesTable {
  id: Generated<string>;
  user_id: string;
  trip_id: string | null;
  booking_id: string | null;
  amount: ColumnType<string, string, string>;
  currency: string;
  converted_amount: ColumnType<string | null, string | null, string | null>;
  converted_currency: string | null;
  date: string;
  category:
    | 'accommodation'
    | 'transportation'
    | 'food_dining'
    | 'shopping'
    | 'tours_activities'
    | 'entertainment'
    | 'other';
  merchant_name: string | null;
  notes: string | null;
  receipt_document_id: string | null;
  source_attachment_id: string | null;
  payer_id: string | null;
  is_shared: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Expense = Selectable<ExpensesTable>;
export type NewExpense = Insertable<ExpensesTable>;
export type ExpenseUpdate = Updateable<ExpensesTable>;

// --- Expense Groups ---

export interface ExpenseGroupsTable {
  id: Generated<string>;
  trip_id: string;
  name: string;
  created_by: string;
  created_at: Generated<Date>;
}

export type ExpenseGroup = Selectable<ExpenseGroupsTable>;
export type NewExpenseGroup = Insertable<ExpenseGroupsTable>;
export type ExpenseGroupUpdate = Updateable<ExpenseGroupsTable>;

// --- Group Members ---

export interface GroupMembersTable {
  id: Generated<string>;
  group_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  created_at: Generated<Date>;
}

export type GroupMember = Selectable<GroupMembersTable>;
export type NewGroupMember = Insertable<GroupMembersTable>;
export type GroupMemberUpdate = Updateable<GroupMembersTable>;

// --- Expense Splits ---

export interface ExpenseSplitsTable {
  id: Generated<string>;
  expense_id: string;
  group_id: string;
  split_type: 'equal' | 'percentage' | 'per_item';
  created_at: Generated<Date>;
}

export type ExpenseSplit = Selectable<ExpenseSplitsTable>;
export type NewExpenseSplit = Insertable<ExpenseSplitsTable>;
export type ExpenseSplitUpdate = Updateable<ExpenseSplitsTable>;

// --- Settlements ---

export interface SettlementsTable {
  id: Generated<string>;
  group_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: ColumnType<string, string, string>;
  currency: string;
  settled: Generated<boolean>;
  settled_at: Date | null;
  amount_paid: ColumnType<string, string, string>;
  notes: string | null;
  created_at: Generated<Date>;
}

export type Settlement = Selectable<SettlementsTable>;
export type NewSettlement = Insertable<SettlementsTable>;
export type SettlementUpdate = Updateable<SettlementsTable>;

// --- Expense Split Members ---

export interface ExpenseSplitMembersTable {
  id: Generated<string>;
  expense_id: string;
  member_id: string;
  split_type: 'equal' | 'percentage' | 'per_item';
  percentage: ColumnType<string | null, string | null, string | null>;
  amount: ColumnType<string | null, string | null, string | null>;
  items: string | null; // JSON array
  created_at: Generated<Date>;
}

export type ExpenseSplitMember = Selectable<ExpenseSplitMembersTable>;
export type NewExpenseSplitMember = Insertable<ExpenseSplitMembersTable>;
export type ExpenseSplitMemberUpdate = Updateable<ExpenseSplitMembersTable>;

// --- Split Preferences ---

export interface SplitPreferencesTable {
  id: Generated<string>;
  user_id: string;
  trip_id: string;
  default_split_type: Generated<string>;
  default_included_members: string | null; // JSON array of member_ids
  updated_at: Generated<Date>;
}

export type SplitPreference = Selectable<SplitPreferencesTable>;
export type NewSplitPreference = Insertable<SplitPreferencesTable>;
export type SplitPreferenceUpdate = Updateable<SplitPreferencesTable>;

// --- Documents ---

export interface DocumentsTable {
  id: Generated<string>;
  user_id: string;
  trip_id: string | null;
  booking_id: string | null;
  category: 'boarding_pass' | 'confirmation' | 'voucher' | 'visa' | 'insurance';
  file_name: string;
  file_size: number;
  mime_type: string;
  s3_key: string;
  created_at: Generated<Date>;
}

export type Document = Selectable<DocumentsTable>;
export type NewDocument = Insertable<DocumentsTable>;
export type DocumentUpdate = Updateable<DocumentsTable>;

// --- Scheduled Notifications ---

export interface ScheduledNotificationsTable {
  id: Generated<string>;
  user_id: string;
  booking_id: string | null;
  type: string;
  fire_at: Date;
  payload: Generated<Record<string, unknown>>;
  delivered: Generated<boolean>;
  delivered_at: Date | null;
  created_at: Generated<Date>;
}

export type ScheduledNotification = Selectable<ScheduledNotificationsTable>;
export type NewScheduledNotification = Insertable<ScheduledNotificationsTable>;
export type ScheduledNotificationUpdate = Updateable<ScheduledNotificationsTable>;

// --- Notification Preferences ---

export interface NotificationPreferencesTable {
  user_id: string;
  flight_reminder_offset: Generated<number>;
  hotel_reminder_time: Generated<string>;
  car_reminder_offset: Generated<number>;
  push_enabled: Generated<boolean>;
  email_enabled: Generated<boolean>;
  updated_at: Generated<Date>;
}

export type NotificationPreference = Selectable<NotificationPreferencesTable>;
export type NewNotificationPreference = Insertable<NotificationPreferencesTable>;
export type NotificationPreferenceUpdate = Updateable<NotificationPreferencesTable>;

// --- Gap Alerts ---

export interface GapAlertsTable {
  id: Generated<string>;
  trip_id: string;
  type: 'missing_accommodation' | 'missing_transportation' | 'scheduling_conflict';
  date: string;
  description: string;
  suggested_action: string | null;
  dismissed: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type GapAlert = Selectable<GapAlertsTable>;
export type NewGapAlert = Insertable<GapAlertsTable>;
export type GapAlertUpdate = Updateable<GapAlertsTable>;

// --- Activity Feed ---

export interface ActivityFeedTable {
  id: Generated<string>;
  trip_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Generated<Record<string, unknown>>;
  created_at: Generated<Date>;
}

export type ActivityFeedEntry = Selectable<ActivityFeedTable>;
export type NewActivityFeedEntry = Insertable<ActivityFeedTable>;

// --- Share Links ---

export interface ShareLinksTable {
  id: Generated<string>;
  trip_id: string;
  token: string;
  expires_at: Date;
  created_by: string;
  created_at: Generated<Date>;
}

export type ShareLink = Selectable<ShareLinksTable>;
export type NewShareLink = Insertable<ShareLinksTable>;

// --- Highlights (Social Sharing) ---

export interface HighlightsTable {
  id: Generated<string>;
  trip_id: string;
  user_id: string;
  caption: string | null;
  layout: 'single' | 'carousel' | 'collage';
  photo_ids: Generated<string[]>;
  tag_trip_name: Generated<boolean>;
  tag_destinations: Generated<boolean>;
  include_stats: Generated<boolean>;
  is_draft: Generated<boolean>;
  shared_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Highlight = Selectable<HighlightsTable>;
export type NewHighlight = Insertable<HighlightsTable>;
export type HighlightUpdate = Updateable<HighlightsTable>;

// --- Email Connections ---

export interface EmailConnectionsTable {
  id: Generated<string>;
  user_id: string;
  provider: 'gmail' | 'outlook';
  email_address: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: Date | null;
  last_sync_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type EmailConnection = Selectable<EmailConnectionsTable>;
export type NewEmailConnection = Insertable<EmailConnectionsTable>;
export type EmailConnectionUpdate = Updateable<EmailConnectionsTable>;

// --- Source Attachments ---

export interface SourceAttachmentsTable {
  id: Generated<string>;
  user_id: string;
  entity_type: string; // 'booking' or 'expense'
  entity_id: string;
  source_type: string; // email, receipt_scan, pdf, manual, forwarded
  s3_key: string | null;
  s3_bucket: string | null;
  mime_type: string | null;
  file_size: number | null;
  email_provider: string | null;
  email_message_id: string | null;
  email_subject: string | null;
  email_from: string | null;
  email_date: Date | null;
  sanitized: Generated<boolean>;
  retention_policy: Generated<string>;
  expires_at: Date | null;
  created_at: Generated<Date>;
}

export type SourceAttachment = Selectable<SourceAttachmentsTable>;
export type NewSourceAttachment = Insertable<SourceAttachmentsTable>;
export type SourceAttachmentUpdate = Updateable<SourceAttachmentsTable>;

// --- Supported Languages ---

export interface SupportedLanguagesTable {
  id: Generated<string>;
  code: string;
  name: string;
  native_name: string;
  enabled: Generated<boolean>;
  rtl: Generated<boolean>;
  translation_coverage: Generated<number>;
  auto_translated: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type SupportedLanguage = Selectable<SupportedLanguagesTable>;

// --- Supported Currencies ---

export interface SupportedCurrenciesTable {
  id: Generated<string>;
  code: string;
  name: string;
  symbol: string;
  decimal_places: Generated<number>;
  enabled: Generated<boolean>;
  display_order: Generated<number>;
  created_at: Generated<Date>;
}

export type SupportedCurrency = Selectable<SupportedCurrenciesTable>;

// --- Locale Configs ---

export interface LocaleConfigsTable {
  id: Generated<string>;
  code: string;
  name: string;
  language_code: string;
  date_format: string;
  time_format: string;
  number_format: string;
  default_currency: string;
  units: Generated<string>;
  enabled: Generated<boolean>;
  created_at: Generated<Date>;
}

export type LocaleConfig = Selectable<LocaleConfigsTable>;

// --- Translation Keys ---

export interface TranslationKeysTable {
  id: Generated<string>;
  key: string;
  namespace: string;
  english_text: string;
  context: string | null;
  created_at: Generated<Date>;
}

export type TranslationKey = Selectable<TranslationKeysTable>;

// --- Translations ---

export interface TranslationsTable {
  id: Generated<string>;
  key_id: string;
  language_code: string;
  text: string;
  is_auto: Generated<boolean>;
  is_reviewed: Generated<boolean>;
  last_edited_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Translation = Selectable<TranslationsTable>;
