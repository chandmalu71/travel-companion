# Requirements Document

## Introduction

Travel Companion is a cross-platform application (web and mobile iOS/Android) that aggregates travel booking information into a unified view, provides AI-powered activity discovery, and enables collaborative trip planning. The application connects to user email inboxes or accepts forwarded confirmation emails to automatically extract itinerary details, organizes trips with timeline and map views, and supports offline access, multi-currency display, weather forecasts, document storage, and sharing capabilities.

## Glossary

- **Application**: The Travel Companion system across all platforms (web, iOS, Android)
- **Trip**: A named collection of bookings, favorites, and points of interest grouped together by the user
- **Booking**: A confirmed reservation for a flight, hotel, or car rental
- **Itinerary_Extractor**: The subsystem responsible for parsing emails and extracting booking details
- **POI_Engine**: The subsystem that discovers and presents points of interest near destinations
- **AI_Search**: The AI-powered search subsystem that finds activities, restaurants, museums, outdoor activities, and events with personalization
- **Timeline_View**: The interface component displaying trip events in chronological order
- **Map_View**: The interface component displaying bookings and points of interest on a geographic map
- **Notification_Service**: The subsystem responsible for sending reminders and alerts to users
- **Document_Store**: The subsystem managing attached files such as boarding passes, confirmations, and vouchers
- **Sync_Engine**: The subsystem responsible for caching data locally and synchronizing with the server
- **Currency_Service**: The subsystem that converts and displays monetary amounts in multiple currencies
- **Weather_Service**: The subsystem that retrieves weather forecast data for destinations
- **Sharing_Service**: The subsystem enabling trip sharing and collaborative planning among multiple users
- **Expense_Tracker**: The subsystem responsible for recording, categorizing, and summarizing travel expenses
- **Receipt_Scanner**: The AI-powered subsystem that extracts expense details from photographed or uploaded receipts
- **Auth_Service**: The subsystem managing user registration, login, and session management
- **Checkin_Service**: The subsystem responsible for initiating and tracking airline check-in for flight bookings
- **User**: A registered person who uses the Application
- **Collaborator**: A User who has been granted access to contribute to another User's Trip
- **Home_Currency**: One or more preferred currencies the User selects for cost display; the first currency in the list is used as the default
- **Preference_Engine**: The subsystem responsible for storing and applying user preferences (interests, dietary restrictions, allergies, locale, and currency settings) across the Application
- **Local_Currency**: The currency used at the travel destination
- **Expense_Splitter**: The subsystem responsible for splitting expenses among group members, supporting percentage-based and per-item allocation
- **Gap_Detector**: The subsystem responsible for analyzing trip itineraries to identify missing elements such as unbooked accommodations, transportation gaps, and scheduling conflicts
- **Social_Sharing**: The subsystem enabling users to share trip highlights to social media platforms with curated photos and captions

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to create an account and log in securely, so that my travel data is private and accessible across devices.

#### Acceptance Criteria

1. THE Auth_Service SHALL allow users to register with a valid email address and a password between 8 and 128 characters containing at least one uppercase letter, one lowercase letter, and one digit
2. THE Auth_Service SHALL support authentication via OAuth providers (Google, Facebook, Yahoo, Amazon)
3. WHEN a User logs in successfully, THE Auth_Service SHALL establish an authenticated session that remains valid for 30 days of inactivity and is accessible across web and mobile platforms
4. IF a login attempt fails three consecutive times without an intervening successful login, THEN THE Auth_Service SHALL temporarily lock the account for 15 minutes and display a message indicating the lock duration and reason
5. WHEN a User requests a password reset, THE Auth_Service SHALL send a reset link to the registered email within 60 seconds, and the link SHALL expire after 24 hours
6. IF a User attempts to register with an email address already associated with an existing account, THEN THE Auth_Service SHALL reject the registration and indicate that the email is already in use
7. WHEN a User completes registration, THE Auth_Service SHALL send a verification email, and THE Auth_Service SHALL require email verification before granting full account access
8. IF a User submits a registration form with an invalid email format or a password that does not meet the stated requirements, THEN THE Auth_Service SHALL reject the submission and indicate which fields failed validation
9. IF a User is already authenticated, THEN THE Application SHALL prevent the User from accessing the registration form

### Requirement 2: Email Integration for Booking Extraction

**User Story:** As a user, I want the app to automatically extract booking details from my emails, so that I don't have to manually enter travel information.

#### Acceptance Criteria

1. THE Itinerary_Extractor SHALL support direct inbox connection via Gmail API and Microsoft Outlook API
2. THE Itinerary_Extractor SHALL support extraction from emails forwarded to a dedicated application email address
3. WHEN a booking confirmation email is detected, THE Itinerary_Extractor SHALL extract flight details including airline, flight number, departure time, arrival time, departure airport, and arrival airport within 120 seconds of email receipt
4. WHEN a hotel confirmation email is detected, THE Itinerary_Extractor SHALL extract hotel name, check-in date, check-out date, and address within 120 seconds of email receipt
5. WHEN a car rental confirmation email is detected, THE Itinerary_Extractor SHALL extract rental company, pickup date, return date, pickup location, and return location within 120 seconds of email receipt
6. IF the Itinerary_Extractor cannot parse a confirmation email, THEN THE Itinerary_Extractor SHALL notify the User with an in-app indicator identifying the unparsed email and providing an option to manually enter booking details
7. WHEN a User connects a Gmail or Outlook inbox, THE Application SHALL scan emails received within the most recent 90 days, processing only booking confirmation emails without storing non-travel email content
8. IF the Itinerary_Extractor extracts a booking that matches an existing Booking by flight number and date, hotel name and dates, or rental company and dates, THEN THE Itinerary_Extractor SHALL discard the duplicate and not create a new entry
9. IF the Itinerary_Extractor extracts only a subset of required fields from a confirmation email, THEN THE Itinerary_Extractor SHALL create a partial Booking with available fields and flag the missing fields for the User to complete manually

### Requirement 3: Unified Booking Dashboard

**User Story:** As a user, I want to see all my bookings (flights, hotels, car rentals) in one view, so that I can quickly understand my travel plans.

#### Acceptance Criteria

1. THE Application SHALL display all bookings with a status of upcoming or in-progress in a single unified dashboard view, sorted by the earliest upcoming event date in ascending order
2. THE Application SHALL categorize bookings by type: flights, hotels, and car rentals
3. THE Application SHALL display booking status for each entry, determined as follows: a booking is "upcoming" if the current date-time is before the start date-time (departure, check-in, or pickup), "in-progress" if the current date-time is between the start and end date-time (arrival, check-out, or return), and "completed" if the current date-time is after the end date-time
4. WHEN a booking is updated via email, THE Application SHALL reflect the updated details within 5 minutes
5. THE Application SHALL allow Users to manually add bookings that were not extracted from email, requiring at minimum: booking type, and the type-specific fields defined for extracted bookings (airline, flight number, departure time, arrival time, departure airport, and arrival airport for flights; hotel name, check-in date, check-out date, and address for hotels; rental company, pickup date, return date, pickup location, and return location for car rentals)
6. THE Application SHALL allow Users to view completed bookings through a filter or separate section within the dashboard

### Requirement 4: Trip Organization

**User Story:** As a user, I want to group my bookings and saved places into named trips, so that I can organize my travel plans logically.

#### Acceptance Criteria

1. THE Application SHALL allow Users to create named Trips with a name between 1 and 100 characters
2. THE Application SHALL allow Users to assign Bookings to a Trip and to remove or reassign Bookings from one Trip to another
3. THE Application SHALL allow Users to assign saved favorites and points of interest to a Trip and to remove them from a Trip
4. WHEN a Booking is extracted from email, THE Application SHALL suggest existing Trips with matching destination or overlapping dates, or prompt the User to create a new Trip if no match is found
5. THE Application SHALL allow Users to set start and end dates for each Trip
6. IF a User sets an end date earlier than the start date, THEN THE Application SHALL reject the input and display an error message indicating the end date must be on or after the start date
7. THE Application SHALL display Trips in chronological order by start date on the main dashboard, with Trips that have no dates set displayed after dated Trips
8. WHEN a User deletes a Trip, THE Application SHALL unassign all associated Bookings, favorites, and points of interest from that Trip without deleting those items

### Requirement 5: Points of Interest Discovery

**User Story:** As a user, I want to discover interesting places near my travel destinations, so that I can plan activities during my trip.

#### Acceptance Criteria

1. WHEN a User views a destination within a Trip, THE POI_Engine SHALL display up to 20 points of interest within a default radius of 5 km from the Trip accommodation
2. THE POI_Engine SHALL categorize points of interest by type (restaurants, museums, parks, landmarks, entertainment)
3. THE POI_Engine SHALL display rating on a 1-to-5 scale, distance from accommodation in kilometers, opening hours, and price level on a 1-to-4 scale for each point of interest
4. THE POI_Engine SHALL retrieve point of interest data from Google Places API
5. WHEN a User specifies a radius preference between 1 km and 50 km, THE POI_Engine SHALL filter results to within that radius; IF the User enters a value outside the 1 km to 50 km range, THEN THE POI_Engine SHALL reject the input and display an error message indicating the valid range
6. IF the Google Places API is unavailable or returns an error, THEN THE POI_Engine SHALL display a message indicating that points of interest cannot be loaded and offer a retry option
7. IF no points of interest are found within the specified radius, THEN THE POI_Engine SHALL inform the User that no results were found and suggest increasing the search radius

### Requirement 6: AI-Powered Activity Search

**User Story:** As a user, I want to search for activities using natural language and receive personalized recommendations, so that I can find things to do that match my interests.

#### Acceptance Criteria

1. THE AI_Search SHALL accept natural language queries between 2 and 500 characters for finding activities, restaurants, museums, outdoor activities, and events
2. THE AI_Search SHALL return a maximum of 20 results per query, ranked by relevance to the query and User preferences
3. IF a User has prior search and favorite history, THEN THE AI_Search SHALL personalize result ranking by weighting categories and attributes matching that history higher
4. THE AI_Search SHALL display each result with name, description (maximum 200 characters), category, rating (on a 1 to 5 scale), estimated cost in the User's Home_Currency, and distance from the User's accommodation in the User's locale units
5. WHEN a User applies filters (category, price range, rating, distance), THE AI_Search SHALL display only results that match all applied filter criteria
6. THE AI_Search SHALL provide results within 3 seconds of query submission
7. IF a query returns fewer than 3 results, THEN THE AI_Search SHALL display a suggestion to the User to broaden the query or adjust filters
8. IF a User submits an empty query or a query shorter than 2 characters, THEN THE AI_Search SHALL display a message indicating the minimum query length requirement without executing a search
9. IF the User has no accommodation set for the active Trip, THEN THE AI_Search SHALL omit the distance field from results, disable the distance filter, and provide an option for the User to manually specify a reference location for distance calculations

### Requirement 7: Favorites and Wishlist

**User Story:** As a user, I want to save places and activities I'm interested in, so that I can revisit them later during trip planning.

#### Acceptance Criteria

1. THE Application SHALL allow Users to save any point of interest or search result to a favorites list, up to a maximum of 500 favorites per User
2. THE Application SHALL allow Users to organize favorites into custom-named collections with collection names up to 50 characters in length
3. THE Application SHALL allow Users to add personal notes of up to 1000 characters to each favorite item
4. WHEN a User saves a favorite while viewing a Trip, THE Application SHALL associate the favorite with that Trip
5. WHILE a User is viewing a Trip in Map_View, THE Application SHALL display all favorites associated with that Trip as markers on the map
6. IF a User saves a favorite without an active Trip context, THEN THE Application SHALL require the User to select a Trip or explicitly choose the general unassigned favorites list before completing the save
7. WHEN a User removes a favorite from a collection, THE Application SHALL remove the association but retain the favorite in the User's overall favorites list unless explicitly deleted

### Requirement 8: Timeline View

**User Story:** As a user, I want to see a chronological timeline of my trip, so that I can understand what happens when during my travels.

#### Acceptance Criteria

1. THE Timeline_View SHALL display all Trip events in chronological order, grouped by day, where events include Bookings, saved favorites, and manually added events
2. THE Timeline_View SHALL support a day-by-day view with time slots showing specific event times, and SHALL display events without a specific time as all-day entries at the top of the respective day
3. THE Timeline_View SHALL support a high-level day overview showing a count of events, their titles, and the earliest-to-latest time range for each day
4. THE Timeline_View SHALL display Bookings, saved favorites, and manually added events on the timeline using visually distinct indicators for each event type
5. WHEN a User switches between day-by-day and high-level views, THE Timeline_View SHALL preserve the current day position
6. THE Application SHALL allow Users to manually add custom events to the Timeline_View with a title (maximum 100 characters), time, location, and notes (maximum 500 characters), where title and time are required fields
7. IF a Trip contains no events, THEN THE Timeline_View SHALL display an empty state indicating no events are scheduled and providing an option to add a custom event
8. IF a User attempts to add a custom event with a time outside the Trip's start and end dates, THEN THE Application SHALL reject the entry and display an error message indicating the event time must fall within the Trip date range; IF the Trip start date and end date are the same day, THE Application SHALL allow events on that day

### Requirement 9: Map View

**User Story:** As a user, I want to see all my bookings and points of interest plotted on a map, so that I can understand the geographic layout of my trip.

#### Acceptance Criteria

1. THE Map_View SHALL display all Bookings within a Trip as markers on an interactive map, placing markers at each distinct location (departure airport and arrival airport for flights, property address for hotels, pickup and return locations for car rentals), and SHALL auto-fit the map viewport to encompass all visible markers when the map is first opened
2. THE Map_View SHALL display saved favorites and points of interest as distinct markers that are visually distinguishable from Booking markers
3. THE Map_View SHALL use visually distinct marker styles for different categories (flights, hotels, car rentals, restaurants, attractions), with each category having a unique icon or color
4. WHEN a User taps a marker on the Map_View, THE Application SHALL display a summary card showing: for flights — airline, flight number, departure and arrival airports, and departure time; for hotels — hotel name, check-in and check-out dates; for car rentals — rental company, pickup date, and pickup location; for favorites and points of interest — name, category, and rating
5. THE Map_View SHALL support zoom and pan interactions
6. WHEN a User selects a specific day on the Timeline_View, THE Map_View SHALL filter to show only that day's locations and auto-fit the viewport to the filtered markers
7. IF a Booking does not have a geocodable address, THEN THE Map_View SHALL omit that Booking from the map and SHALL indicate to the User that one or more bookings could not be plotted due to missing location data

### Requirement 10: Notifications and Reminders

**User Story:** As a user, I want to receive timely reminders about upcoming travel events, so that I never miss a check-in, flight, or pickup.

#### Acceptance Criteria

1. THE Notification_Service SHALL send a reminder 24 hours before each flight departure, based on the departure time in the event's local timezone
2. THE Notification_Service SHALL send a reminder at 8:00 AM in the hotel's local timezone on the day of hotel check-in
3. THE Notification_Service SHALL send a reminder 2 hours before a car rental pickup time, based on the pickup location's local timezone
4. THE Notification_Service SHALL support push notifications on mobile and in-app notifications on web
5. WHEN a Booking time changes due to an email update, THE Notification_Service SHALL recalculate the reminder schedule using the same timing offsets applied to the new Booking time
6. THE Application SHALL allow Users to customize notification timing offsets per event type within a range of 15 minutes to 72 hours before the event
7. IF a Booking is added or updated and the scheduled reminder time has already passed, THEN THE Notification_Service SHALL send the reminder within 5 minutes of the Booking being added or updated
8. IF a User has not granted push notification permission on mobile, THEN THE Application SHALL display an in-app prompt informing the User that reminders require notification permission and provide a path to enable it

### Requirement 11: Trip Sharing

**User Story:** As a user, I want to share my trip plans with travel companions, so that everyone on the trip can see the itinerary.

#### Acceptance Criteria

1. THE Sharing_Service SHALL allow a User to share a Trip with up to 20 other Users via email invitation
2. WHEN a User requests a shareable link, THE Sharing_Service SHALL generate a read-only link for non-registered recipients that expires after 30 days
3. WHEN a Trip is shared, THE Sharing_Service SHALL display the Trip owner and all recipients with their access level
4. THE Sharing_Service SHALL support two access levels: view-only and edit (Collaborator)
5. WHEN a Collaborator modifies a shared Trip, THE Application SHALL display the change with attribution to that Collaborator in the Trip activity feed within 10 seconds for online Users
6. WHEN a Trip owner revokes a recipient's access, THE Sharing_Service SHALL immediately remove that recipient's ability to view or edit the Trip
7. IF a User attempts to share a Trip with an invalid email address, THEN THE Sharing_Service SHALL reject the invitation and display an error message indicating the email address is invalid
8. WHEN an offline User reconnects to the network, THE Application SHALL display all Trip modifications made by Collaborators during the offline period immediately upon synchronization

### Requirement 12: Collaborative Planning

**User Story:** As a user, I want to plan trips together with my travel companions, so that everyone can contribute ideas and preferences.

#### Acceptance Criteria

1. WHEN a User is granted Collaborator access to a Trip, THE Application SHALL allow that Collaborator to add favorites, events, and notes to the Trip, and to edit or remove only items that they themselves added
2. THE Application SHALL display the name of the Collaborator who added each item (favorites, events, and notes) in a shared Trip
3. WHEN multiple Collaborators edit the same Trip simultaneously, THE Application SHALL resolve conflicts by preserving the most recent change based on server-received timestamp and notifying the Collaborator whose change was overwritten via in-app notification within 30 seconds
4. THE Application SHALL provide a Trip activity feed displaying up to the 50 most recent additions and changes by all Collaborators, ordered by timestamp from newest to oldest
5. THE Application SHALL allow Collaborators to cast an upvote or downvote on any favorite or event added to a shared Trip, with each Collaborator limited to one vote per item, and THE Application SHALL display the net vote count for each item
6. IF a Collaborator's access to a Trip is explicitly revoked by the Trip owner, THEN THE Application SHALL retain items added by that Collaborator in the Trip, keep them visible, and reassign attribution to the Trip owner; IF a Collaborator voluntarily leaves a shared Trip, THE Application SHALL retain their items with original attribution intact

### Requirement 13: Offline Access

**User Story:** As a user, I want to access my itinerary data without an internet connection, so that I can view my plans while traveling in areas with poor connectivity.

#### Acceptance Criteria

1. THE Sync_Engine SHALL cache all Trip data (bookings, timeline, favorites, map data) locally on the device, up to a maximum of 500 MB of offline storage per device
2. WHEN the device loses network connectivity, THE Application SHALL display a visible offline indicator and continue to display all cached Trip data in read-only mode
3. WHILE the device is offline, THE Application SHALL allow Users to add notes and favorites locally, and SHALL prevent actions that require server communication (such as sharing, inviting Collaborators, or connecting email accounts)
4. WHEN network connectivity is restored, THE Sync_Engine SHALL synchronize all locally made changes with the server within 60 seconds of detecting connectivity
5. IF a conflict occurs during synchronization between local changes and server changes to the same item, THEN THE Sync_Engine SHALL preserve both versions, apply the most recent change as the active version, and notify the User of the conflict
6. THE Sync_Engine SHALL indicate the last synchronization timestamp to the User
7. THE Application SHALL allow Users to select which Trips to make available offline on mobile devices, up to a maximum of 10 Trips simultaneously

### Requirement 14: Multi-Currency Support

**User Story:** As a user, I want to see costs displayed in both local and home currencies, so that I can understand expenses regardless of destination.

#### Acceptance Criteria

1. THE Currency_Service SHALL display Booking costs in the original booking currency and the User's Home_Currency, with converted amounts rounded to 2 decimal places
2. THE Currency_Service SHALL display point of interest price estimates in the Local_Currency and the User's Home_Currency, with converted amounts rounded to 2 decimal places
3. THE Application SHALL allow Users to set their Home_Currency in account settings from a list of at least 50 supported currencies including all ISO 4217 major currencies
4. IF a User has not set a Home_Currency, THEN THE Application SHALL prompt the User to select a Home_Currency before displaying any converted amounts
5. THE Currency_Service SHALL update exchange rates at least once every 24 hours
6. WHEN exchange rates are updated, THE Currency_Service SHALL recalculate all displayed converted amounts within 60 seconds
7. IF the exchange rate source is unavailable, THEN THE Currency_Service SHALL continue displaying the most recently cached exchange rates and indicate to the User that rates may be outdated

### Requirement 15: Weather Forecasts

**User Story:** As a user, I want to see weather forecasts for my destinations during my travel dates, so that I can pack appropriately and plan activities.

#### Acceptance Criteria

1. WHEN a User views a Trip, THE Weather_Service SHALL display weather forecasts for each destination during the Trip dates
2. THE Weather_Service SHALL display temperature high and low in both Celsius and Fahrenheit, precipitation probability as a percentage (0–100%), and general conditions (sunny, cloudy, rainy, snowy, windy)
3. IF the Trip start date is within 14 days, THEN THE Weather_Service SHALL provide daily forecasts for each destination; IF the Trip start date is beyond 14 days, THEN THE Weather_Service SHALL display historical weather averages for the corresponding calendar dates
4. THE Weather_Service SHALL display forecasts on the Timeline_View alongside scheduled events
5. WHEN the forecasted temperature changes by more than 5°C or precipitation probability changes by more than 30 percentage points for a Trip starting within 7 days, THE Notification_Service SHALL alert the User
6. THE Weather_Service SHALL display the date and time of the last successful data retrieval alongside forecast data; IF weather forecast data is unavailable for a destination, THEN THE Weather_Service SHALL additionally display a message indicating that forecast data is currently unavailable

### Requirement 16: Document Storage

**User Story:** As a user, I want to attach and store travel documents (boarding passes, confirmations, vouchers) within the app, so that I can access them quickly during my trip.

#### Acceptance Criteria

1. THE Document_Store SHALL allow Users to upload files in PDF, JPEG, PNG, and HEIC formats and associate them with a specific Booking or Trip
2. THE Document_Store SHALL support a maximum file size of 25 MB per document
3. THE Document_Store SHALL allow Users to categorize documents by type (boarding pass, confirmation, voucher, visa, insurance)
4. WHEN a booking confirmation is extracted from email, THE Document_Store SHALL automatically attach the original email as a document categorized as "confirmation" under the associated Booking
5. THE Document_Store SHALL allow Users to view or preview stored documents within the Application and make them available offline through the Sync_Engine
6. THE Document_Store SHALL support a maximum of 100 documents per Trip
7. IF a User attempts to upload a file that exceeds 25 MB or is in an unsupported format, THEN THE Document_Store SHALL reject the upload and display an error message indicating the reason for rejection
8. IF a User attempts to upload a document when the Trip has reached the 100-document limit, THEN THE Document_Store SHALL reject the upload and display an error message indicating the limit has been reached
9. THE Document_Store SHALL allow Users to delete stored documents from a Booking or Trip

### Requirement 17: Cross-Platform Availability

**User Story:** As a user, I want to access the application on web, iOS, and Android with consistent functionality, so that I can use whichever device is convenient.

#### Acceptance Criteria

1. THE Application SHALL provide a responsive web application accessible via the latest 2 major versions of Chrome, Firefox, Safari, and Edge, supporting viewport widths from 320px to 2560px
2. THE Application SHALL provide native mobile applications for iOS (version 16+) and Android (version 12+)
3. WHILE connected to the network, THE Sync_Engine SHALL synchronize all User data across platforms within 10 seconds of a change occurring
4. THE Application SHALL provide the same set of features and navigation structure across all platforms, with each feature producing identical outcomes regardless of platform used
5. WHEN a User performs an action on one platform, THE Sync_Engine SHALL reflect that action on all other platforms within 10 seconds of those platforms having network connectivity
6. IF the Sync_Engine fails to synchronize data after 3 retry attempts, THEN THE Application SHALL display a notification indicating the sync failure and retain the unsynchronized changes locally until sync succeeds
7. IF a User modifies the same data on multiple platforms before synchronization completes, THEN THE Sync_Engine SHALL resolve the conflict by applying the most recent change based on timestamp and notifying the User of the conflicting modification

### Requirement 18: Expense Management with AI Receipt Scanning

**User Story:** As a user, I want to track my travel expenses by scanning receipts and having them automatically categorized, so that I can manage my budget and review spending after the trip.

#### Acceptance Criteria

1. THE Expense_Tracker SHALL allow Users to manually add an expense with the following required fields: amount (a positive value between 0.01 and 999,999,999.99), currency, date, and category; and the following optional fields: merchant name, notes (maximum 500 characters), and associated Booking or Trip
2. THE Expense_Tracker SHALL support the following expense categories: accommodation, transportation, food and dining, shopping, tours and activities, entertainment, and other
3. WHEN a User photographs or uploads a receipt image in JPEG, PNG, or HEIC format, THE Receipt_Scanner SHALL extract merchant name, total cost, currency, date, and expense category within 10 seconds
4. IF the Receipt_Scanner cannot extract one or more fields from a receipt image, THEN THE Receipt_Scanner SHALL populate the fields it can determine and flag the remaining fields for the User to complete manually
5. IF the Receipt_Scanner cannot process the image due to poor quality or unsupported format in direct response to a User uploading a receipt, THEN THE Receipt_Scanner SHALL notify the User that the receipt could not be read and offer the option to retake the photo or manually enter the expense
6. WHEN an expense is recorded, THE Expense_Tracker SHALL allow the User to associate it with an existing Booking or Trip
7. THE Expense_Tracker SHALL display a Trip expense summary showing total spending and subtotals per expense category, with all amounts converted to the User's Home_Currency using the Currency_Service
8. THE Timeline_View SHALL display a daily expense breakdown showing the total amount spent on each day of the Trip
9. WHEN an expense is recorded in a currency other than the User's Home_Currency, THE Currency_Service SHALL convert the amount to the Home_Currency using the most recent available exchange rate and display both the original and converted amounts
10. THE Expense_Tracker SHALL allow Users to set a total budget for a Trip, specified in the User's Home_Currency, with a value between 0.01 and 999,999,999.99
11. WHEN Trip spending reaches 80 percent of the set budget, THE Notification_Service SHALL send a single alert to the User indicating the budget threshold has been reached, and SHALL not send the same threshold alert again unless total spending drops below 80 percent and subsequently reaches it again
12. WHEN Trip spending exceeds 100 percent of the set budget, THE Notification_Service SHALL send a single alert to the User indicating the budget has been exceeded and display the overage amount, and SHALL not send the same exceedance alert again unless total spending drops below 100 percent and subsequently exceeds it again
13. THE Expense_Tracker SHALL allow Users to export a Trip expense report in PDF format and CSV format, including all expenses with date, merchant, category, original amount with currency, and converted amount in Home_Currency
14. IF a User attempts to set a budget of zero or a negative value, THEN THE Expense_Tracker SHALL reject the input and display an error message indicating the budget must be a positive value
15. THE Expense_Tracker SHALL support receipt images up to 10 MB in file size
16. IF a User uploads a receipt image exceeding 10 MB, THEN THE Expense_Tracker SHALL reject the upload and display an error message indicating the maximum file size
17. THE Expense_Tracker SHALL allow Users to edit the fields of an existing expense and to delete an expense, and WHEN an expense is edited or deleted, THE Expense_Tracker SHALL recalculate the Trip expense summary and re-evaluate budget thresholds

### Requirement 19: Flight Check-in

**User Story:** As a user, I want to check in for my flights directly from the app, so that I can complete check-in without navigating to separate airline websites or apps.

#### Acceptance Criteria

1. WHEN a flight booking's departure is within 24 hours, THE Checkin_Service SHALL display a "Check In" button on the flight booking card in the dashboard and booking detail view
2. WHEN a User taps the "Check In" button, THE Checkin_Service SHALL open the airline's check-in page in an in-app browser, pre-filling the booking reference and passenger last name where supported by the airline's web check-in URL scheme
3. THE Checkin_Service SHALL support direct check-in links for major airlines including but not limited to Delta, United, American Airlines, Southwest, British Airways, Lufthansa, Air France, and Emirates
4. IF the airline does not support a direct check-in URL scheme, THEN THE Checkin_Service SHALL open the airline's general check-in page and display the booking reference for the User to enter manually
5. THE Notification_Service SHALL send a check-in reminder notification when the check-in window opens (typically 24 hours before departure), including a direct link to initiate check-in within the Application
6. WHEN check-in is completed, THE Application SHALL allow the User to mark the flight as "Checked In" and update the booking status badge accordingly
7. WHEN a flight is marked as "Checked In", THE Application SHALL display a green "Checked In" badge on the booking card replacing the previous status badge
8. THE Checkin_Service SHALL display the check-in window open and close times for each flight (e.g., "Check-in opens: Jul 11, 8:30 PM • Closes: Jul 12, 7:30 PM")
9. IF the current time is before the check-in window opens, THEN THE Checkin_Service SHALL display the time remaining until check-in opens (e.g., "Check-in opens in 3h 45m")
10. IF the check-in window has closed, THEN THE Checkin_Service SHALL disable the "Check In" button and display a message indicating that online check-in is no longer available
11. WHEN check-in is completed successfully, THE Application SHALL prompt the User to upload or photograph their boarding pass, and THE Document_Store SHALL store it associated with the flight Booking
12. IF a check-in process is already in progress when the check-in window closes, THE Checkin_Service SHALL allow the in-progress check-in to complete

### Requirement 20: User Preferences and Personalization

**User Story:** As a user, I want to set my personal preferences for interests, dietary restrictions, allergies, and locale settings, so that the app provides relevant and safe recommendations tailored to me.

#### Acceptance Criteria

1. THE Preference_Engine SHALL allow Users to select one or more interest categories from the following list: history, culture, art, architecture, nature, adventure, nightlife, shopping, sports, wellness, music, and photography
2. THE Preference_Engine SHALL allow Users to select one or more dietary preferences from the following list: vegan, vegetarian, lacto-vegetarian, Jain, pescatarian, halal, kosher, gluten-free, dairy-free, nut-free, and no preference
3. THE Preference_Engine SHALL allow Users to specify one or more allergies from the following list: gluten, peanuts, tree nuts, dairy, eggs, shellfish, soy, wheat, fish, and sesame; and SHALL allow Users to add custom allergy entries up to 50 characters each
4. WHEN a User has dietary preferences or allergies set, THE AI_Search SHALL exclude results that conflict with those restrictions and SHALL prominently label results that explicitly accommodate those preferences (e.g., "Vegan-friendly", "Gluten-free options available")
5. WHEN a User has dietary preferences or allergies set, THE POI_Engine SHALL display a compatibility indicator on restaurant and food-related points of interest showing whether they accommodate the User's dietary needs
6. WHEN a User has interest categories selected, THE AI_Search SHALL boost results matching those interest categories in the relevance ranking
7. THE Preference_Engine SHALL allow Users to set a preferred language from a list of at least 20 languages including English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Mandarin Chinese, Arabic, Hindi, Russian, Dutch, Swedish, Norwegian, Danish, Finnish, Polish, Turkish, and Thai
8. WHEN a User sets a preferred language, THE Application SHALL display all interface text, notifications, and AI_Search results in that language where translations are available
9. THE Preference_Engine SHALL allow Users to select one or more display currencies (replacing the single Home_Currency), with the first selected currency used as the default display currency
10. WHEN a User has multiple display currencies configured, THE Currency_Service SHALL allow the User to switch between configured currencies via a toggle in any view displaying monetary amounts, without navigating to account settings
11. THE Currency_Service SHALL provide an in-app currency converter accessible from any expenses or booking view, allowing the User to convert between any two supported currencies using the most recent exchange rate
12. WHEN a User modifies their preferences, THE Application SHALL apply the updated preferences to all subsequent searches, recommendations, and displays within 5 seconds without requiring an app restart
13. IF a User has not configured any preferences, THEN THE Application SHALL use default settings: no interest filter, no dietary restrictions, English language, and the User's device locale currency as the default display currency; IF default settings fail to apply, THE Application SHALL continue operating and allow individual features to handle missing preferences gracefully; IF a User has configured some preferences but left others blank, THE Application SHALL apply configured preferences and leave unconfigured preferences without defaults
14. THE Preference_Engine SHALL store preferences per User account and synchronize them across all platforms via the Sync_Engine


### Requirement 21: Group Expense Splitting

**User Story:** As a user traveling with a group, I want to split expenses among travel companions, so that everyone pays their fair share without manual calculations.

#### Acceptance Criteria

1. THE Expense_Splitter SHALL allow Users to create a group for a Trip, consisting of the Trip owner and one or more Collaborators or manually added members identified by name
2. THE Expense_Splitter SHALL allow Users to split an individual expense equally among all group members, or assign a custom percentage to each member where the total percentages must equal 100 percent
3. THE Expense_Splitter SHALL allow Users to assign a per-item split on expenses that contain multiple line items, allocating each item to one or more specific group members
4. THE Expense_Splitter SHALL display a group expense overview screen showing: total group spending, each member's share (amount owed or amount to be reimbursed), and a breakdown by expense category per member
5. THE Expense_Splitter SHALL calculate net balances between group members, indicating who owes whom and the net amount, displayed in the User's Home_Currency
6. WHEN a new expense is added to a Trip with an active group, THE Expense_Splitter SHALL prompt the User to select whether the expense is personal or shared with the group
7. IF a User assigns percentages that do not total 100 percent, THEN THE Expense_Splitter SHALL reject the split and display an error message indicating the percentages must sum to 100
8. THE Expense_Splitter SHALL allow Users to mark a debt between two members as "settled" without recording an in-app payment
9. THE Expense_Splitter SHALL support splitting expenses recorded in any currency, converting each member's share to their own Home_Currency using the Currency_Service
10. WHEN a shared expense is edited or deleted, THE Expense_Splitter SHALL recalculate all affected member balances within 5 seconds

### Requirement 22: Itinerary Gap Detection

**User Story:** As a user, I want the app to identify gaps in my travel plans such as unbooked hotels or missing transportation between locations, so that I can address them before my trip.

#### Acceptance Criteria

1. THE Gap_Detector SHALL analyze a Trip's itinerary and identify days within the Trip date range that have no hotel booking or accommodation assigned
2. THE Gap_Detector SHALL identify transportation gaps where a User has bookings at two different locations on consecutive days without a connecting flight, car rental, or manually added transport event between them
3. THE Gap_Detector SHALL identify scheduling conflicts where two or more events overlap in time on the same day
4. THE Gap_Detector SHALL display detected gaps as advisory notifications in the Trip dashboard, categorized by type: missing accommodation, missing transportation, and scheduling conflict
5. WHEN a gap is detected, THE Gap_Detector SHALL suggest relevant actions: "Book a hotel" for accommodation gaps, "Add transport" for transportation gaps, and "Reschedule" for conflicts
6. THE Gap_Detector SHALL re-analyze the itinerary automatically within 30 seconds whenever a Booking is added, removed, or modified within the Trip
7. THE Gap_Detector SHALL allow Users to dismiss individual gap notifications, and dismissed gaps SHALL not reappear unless the underlying itinerary data changes
8. IF all gaps in a Trip have been resolved or dismissed, THEN THE Gap_Detector SHALL display a confirmation indicating the itinerary is complete
9. THE Gap_Detector SHALL detect gaps for trips with start and end dates set; IF a Trip has no dates set, THEN THE Gap_Detector SHALL not perform gap analysis and SHALL display a message suggesting the User set Trip dates
10. THE Gap_Detector SHALL identify when a User arrives at a destination (via flight or car arrival) without a planned activity or accommodation for the remainder of that day

### Requirement 23: Social Media Sharing

**User Story:** As a user, I want to share highlights from my trips on social media with curated photos and captions, so that I can share my experiences with friends and followers.

#### Acceptance Criteria

1. THE Social_Sharing SHALL allow Users to create a shareable trip highlight by selecting one or more photos from the device photo gallery, the Document_Store, or photos previously uploaded to the Trip
2. THE Social_Sharing SHALL allow Users to add a caption of up to 500 characters and tag the Trip name and destination(s) in the shareable highlight
3. THE Social_Sharing SHALL support sharing to Instagram, Facebook, X (Twitter), and WhatsApp via the platform's native share sheet on mobile, and via direct URL/API integration on web where supported
4. THE Social_Sharing SHALL allow Users to select a layout template for multi-photo shares: single image, carousel (up to 10 images), or collage (2 to 6 images in a grid)
5. THE Social_Sharing SHALL generate a preview of the shareable highlight before posting, showing how it will appear on the selected platform
6. THE Social_Sharing SHALL allow Users to include trip statistics in the share: destinations visited, total days, total distance traveled, and number of activities completed
7. IF a User has not granted photo gallery access permission, THEN THE Application SHALL display a prompt requesting permission before allowing photo selection
8. THE Social_Sharing SHALL not share any personal booking details (confirmation numbers, addresses, flight numbers) unless the User explicitly includes them in the caption
9. THE Social_Sharing SHALL allow Users to save a created highlight as a draft within the Trip for later posting
10. WHEN a User shares a highlight, THE Social_Sharing SHALL record the share event in the Trip activity feed visible to Collaborators

### Requirement 24: Public Landing Page

**User Story:** As a visitor, I want to see an informative and visually appealing landing page so that I can understand the product's value and decide to sign up.

#### Acceptance Criteria

1. THE Application SHALL display a public landing page accessible without authentication at the root URL
2. THE landing page SHALL include a fixed header with the application logo, navigation links (Features, About Us, How It Works, Help), and Log In / Sign Up buttons
3. THE header SHALL be responsive: on mobile viewports, navigation links SHALL collapse into a hamburger menu
4. THE landing page SHALL include a hero section with a rotating image carousel (auto-advancing every 5 seconds) displaying travel imagery with headline text and call-to-action buttons
5. THE landing page SHALL include a Features section presenting at least 6 key product capabilities in a responsive grid
6. THE landing page SHALL include a "How It Works" section describing the onboarding flow in 3 steps
7. THE landing page SHALL include an "About Us" section with a company description and relevant imagery
8. THE landing page SHALL include a Help/FAQ section with at least 5 expandable questions and answers
9. THE landing page SHALL include a footer with columns for Product, Company, and Legal links
10. THE footer SHALL include links to Privacy Policy, Terms of Service, GDPR Compliance, and Cookie Policy
11. THE landing page SHALL be fully responsive across mobile (< 640px), tablet (640px-1024px), and desktop (> 1024px) viewports
12. ALL images on the landing page SHALL use royalty-free or properly licensed imagery

### Requirement 25: End-to-End Testing

**User Story:** As a developer, I want automated end-to-end tests covering critical user flows so that I can deploy with confidence.

#### Acceptance Criteria

1. THE project SHALL include an E2E test suite using Playwright covering authentication, trip management, expense tracking, search, and settings flows
2. THE E2E tests SHALL be runnable locally against the development servers (API on port 3000, web on port 3001)
3. THE Playwright configuration SHALL auto-start API and web servers when not already running
4. THE E2E test suite SHALL include tests for: user registration, login, invalid credentials, navigation between pages, trip creation, expense list viewing, search interface interaction, and preference management
5. THE E2E tests SHALL run in headless mode by default with options for headed and UI debug modes
6. THE E2E tests SHALL generate an HTML report after each run
7. THE E2E tests SHALL complete within 2 minutes for the full suite

### Requirement 26: Email-Forward Booking Ingestion

**User Story:** As a traveler, I want to forward my booking confirmation emails to a single address (trips@neyya.ai) and have them automatically added to the right trip, so I don't need to manually enter booking details.

#### Acceptance Criteria

1. THE Application SHALL accept forwarded booking confirmation emails at the address `trips@neyya.ai`
2. THE Application SHALL identify the user by the "From" email address of the forwarded message
3. IF the "From" email matches an existing registered user, THEN THE Application SHALL process the booking and attempt to assign it to an existing trip
4. THE trip matching logic SHALL follow this priority order:
   a. **Date overlap** — if the booking dates fall within an existing trip's date range, assign to that trip
   b. **Destination match** — if the booking destination matches an existing trip's destination, assign to that trip
   c. **Create new trip** — if no match is found, auto-create a trip named after the destination and dates (e.g., "Paris, Aug 2026")
5. WHEN a booking is assigned to a trip (existing or new), THE Application SHALL notify the user and ask them to confirm the assignment or make changes
6. IF the "From" email does NOT match any registered user, THEN THE Application SHALL:
   a. Store the extracted booking data for 60 days
   b. Send an email to the "From" address inviting them to create an account, including: a summary of the detected booking (destination, dates, type), a direct link to create an account, a note that the data will be held for 60 days
   c. Include an option for users who already have an account with a different email to log in and claim the booking
7. IF a user logs in with a different email and wants to claim a booking, THEN THE Application SHALL send a verification link to the original forwarding email address to confirm ownership before attaching the booking
8. THE Application SHALL prevent duplicate bookings by checking against existing bookings for the same user (same flight number + date, same hotel + check-in/out, same car company + pickup/return)
9. IF the same booking is received from both email forwarding and connected inbox scanning, THE Application SHALL keep the first processed version and discard the duplicate
10. THE unclaimed booking data SHALL be automatically deleted after 60 days with no further emails sent to the user
11. THE Application SHALL support extracting booking details from common confirmation email formats: airline bookings, hotel reservations, car rental confirmations, and general travel itineraries
12. WHEN a new trip is auto-created from a booking, THE Application SHALL use the destination as the trip name and set start/end dates from the booking dates

### Requirement 27: Connected Email Scanning

**User Story:** As a traveler, I want to connect my email account so that booking confirmations are automatically detected and added to my trips without manual forwarding.

#### Acceptance Criteria

1. THE Application SHALL support connecting email accounts from the following providers:
   a. Gmail (via OAuth + Gmail API)
   b. Microsoft Outlook/Hotmail (via OAuth + Microsoft Graph API)
   c. Yahoo Mail (via OAuth)
   d. Any SMTP/IMAP provider (via IMAP credentials with app-specific passwords)
2. WHEN an email account is first connected, THE Application SHALL scan the last 90 days of messages for booking confirmation emails
3. THE Application SHALL detect booking-relevant emails using:
   a. Subject line keywords: "booking", "confirmation", "reservation", "itinerary", "e-ticket", "check-in", "receipt"
   b. Known sender domains: airlines (e.g., delta.com, united.com, ba.com), hotels (e.g., marriott.com, hilton.com, booking.com, airbnb.com), car rentals (e.g., hertz.com, enterprise.com), travel aggregators (e.g., expedia.com, kayak.com, tripadvisor.com)
   c. Email content patterns: confirmation numbers, flight numbers, dates in structured format
4. THE scan frequency SHALL be configurable per user in their profile settings with the following options:
   a. Real-time (push notifications where supported — Gmail, Outlook)
   b. Every 5 minutes (default)
   c. Every 15 minutes
   d. Every hour
   e. Manual only
5. THE Application SHALL provide a "Scan Now" button in the user's profile/email settings to manually trigger an immediate scan of connected accounts
6. WHEN a connected email scan detects a booking, THE Application SHALL follow the same trip-matching logic as email forwarding (date overlap → destination → create new trip) and auto-add without additional user confirmation
7. IF both email forwarding AND connected scanning detect the same booking, the connected scan SHALL take priority and the forwarded duplicate SHALL be discarded
8. THE Application SHALL NOT store the full email content — only extracted booking fields (airline, dates, confirmation numbers, etc.)
9. THE Application SHALL display the last scan timestamp and status (success/error) in the user's email connection settings
10. IF a connected account's OAuth token expires or becomes invalid, THE Application SHALL notify the user and pause scanning until re-authorized
11. FOR IMAP providers, THE Application SHALL support TLS/SSL connections and validate server certificates
12. THE Application SHALL allow users to disconnect an email account at any time, which stops all scanning but retains previously extracted bookings

### Requirement 28: Distributed Shared Trips

**User Story:** As a group of friends/family traveling together, we want a single shared trip where each person's bookings, expenses, and plans are visible to the group, so we can coordinate without switching between separate apps.

#### Acceptance Criteria

##### Trip Ownership & Roles

1. THE trip creator SHALL be the primary owner with full control (edit, delete, manage members)
2. THE primary owner SHALL be able to assign "co-owner" role to other members, granting them equal management rights (invite/remove members, edit trip details, delete trip)
3. THE Application SHALL support the following member roles: **owner** (full control), **co-owner** (full control except deleting the trip), **editor** (add/edit bookings, expenses, events), **viewer** (read-only)
4. THERE SHALL be exactly one shared trip per travel group — members do NOT create separate trips for the same journey

##### Booking Visibility & Assignment

5. ALL bookings in a shared trip SHALL be visible to all members regardless of who created/forwarded them
6. EACH booking SHALL have an `owner_id` indicating who booked it, displayed in the UI (e.g., "Bob's flight")
7. THE trip timeline SHALL display a merged view of all members' bookings and events, showing who each item belongs to (e.g., "Alice arrives 2pm", "Bob arrives 5pm")
8. WHEN a member forwards a booking to trips@neyya.ai or it's detected via connected email scanning, the trip-matching logic SHALL check **shared trips the user is a member of** BEFORE checking the user's own trips, with this priority: shared trips (by date/destination) → own trips → create new trip
9. IF the booking could match multiple shared trips, THE Application SHALL send the user a confirmation link asking which trip to add it to

##### Expense Visibility & Privacy

10. WHEN adding an expense, THE user SHALL choose between **"shared"** (visible to all trip members, included in group splitting) or **"personal"** (visible only to the expense owner, not split)
11. ALL shared expenses SHALL be visible to all trip members with full details (amount, payer, category, merchant)
12. PERSONAL expenses SHALL only appear in the owner's own expense view and SHALL NOT be included in group balance calculations
13. THE trip expense summary SHALL show: total shared expenses, per-member balances (who owes whom), and a separate "Your personal expenses" section for each user
14. WHEN scanning a receipt or adding an expense, THE Application SHALL prompt: "Is this a shared expense or personal?" with shared as the default for group trips

##### Booking Auto-Assignment Priority

15. WHEN a booking is detected for a user who is a member of shared trips, THE matching priority SHALL be:
    a. Shared trips matching by date overlap
    b. Shared trips matching by destination
    c. User's own (non-shared) trips matching by date/destination
    d. Create new trip (ask user to confirm)
16. IF the user is a member of multiple shared trips that match, THE Application SHALL ask the user to choose (via notification with trip options)

##### Real-Time Collaboration

17. WHEN any member adds a booking, expense, or event to a shared trip, ALL other members SHALL receive a real-time notification (via Socket.io for active sessions, push notification for mobile/inactive)
18. THE notification SHALL include: who made the change, what was added/modified, and a link to view it
19. THE activity feed SHALL log all member actions with timestamps, visible to all trip members

##### Member Departure

20. WHEN a member leaves a shared trip (voluntarily or removed), their bookings SHALL remain visible on the trip but be displayed in a "greyed out" style indicating the member has departed
21. DEPARTED members' future bookings/events (after departure date) SHALL be greyed out; past items remain normal
22. DEPARTED members' shared expenses SHALL remain in the group balance for final settlement
23. THE Application SHALL prompt remaining members to settle outstanding balances when a member departs
24. A departed member SHALL retain read-only access to the trip for 30 days to view final settlements, after which access is revoked

### Requirement 29: Post-Login Email Connection Prompt

**User Story:** As a new user who signed up via a social/email provider, I want to be prompted once to connect my inbox for automatic booking import, so I can get started quickly without navigating through settings.

#### Acceptance Criteria

1. WHEN a user completes their first login (new account or first session), THE Application SHALL display a one-time prompt asking if they want to connect their email for booking scanning
2. THE prompt SHALL explain what it does: "We can scan your inbox for booking confirmations and add them to your trips automatically"
3. THE prompt SHALL clearly state: "We only read travel-related emails. You can disconnect anytime."
4. THE prompt SHALL offer two options: "Connect [Provider]" (primary action) and "Not now" (dismiss)
5. IF the user logged in via Google OAuth, THE prompt SHALL offer "Connect Gmail" as the primary action
6. IF the user logged in via Microsoft OAuth, THE prompt SHALL offer "Connect Outlook" as the primary action
7. IF the user logged in via email/password, THE prompt SHALL offer a general "Connect Email" option leading to the provider selection page
8. IF the user clicks "Connect [Provider]", THE Application SHALL redirect to the OAuth consent screen requesting inbox read permissions (e.g., `gmail.readonly` scope)
9. IF the user clicks "Not now", THE Application SHALL dismiss the prompt and NOT show it again (stored as user preference `email_connect_prompt_dismissed`)
10. THE prompt SHALL only appear ONCE per user account lifetime — never repeat after dismissal or successful connection
11. THE Application SHALL NOT auto-connect or read the user's email without explicit action on this prompt
12. THE prompt SHALL appear as a dismissable modal/card on the dashboard, NOT blocking the user from using the app

### Requirement 30: Admin Panel

**User Story:** As a platform administrator, I want a comprehensive admin panel to manage users, monitor system health, configure AI services, track costs, and moderate content, so I can operate the platform effectively.

#### Acceptance Criteria

##### Access & Authentication

1. THE admin panel SHALL be accessible at `admin.neyya.ai` as a separate frontend application
2. THE admin panel SHALL require authentication with an admin-level account
3. THE Application SHALL support admin roles: **super-admin** (full access) and **support** (read + user management only)
4. Admin accounts SHALL also function as regular user accounts (admins can use the main app with their own trips)
5. THE admin panel SHALL log all admin actions in an audit trail (who, what, when, IP address)

##### User Management

6. THE admin panel SHALL display a searchable, sortable user list with: email, display name, registration date, last login, status (active/suspended/deleted), connected emails count, trips count
7. THE admin panel SHALL allow admins to: view user profile, suspend user, reactivate user, delete user and all data, impersonate user (view-only)
8. WHEN a user is suspended, THEY SHALL see a message on login: "Your account has been suspended. Contact support@neyya.ai for assistance."
9. THE Application SHALL support a warning system before suspension: email warning → 7-day notice → suspend
10. THE Application SHALL auto-detect misuse patterns (configurable thresholds): >100 email scans/day, >50 AI searches/hour, spam forwarding to trips@neyya.ai
11. Auto-detection SHALL be toggleable per-rule from the admin config panel
12. WHEN a user is deleted, ALL their data (trips, bookings, expenses, documents, preferences) SHALL be permanently removed (GDPR right to erasure)

##### Statistics & Analytics Dashboard

13. THE admin dashboard SHALL display real-time metrics: DAU (daily active users), MAU (monthly active users), total registered users, online users now
14. THE admin dashboard SHALL display activity metrics: trips created (today/week/month), bookings imported (by source: email forward vs. connected scan vs. manual), AI searches performed, expenses tracked, emails processed/failed
15. THE admin dashboard SHALL include a world map showing trip destination locations
16. THE admin panel SHALL provide per-user drill-down: click a user to see their trips, last login, connected emails, activity timeline, and cost attribution
17. ALL metrics SHALL update in real-time (WebSocket or polling every 30s)

##### Configuration Management

18. THE admin panel SHALL provide AI model configuration: change Tier 1/Tier 2 models per feature, toggle auto-escalation, set confidence thresholds
19. THE admin panel SHALL provide feature flags: toggle any feature on/off globally (email scanning, social sharing, AI search, expense splitting, etc.)
20. THE admin panel SHALL provide rate limit configuration: per-endpoint and per-user overrides
21. THE admin panel SHALL provide a global email scanning pause/resume toggle
22. Configuration changes SHALL take effect within 5 seconds without requiring a redeployment

##### Cost Monitoring

23. THE admin panel SHALL display AWS costs pulled from AWS Cost Explorer API (24h delay, daily refresh)
24. THE cost dashboard SHALL show per-service breakdown: Bedrock (LLM), Google Places, Textract, RDS, ElastiCache, ECS, S3, CloudFront, SES, SQS, Lambda
25. THE cost dashboard SHALL show per-user cost attribution (emails parsed, AI searches, receipts scanned)
26. THE admin panel SHALL support cost alerts: notify via email when daily or monthly spend exceeds a configurable threshold
27. THE cost dashboard SHALL include a direct link to AWS Cost Explorer for detailed analysis

##### System Health

28. THE admin panel SHALL display system health: API uptime percentage, error rate (5xx), latency (p50/p95/p99), active connections
29. THE admin panel SHALL display email queue status: pending, processing, completed, failed — with ability to retry failed items
30. THE admin panel SHALL display LLM usage: requests by tier, average latency, error rate, escalation rate

##### Support & Moderation

31. THE admin panel SHALL allow user impersonation (read-only view of a user's account for debugging)
32. THE admin panel SHALL support sending in-app announcements to all users (maintenance windows, new features)
33. THE admin panel SHALL provide a content moderation queue for social media shares (review before publish if moderation is enabled)
34. THE admin panel SHALL provide a moderation toggle: auto-approve all vs. require review

### Requirement 31: Home Location

**User Story:** As a traveler, I want to set my home location(s) so that the app can calculate travel times to airports, suggest directions, show timezone differences, and help me plan the start/end of my trips.

#### Acceptance Criteria

1. THE Application SHALL allow users to set up to two home locations: **Primary Home** (current residence) and **Native Home** (family/origin — for expats who frequently travel between both)
2. EACH home location SHALL include: city (required), country (required), full address (optional), nearest airport(s) (auto-suggested, editable), timezone (auto-detected), coordinates (auto-geocoded)
3. THE Application SHALL ask users to set their home location during onboarding (first login after registration) with a dismissable prompt: "Set your home location to help us plan your trips better"
4. THE home location SHALL also be editable in Settings under a "Home & Travel" section
5. THE Application SHALL auto-detect nearest airports based on the home city (up to 3 airports within 100km)
6. THE Application SHALL store a **transport mode preference**: "How do you usually get to the airport?" with options: drive (own car), taxi/rideshare, public transport, train, drop-off (someone drives you)
7. USING the home location and transport mode, THE Application SHALL calculate a personalized "Leave home by" time for flights: departure time - airport buffer (2h domestic / 3h international) - estimated travel time to airport based on transport mode
8. THE timeline flight cards SHALL display the calculated "Leave home by" time using the user's actual home → airport travel estimate
9. IF the user has set a Native Home, THE Application SHALL recognize trips to that city/country as "going home" and optionally adjust suggestions (e.g., no hotel needed, familiar restaurants)
10. THE home location SHALL be optional — the app functions without it, but shows a gentle reminder on the dashboard if not set: "Set your home location for better trip planning"
11. THE Application SHALL display timezone difference on trip cards: "Destination is UTC+7 (5h ahead of home)"
12. THE Application SHALL use home location for weather comparison: "32°C in Bali vs 15°C at home"

### Requirement 32: Source Attachments (Provenance Tracking)

**User Story:** As a traveler, I want every booking and expense to link back to its original source (email, receipt photo, PDF) so I can verify details and have proof when needed.

#### Acceptance Criteria

1. EVERY booking and expense SHALL track its **source type**: `email` (auto-imported), `receipt_scan` (photo), `pdf` (attached document), `manual` (user-typed), `forwarded` (via trips@neyya.ai)
2. FOR email-sourced items, THE Application SHALL store BOTH: a) the full original email (HTML body, stored in S3) for offline viewing, and b) a reference (provider + message ID) for linking back to the user's inbox
3. FOR receipt-scanned expenses, THE Application SHALL retain the original image (JPEG/PNG/HEIC) in S3 linked to the expense
4. FOR PDF attachments, THE Application SHALL store the original PDF in S3 linked to the booking/expense
5. FOR manual entries, THE Application SHALL prompt: "Attach a confirmation screenshot, email, or PDF?" (optional)
6. THE Application SHALL perform **privacy sanitization** on stored emails: strip credit card numbers, CVVs, billing addresses, and payment details — but KEEP traveller names, dates, confirmation numbers, and booking details
7. THE UI SHALL display a source indicator on each booking/expense card with a "View Original" link: `📧 Source: email` / `📷 Source: receipt photo` / `📄 Source: PDF` / `✍️ Manually entered`
8. CLICKING "View Original" SHALL open a modal/page showing: the original email (rendered HTML), receipt image (full-size), or PDF viewer
9. THE Application SHALL allow users to configure **source data retention** in their settings with options: a) Keep forever (default for paid plans), b) Delete after 5 years, c) Delete after 2 years, d) Delete after 1 year, e) Delete after 6 months
10. THE default retention period SHALL be compliant with GDPR: stored for as long as the user has an active account, deleted within 30 days of account deletion
11. WHEN a user deletes their account, ALL source attachments SHALL be permanently deleted from S3 within 30 days
12. THE source attachment SHALL be accessible offline (cached locally when user selects trip for offline access)

### Requirement 33: Trip Members & Travel Groups

**User Story:** As a trip organizer, I want to manage all travellers in my trip — including family members, friends, and kids — organized into groups, so that bookings, expenses, and plans are properly attributed and split among the right people.

#### Acceptance Criteria

##### Travellers

1. THE Application SHALL support adding travellers to a Trip with the following types: **adult** (18+), **child** (2-17), and **infant** (0-2)
2. EACH traveller SHALL have: display name (required), email (optional), phone (optional), date of birth (optional), traveller type (required), and optionally passport name, passport number (encrypted), and nationality
3. THE Application SHALL support travellers with a linked Neyya account (registered users) AND travellers without an account (kids, elderly, or anyone who won't use the app)
4. WHEN adding a traveller by email, THE Application SHALL check if the email matches an existing Neyya user and display a "User found" indicator
5. NON-ACCOUNT travellers SHALL still appear on booking cards (as traveller names), expense splits (as split members), and flight manifests

##### Groups

6. THE Application SHALL allow organizing travellers into named groups within a Trip (e.g., "Smith Family", "College Friends")
7. EACH group SHALL have: name (required), type (family/friends/colleagues/custom), expense split mode (per_person or per_group), and a display color
8. THE Application SHALL display travellers in a hierarchical view: groups with their members listed under them, plus ungrouped travellers at the bottom
9. THE expense split mode "per_group" SHALL treat the entire group as one unit for expense splitting (e.g., a family of 4 counts as 1 share)

##### Roles & Permissions

10. THE Application SHALL support three roles for trip travellers: **owner** (full control including managing members and deleting the trip), **editor** (add/edit bookings, expenses, events), **viewer** (read-only access)
11. ONLY the trip owner SHALL be able to add or remove travellers from the trip
12. ANY traveller with an account SHALL be able to leave the trip voluntarily, UNLESS they have unsettled shared expenses
13. THE trip owner SHALL be able to transfer ownership to another registered traveller

##### Invitations

14. THE Application SHALL support inviting travellers via: email, phone/SMS, WhatsApp message, or shareable link
15. WHEN inviting via email, THE Application SHALL send an invitation email containing: trip name, destination, dates (if set), a personal message from the inviter, and an accept/decline link
16. THE invitation SHALL have a configurable expiry period (1 day, 3 days, 7 days, 30 days, or never), set by the inviter with a default configurable in the admin panel
17. THE Application SHALL allow the trip owner to resend or cancel pending invitations
18. IF an invited user creates a new Neyya account, THE Application SHALL auto-add them to the trip (or require acceptance first — configurable in admin panel)
19. WHEN an invitation is accepted, THE Application SHALL add the traveller to the trip with the specified role and group

##### Visibility

20. THE trip owner SHALL be able to configure member visibility per trip: **full** (all members see everyone), **group-only** (members see their own group only), or **owner-managed** (only owner sees full list)
21. THE Application SHALL display the member list in the Trip detail page as a "Members" tab showing the hierarchical group structure
22. THE Application SHALL display small avatar icons of trip members on the trip overview cards in the trips list

##### Integration

23. WHEN a traveller is added to a trip, THE Application SHALL automatically add them to the trip's expense group for split calculations
24. WHEN a new traveller joins, THEY SHALL see all existing shared expenses and the settlement summary
25. THE Application SHALL suggest trip traveller names when adding traveller_names to bookings
26. THE Application SHALL notify all active trip members when bookings, expenses, or members change

##### Admin

27. THE admin panel SHALL display trip membership statistics (total memberships, invitations pending, average members per trip)
28. THE admin panel SHALL allow force-adding or force-removing travellers from any trip for support purposes


---

## Requirement 34: My Network (Connected Users)

**User Story:** As a user, I want to maintain a list of travel contacts so that I can quickly add them to future trips without re-entering their details.

### Acceptance Criteria

1. THE Application SHALL provide a "My Network" page at `/connections` with two tabs: Network and Family
2. WHEN a trip invitation is accepted, THE Application SHALL automatically add both users to each other's connections (bidirectional, status: connected)
3. THE Application SHALL allow manual addition of contacts by email (linked if registered, stored if not)
4. THE Application SHALL support connection statuses: connected, invited, declined, blocked
5. THE Application SHALL allow labels on connections: Partner, Family, Friend, Colleague, Travel Buddy, Guide, Other
6. THE Application SHALL support privacy levels: Full (name+email+avatar), Limited (name+avatar), Minimal (display name only)
7. THE Application SHALL provide a suggestions endpoint for trip invite autocomplete (max 50 results)
8. THE Application SHALL display "Select from My Network" in the trip invite modal to auto-fill recipient email
9. THE Application SHALL provide name autocomplete in the Add Member modal showing matching Network and Family contacts
10. WHEN a contact is selected from autocomplete, THE Application SHALL lock email and type fields (read-only) until selection is cleared
11. THE Application SHALL enforce a maximum of 500 connections per user

## Requirement 34b: Family Members

**User Story:** As a user, I want to manage family member profiles with their travel preferences and passport details so they can be quickly added to trips.

### Acceptance Criteria

1. THE Application SHALL support two family member modes: Connected (linked Neyya account) and Managed (no account, user maintains details)
2. THE Application SHALL store per family member: first/last name, relationship, date of birth, gender
3. THE Application SHALL store preferences: dietary restrictions (chip selector), allergies (chip selector), seat preference, meal preference, cabin class
4. THE Application SHALL use the same chip-based UI for dietary/allergies as the user's own Settings preferences (admin-managed options)
5. THE Application SHALL offer 16 IATA standard flight meal codes: STD, VGML, AVML, VJML, RVML, GFML, NLML, DBML, LFML, LSML, BLML, KSML, MOML, HNML, CHML, BBML
6. THE Application SHALL display meal codes in "Label (CODE)" format with descriptions shown on selection
7. THE Application SHALL display disclaimer: "Meal availability may vary by airline and route"
8. THE Application SHALL encrypt passport/ID data with AES-256-GCM and display masked (****XXXX) with click-to-reveal
9. THE Application SHALL allow users to choose not to store passport details at all
10. THE Application SHALL support preference sharing scope: this_trip / all_trips / none (with per-field toggles for dietary, allergies, travel preferences)
11. THE Application SHALL provide a "Family" button in the trip Members tab to quickly add family members to the trip
12. WHEN a child family member is added to a trip, THE Application SHALL auto-set traveller type to "child"
13. THE Application SHALL enforce a maximum of 20 family members per user
14. THE Application SHALL support relationships: spouse, partner, child, parent, sibling, grandparent, other

## Requirement 35: Currency Conversion in Expenses

**User Story:** As a user, I want expenses displayed in my preferred currency with converted amounts so I can understand my spending across multi-currency trips.

### Acceptance Criteria

1. THE Application SHALL provide an exchange rates API endpoint with rates for 40 currencies (USD base)
2. THE Application SHALL convert expense totals to the user's preferred display currency
3. THE Application SHALL show individual expenses with original amount + converted equivalent when currencies differ
4. THE Application SHALL use Intl.NumberFormat for locale-aware currency formatting via I18nProvider
5. THE Application SHALL fetch user's display currency preference via useUserCurrency hook
6. In production, THE Application SHALL refresh exchange rates from Open Exchange Rates API every 24 hours

## Requirement 36: Landing Page & App Internationalization

**User Story:** As an admin, I want all user-facing text to be translatable so the app can be localized to different languages.

### Acceptance Criteria

1. THE Application SHALL maintain 265+ translation keys across 12 namespaces in the translation_keys database table
2. THE Application SHALL provide English translations as fallback in en.json (client-side)
3. THE Application SHALL include translation keys for: landing page (74 keys), flight meals (33 keys), network (10 keys), and all existing features
4. THE Admin Translation Editor SHALL display all translation keys grouped by namespace
5. THE Application SHALL wrap all dashboard pages with I18nProvider for locale-aware formatting
6. THE Application SHALL disable browser caching for dev assets (Cache-Control: no-store) to prevent stale 404 errors


## Requirement 37: Shared Family Visibility

**User Story:** As a user, when I'm connected to someone, I want to see their family members (if they allow it) so I can easily add them to shared trips without asking for details each time.

### Acceptance Criteria

1. THE family_members table SHALL include a `visibility_to_connections` field with values: `private` (default), `connections`, `specific`
2. WHEN visibility is set to `connections`, ALL connected users SHALL be able to see that family member's name, relationship, and shared preferences
3. THE Application SHALL never expose passport/ID details to connections (owner-only access)
4. THE Application SHALL provide `GET /api/connections/:userId/family` to fetch visible family members of a connected user (verifies connection status first)
5. THE `/api/family-members/for-trip` endpoint SHALL return both own family AND connected users' visible family (marked with `source: 'connection'` and `ownerName`)
6. THE Network tab SHALL show a "Family" toggle button on connected users that expands an inline read-only list of their shared family members
7. THE trip Add Member autocomplete SHALL include connected users' visible family members, displayed as "Name — via OwnerName" with badge "Their family"
8. WHEN a connected user's family member is added to a trip, their allergies and dietary preferences SHALL auto-apply to trip recommendation filters
9. Connections SHALL NOT be able to edit another user's family member details (read-only access)
10. THE owner SHALL be able to change visibility at any time via the Edit Family Member modal


## Requirement 38: AI Trip Tips

**User Story:** As a user, I want AI-generated personalized travel advice for my trip so I know what to do, pack, and be cautious about at my destination.

### Acceptance Criteria

1. THE Application SHALL provide an "AI Tips" tab in the trip detail page
2. THE Application SHALL generate personalized tips in 8 categories: activities, packing, precautions, culture, food, transport, budget, documents
3. THE tips SHALL be personalized based on: trip destination/dates, user dietary/allergies, family members (including children)
4. Each tip SHALL contain: title, markdown content, and a checkable checklist of actionable items
5. THE Application SHALL allow users to favorite tips (appear in favorites list) and dismiss tips (hidden from view)
6. THE Application SHALL cache generated tips for 7 days with a "Regenerate Tips" button for on-demand refresh
7. THE Application SHALL provide a chat follow-up section where users can ask destination-specific questions
8. THE chat SHALL maintain conversation history (up to 50 messages per trip)
9. THE Application SHALL use tiered LLM: mock in dev, AWS Bedrock (Nova Lite → Haiku escalation) in production
10. Checklist items SHALL persist their checked state across sessions
11. Tips SHALL be shareable with trip members (visible to all members on the same trip)
12. Generated tips SHALL include source attribution (AI model used, generation date)
13. THE Application SHALL support offline access for previously generated tips (cached)
14. Each tip card SHALL have a per-card AI interaction: user can type a question specific to that category and get an inline AI response
15. THE Application SHALL support a "Nearby Tips" mode using the device's current GPS location to show local attractions and activities
16. THE Admin Configuration panel SHALL provide controls for: enabling/disabling each tip category, per-card AI chat toggle, location-based tips toggle, web search enhancement toggle, and cache duration setting


## Requirement 39: Weather Integration

**User Story:** As a user, I want to see the weather forecast for my trip destination so I can plan activities and pack appropriately.

### Acceptance Criteria

1. THE Application SHALL provide a "Weather" tab in the trip detail page showing day-by-day forecast
2. Each forecast day SHALL display: high/low temperature, weather condition icon, precipitation %, humidity, wind speed, UV index
3. THE trip Overview tab SHALL show a weather preview widget (first 5 days, horizontal scrollable strip)
4. THE Application SHALL show weather alerts (rain, heat, cold, wind) with color-coded severity and suggestions
5. THE Application SHALL support live GPS weather via "📍 Live Weather" button using device location
6. THE Application SHALL show home location weather for comparison on the Weather tab
7. THE Application SHALL use OpenWeatherMap API in production (env: OPENWEATHERMAP_API_KEY)
8. THE Application SHALL provide mock weather data in development (destination-aware: Italy=hot, London=mild, etc.)
9. Weather data SHALL respect user's temperature unit preference (°C/°F from Settings)
10. THE Application SHALL provide GET /api/trips/:tripId/weather, GET /api/weather/location, GET /api/weather/alerts/:tripId endpoints
11. Weather alerts SHALL trigger notifications when significant changes are detected (rain, heat waves)
12. THE Application SHALL show multi-location weather when trip covers multiple destinations


## Requirement 40: Messaging & Communications

**User Story:** As a user, I want to message my travel network, trip groups, and family so we can plan trips collaboratively, make decisions together, and get AI-powered suggestions in chat.

### Conversation Types

1. **Direct Message (DM)**: 1-to-1 with any connection from My Network
2. **Group Chat**: multiple selected people (custom groups, not trip-specific)
3. **Family Chat**: with family members who have accounts
4. **Trip Chat**: attached to a specific trip — all trip members can see/reply
5. **Broadcast**: one-way announcement from trip owner/co-owner to all trip members (no replies)

### Core Messaging (Phase 1)

1. THE Application SHALL provide a "Messages" page in the sidebar for DM, group, and family conversations
2. THE Application SHALL provide a "Chat" tab within each trip detail page for trip-specific messaging
3. All messages SHALL support threaded replies (reply to a specific message creates a thread)
4. Threads SHALL be expandable/collapsible inline
5. THE Application SHALL show unread message count as a badge on the notification icon and sidebar "Messages" link
6. Users SHALL be able to create group conversations by selecting multiple contacts from My Network
7. Messages SHALL support text content with basic formatting (bold, italic, links)
8. Messages SHALL support URL unfurling (link previews with title, description, image)
9. Messages SHALL support multimedia attachments (images, max 10MB)
10. Users SHALL be able to delete their own messages
11. Messages SHALL show read receipts (seen by X people in groups/trips)
12. Messages SHALL be archived (not deleted) when a trip completes — accessible for future reference

### AI Integration (Phase 2)

13. Users SHALL be able to invoke AI via `@AI` mention in any chat message
14. AI SHALL respond with context-aware suggestions (trip destination, dates, member preferences)
15. Other participants SHALL be able to react/vote on AI suggestions before marking for trip
16. THE Application SHALL support emoji reactions on any message (👍❤️😂🎉👎 + custom)
17. THE Application SHALL support formal polls: question + multiple options, members vote, results visible
18. A thread or message SHALL be "promotable" to a Trip Decision (moved to Trip Decisions list)

### Trip Decisions (Phase 2)

19. THE Application SHALL maintain a "Trip Decisions" list per trip (items promoted from chat)
20. Trip Decisions SHALL have status: proposed, voting, approved, rejected
21. Approved decisions SHALL be promotable to: AI Tips (user-contributed), Favorites, or Timeline events
22. Each decision SHALL show who proposed it and vote tally

### Real-Time & Notifications (Phase 3)

23. Messages SHALL appear in real-time without page refresh (WebSocket via Socket.io)
24. THE Application SHALL show typing indicators ("Alice is typing...")
25. THE Application SHALL show online/offline presence indicators
26. THE Application SHALL send in-app notification badges for new messages
27. THE Application SHALL support email notifications for unread messages (configurable: immediate/hourly digest/off)
28. THE Application SHALL support push notifications for mobile (future: React Native)
29. THE Application SHALL support WhatsApp/SMS notifications via external API integration (Twilio, configurable)

### Broadcast Messages

30. Trip owners and co-owners SHALL be able to send broadcast announcements to all trip members
31. Broadcasts SHALL be visually distinct (announcement banner style, not regular chat bubble)
32. Broadcasts SHALL NOT allow replies (one-way communication)

### Admin Configuration

33. Admin SHALL be able to enable/disable messaging globally
34. Admin SHALL be able to enable/disable trip chat separately from sidebar messages
35. Admin SHALL configure max message length (default: 5000 chars)
36. Admin SHALL configure max participants per group chat (default: 50)
37. Admin SHALL toggle AI assistant availability in chats
38. Admin SHALL configure broadcast permissions (owner-only vs owner+co-owners)
39. Admin SHALL configure message retention policy (keep forever / archive after trip / auto-delete after X days)
40. Admin SHALL configure notification channels (in-app, email, WhatsApp, SMS toggles)

### Acceptance Criteria Summary

- 40 acceptance criteria covering all 3 phases
- DB: conversations, messages, reactions, polls, trip_decisions tables
- API: full CRUD for conversations, messages, threads, reactions, polls, decisions
- WebSocket: real-time delivery, typing indicators, presence
- UI: Messages page (sidebar) + Trip Chat tab + notification badges
- E2E tests covering core messaging flows


## Requirement 41: Customizable Dashboard

**User Story:** As a user, I want a dashboard with widgets that give me an at-a-glance view of my trips, expenses, messages, and more, and I want to customize which widgets I see.

### Acceptance Criteria

1. THE Dashboard SHALL be the landing page after login
2. THE Dashboard SHALL display widgets in a responsive grid (1/2/3 columns based on screen)
3. Users SHALL be able to customize their widget layout via a "Customize" modal (add/remove from master list)
4. Widget preferences SHALL be persisted per-user via GET/PUT /api/users/me/dashboard-config
5. THE Application SHALL provide 10 available widgets: Quick Actions, Upcoming Trips, Recent Expenses, Messages, Network, Weather, AI Tips, Trip Decisions, Bookings, Favorites
6. Quick Actions widget SHALL provide links to: New Trip, Add Expense, Start Chat, Search, Network, Settings
7. Each data widget SHALL fetch its own data and provide a "View all →" link to the full page
8. Admin SHALL be able to enable/disable individual widgets globally (disabled widgets hidden from user customization)
9. Users SHALL be able to reset to default widget layout
10. THE default layout SHALL include: Quick Actions, Upcoming Trips, Expenses, Messages, Network, Weather, AI Tips


## Requirement 42: Email Aliases (Multi-Email Account)

**User Story:** As a user, I want to add multiple email addresses to my account so that booking confirmations forwarded from any of my emails are matched to my account.

### Acceptance Criteria

1. Users SHALL be able to add alternate email addresses in Settings → Profile & Account (new "Email Aliases" section)
2. Adding an alias SHALL require email verification (verification link sent to the alternate email)
3. When a user connects a Gmail/Outlook account, that email SHALL be auto-added as a verified alias
4. THE email forwarding system (trips@neyya.ai) SHALL match incoming emails against both primary email AND all verified aliases
5. THE matching priority SHALL be: primary email → verified aliases → unclaimed booking storage
6. Login with alias email SHALL be configurable by admin (same password as primary account)
7. Max number of aliases per user SHALL be admin-configurable (default: 5, options: 5/10/15)
8. Aliases SHALL be purely internal — not visible to other users, not shown in My Network
9. Users SHALL be able to remove an alias at any time (unlinks from account)
10. THE Application SHALL prevent adding an alias that belongs to another user's primary email or verified alias
11. Alias verification tokens SHALL expire after 24 hours
12. Admin SHALL be able to configure: max aliases, login-with-alias toggle, verification requirement toggle


## Requirement 43: Subscription & Pricing (Freemium Model)

**User Story:** As a user, I want a freemium service with tiered plans so I can use basic features for free and upgrade for advanced capabilities.

### Plans & Pricing (admin-configurable)

| Plan | Individual | Family (up to 5) | Annual Individual | Annual Family |
|------|-----------|------------------|-------------------|---------------|
| Free | €0 | — | — | — |
| Pro | €14.99/mo | €24.99/mo | €149.99/yr | €249.99/yr |
| Premium | €29.99/mo | €44.99/mo | €299.99/yr | €449.99/yr |

### Feature Limits by Tier

| Feature | Free | Pro | Premium |
|---------|------|-----|---------|
| Active trips | 3 | Unlimited | Unlimited |
| Bookings | 10 | Unlimited | Unlimited |
| Expenses/month | 20 | Unlimited | Unlimited |
| AI Tips generations | 1/trip | Unlimited | Unlimited + priority model |
| AI Chat messages | 5/day | Unlimited | Unlimited |
| Email connections | 1 | 3 | 5 |
| Network connections | 20 | 200 | 500 |
| Family members | 3 | 10 | 20 |
| Document storage | 100MB | 5GB | 25GB |
| Messages/day | 50 | Unlimited | Unlimited |
| Weather forecast | 3-day | 14-day + alerts | 14-day + alerts + historical |
| Expense splitting | Equal only | All modes | All modes |
| Polls & Trip Decisions | ❌ | ✅ | ✅ |
| Email aliases | 1 | 5 | 15 |
| Shared family visibility | ❌ | ❌ | ✅ |
| Broadcast messages | ❌ | ❌ | ✅ |
| Multi-currency conversion | ❌ | ✅ | ✅ |
| Data export (PDF/CSV) | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ |

### Acceptance Criteria

1. New users SHALL receive a 30-day free trial with ALL features (Premium-level access)
2. After trial, users SHALL receive a 7-day grace period with warnings before downgrade to Free
3. THE Application SHALL show soft upgrade prompts when approaching limits, then hard-block at 2x free limit
4. Subscription SHALL be managed via Stripe (Checkout, Customer Portal, Webhooks)
5. Prices SHALL be displayed in the user's preferred display currency (converted from EUR base)
6. Auto-renewal SHALL be the default; users can disable in Settings (configurable in admin)
7. Family plan: one person (plan owner) pays, adds/removes members, all get same tier features
8. Family plan members SHALL be manageable in Settings → Subscription → Family Members
9. Admin SHALL be able to configure: all tier prices, feature limits, trial duration, grace period
10. Admin SHALL be able to grant individual users free Premium access (grandfathering/promotions)
11. Admin SHALL be able to create campaigns: discount codes with % off, duration, usage limits
12. THE Application SHALL enforce feature limits in the API (return 403 with upgrade message when limit exceeded)
13. THE Application SHALL show a Pricing page (public) and a Subscription page (authenticated, in Settings)
14. Stripe webhooks SHALL handle: subscription created, renewed, cancelled, payment failed
15. THE Application SHALL support annual billing with 2-months-free discount
16. Payment failure SHALL trigger 3 retry attempts over 7 days before downgrade
17. Users SHALL be able to cancel anytime (access continues until end of billing period)
18. Cancelled users SHALL keep their data but lose premium feature access


### Requirement 34: My Network (User Connections)

**Status:** Implemented

Users can build a personal travel network by connecting with other users.

**Acceptance Criteria:**
- 34.1: Users can add connections by email or name
- 34.2: Connection invitations sent and accepted/declined
- 34.3: Auto-connect when an invited user accepts
- 34.4: Network page shows all connections with labels (friend/family/colleague)
- 34.5: Privacy settings per connection (full/limited visibility)
- 34.6: Family tab shows connected users' family members (if allowed by owner)
- 34.7: Connection limits enforced per subscription plan

### Requirement 35: Family Members

**Status:** Implemented

Users can manage family member profiles with travel details, encrypted sensitive data.

**Acceptance Criteria:**
- 35.1: Add family members with name, DOB, nationality, relationship
- 35.2: Passport data encrypted with AES-256-GCM (PII_ENCRYPTION_KEY)
- 35.3: 16 IATA meal codes supported
- 35.4: Allergies and dietary preferences use same admin-managed data set
- 35.5: Masked passport display (****XXXX) in UI
- 35.6: Family members visible to connected users if sharing enabled
- 35.7: Member limits enforced per subscription plan

### Requirement 36: AI Trip Tips

**Status:** Implemented

AI-powered travel tips organized by category with interactive checklist items.

**Acceptance Criteria:**
- 36.1: 8 tip categories (packing, safety, culture, budget, transport, health, food, tech)
- 36.2: Per-card AI interaction (ask follow-up questions)
- 36.3: Checklist items users can mark complete
- 36.4: Location-aware mode (tips based on destination)
- 36.5: Tips limit per trip enforced by subscription plan

### Requirement 37: Weather Integration

**Status:** Implemented

Weather forecasts for trip destinations displayed in trips and dashboard.

**Acceptance Criteria:**
- 37.1: Weather tab in trip detail showing forecast
- 37.2: Dashboard weather widget for upcoming trips
- 37.3: Forecast days determined by subscription plan (3-day free, 14-day paid)
- 37.4: Weather data fetched from forecast API
- 37.5: Admin-configurable weather settings

### Requirement 38: Messaging & Trip Chat

**Status:** Implemented

Real-time messaging between connected users and within trips.

**Acceptance Criteria:**
- 38.1: Direct messaging between connected users
- 38.2: Trip group chat for trip members
- 38.3: Polls and voting in conversations
- 38.4: Trip decisions promoted from chat
- 38.5: @AI mentions for AI assistance in chat
- 38.6: Message reactions
- 38.7: Daily message limits enforced per subscription plan
- 38.8: 7 DB tables, 14 API endpoints

### Requirement 39: Customizable Dashboard

**Status:** Implemented

Users can customize their dashboard with configurable widgets.

**Acceptance Criteria:**
- 39.1: 10 widget types (upcoming trips, weather, expenses, network, tips, bookings, map, activity, messages, quick actions)
- 39.2: User-persisted widget configuration (show/hide, order)
- 39.3: Quick Actions widget always rendered at top (outside grid)
- 39.4: Widget state saved per user via API

### Requirement 40: Subscriptions & Tiered Plans

**Status:** Implemented

Freemium service with 3 tiers, 30-day trial, Stripe integration, admin management.

**Acceptance Criteria:**
- 40.1: Three plans — Free, Pro (EUR 14.99/mo), Premium (EUR 29.99/mo)
- 40.2: 30-day free trial with full Premium access for all new users
- 40.3: Monthly and annual billing (annual saves 2 months)
- 40.4: Family plan pricing on Pro and Premium
- 40.5: Stripe checkout stubs (production-ready hooks)
- 40.6: Campaign discount codes (admin-managed, user-entered at checkout)
- 40.7: Promotional pricing with strikethrough display and themed banners
- 40.8: Seasonal event promotions (pre-scheduled, auto-activate by date)
- 40.9: Admin plan editing persists to DB, reflects in pricing page immediately
- 40.10: Plan badge (Pro/Premium) shown next to logo in dashboard
- 40.11: Upgrade nav item hidden when already on paid plan
- 40.12: Public pricing page with plan comparison
- 40.13: Settings subscription section with cancel/reactivate

### Requirement 41: Email Aliases

**Status:** Implemented

Users can add multiple email addresses for booking recognition.

**Acceptance Criteria:**
- 41.1: Add email aliases with verification flow (token-based)
- 41.2: Verified aliases match incoming bookings
- 41.3: Remove aliases from Settings
- 41.4: Alias limits enforced per subscription plan
- 41.5: Admin-configurable alias settings

### Requirement 42: In-House Analytics

**Status:** Implemented

Click and engagement tracking with admin analytics dashboard.

**Acceptance Criteria:**
- 42.1: Auto page view tracking on all dashboard routes
- 42.2: Feature usage and click event tracking
- 42.3: Batch event submission support
- 42.4: Admin analytics page: total events, today, active users (7-day)
- 42.5: Top pages and top features charts
- 42.6: Events by day (30-day bar chart)
- 42.7: Session-based anonymous tracking for non-logged-in users

### Requirement 43: Promotional Pricing & Events

**Status:** Implemented

Time-limited promotions with crossed-out prices and seasonal event scheduling.

**Acceptance Criteria:**
- 43.1: Admin creates promotions with discount %, date range, applicable plans
- 43.2: Pricing page shows original price crossed out in red with discounted price
- 43.3: Themed banner on pricing page during active promotion
- 43.4: Event types: summer, christmas, black_friday, new_year, easter, flash_sale, etc.
- 43.5: Pre-scheduled promotions auto-activate on start date
- 43.6: Admin timeline/calendar view showing all events as Gantt bars
- 43.7: Pause/activate/edit/delete promotions from admin
- 43.8: Promotion theme color, banner emoji, and badge text configurable

### Requirement 44: Plan Limit Enforcement

**Status:** Implemented

Subscription plan limits enforced server-side on all resource creation endpoints.

**Acceptance Criteria:**
- 44.1: checkPlanLimit middleware checks user plan before resource creation
- 44.2: Trips limited by max_active_trips
- 44.3: Expenses limited by max_expenses_per_month (monthly reset)
- 44.4: Messages limited by max_messages_per_day (daily reset)
- 44.5: Network connections limited by max_network_connections
- 44.6: Family members limited by max_family_members
- 44.7: Email aliases limited by max_email_aliases
- 44.8: 403 PLAN_LIMIT_REACHED response with upgrade URL
- 44.9: Client-side UpgradePrompt component for limit errors
- 44.10: Admin plan limit changes take effect immediately (no deploy)


### Requirement 45: Email Delivery Service

**Status:** Implemented

Abstracted email service with provider support, admin-editable templates, and configurable sender addresses.

**Acceptance Criteria:**
- 45.1: Abstracted email service with provider interface (SES, SendGrid, or console)
- 45.2: HTML email templates branded with Neyya.ai (stored in DB, admin-editable)
- 45.3: 6 templates: email verification, password reset, trip invitation, alias verification, subscription confirmation, welcome email
- 45.4: Environment-based provider selection (SES in prod, console in dev)
- 45.5: Retry logic for failed sends (3 attempts with exponential backoff)
- 45.6: Send logging to email_send_log table (status, attempts, errors)
- 45.7: Admin → Email Templates page: edit subject + HTML body, preview, test send
- 45.8: Multiple sender addresses: admin-configurable per purpose (transactional, booking, support, marketing, notifications)
- 45.9: Reply-to configuration per template
- 45.10: Admin → Sender Addresses: add/remove/verify addresses
- 45.11: Admin → Send Log: view history of all emails sent (to, template, status, time)


## Requirement 44: Trip Photos & Gallery

**Priority:** High (Premium Feature)  
**Status:** UI Stub Only (implementation deferred to mobile app phase)  
**Plan Gate:** Free=0 uploads, Pro=500MB, Premium=Unlimited (configurable in admin)

### Description

Users can upload, organize, and share photos within their trips. Photos are stored encrypted in S3, categorized by trip, and accessible from both the trip detail view and a global "Photos" section in the left sidebar.

### Upload Sources
- Mobile camera (direct capture)
- Phone camera roll / gallery
- Desktop file picker
- Future: Auto-sync from phone gallery (background upload of new photos taken during trip dates)

### Storage & Security
- Photos stored in S3 with server-side encryption (AES-256)
- Optional client-side encryption for sensitive photos
- Thumbnails generated automatically (multiple sizes for performance)
- EXIF data extracted for date/location metadata, then stripped from shared copies (privacy)

### Organization
- **Albums** within a trip (e.g., "Day 1", "Food & Restaurants", "Landmarks")
- **Tags/labels** — user-defined (e.g., "sunset", "group photo", "food")
- **Date-based auto-grouping** from EXIF data
- **Drag-and-drop reordering** within albums

### Visibility & Privacy
- **Personal** — only the uploader can see (default for uploads)
- **Shared** — all trip members can view
- **Visibility changeable** after upload (toggle per photo or bulk)
- **Connection sharing** — if enabled by uploader, network connections can see shared photos
- **Public link** — generate a shareable link for non-members (time-limited, optional)

### Interactions (on shared photos)
- Like/react (emoji reactions)
- Comments (text comments on individual photos)
- Download — trip members can download shared photos
- Flag/report inappropriate content

### Global Photos View (Left Sidebar)
- Shows ALL photos across ALL trips for the user
- Filterable by: trip, date range, album, visibility (personal/shared), tags
- Grid view with masonry layout
- Slideshow mode

### Plan Configuration (Admin)
- Storage limit per tier (configurable in admin subscription management)
- Upload count limit per month (optional)
- Feature toggle: photo sharing, comments, public links
- Free tier: disabled or limited (e.g., 10 photos total as a teaser)

### Acceptance Criteria
1. User can upload photos from camera/gallery/desktop within a trip
2. Photos display in a "Photos" tab within the trip detail view
3. User can create albums and assign photos to them
4. User can tag photos and filter by tags
5. Photos auto-group by date (from EXIF or upload date)
6. User can toggle visibility between personal and shared
7. Trip members can see shared photos, like them, and comment
8. Global "Photos" in sidebar shows all user photos with trip filter
9. Storage limits enforced per subscription tier
10. Photos stored encrypted in S3
11. Admin can configure storage limits per plan
12. Premium upgrade prompt shown to Free users attempting to upload

---

## Requirement 45: AI-Powered Social Sharing

**Priority:** Medium (Premium Feature)  
**Status:** UI Stub Only (implementation deferred)  
**Plan Gate:** Premium only (with upgrade hook for Free/Pro users)

### Description

AI generates engaging, shareable content (text + selected photos) from trip data that users can post to social media platforms. The flow is: AI generates → user reviews/edits → one-click share or copy.

### AI Content Generation

**Inputs used by AI:**
- Trip destination, dates, and itinerary
- Places visited (from bookings + timeline)
- User-selected photos from the trip
- User prompt (optional — "What do you want to highlight?")
- Tone preference selection

**Tone Options:**
- Casual ("Had the best time exploring Barcelona!")
- Professional ("Business trip to NYC with some cultural highlights")
- Funny ("My GPS said turn left. I turned left into a gelato shop. No regrets.")
- Inspirational ("There's something about watching the sun set over Santorini...")
- Custom prompt

**Output:**
- Platform-appropriate text (character limits respected: Twitter 280, Instagram 2200, Facebook unlimited)
- Suggested hashtags (auto-generated from destination + activities)
- Photo selection (AI picks 1-4 best photos from trip gallery)
- Optional shareable card/image (collage with text overlay)

### Sharing Flow

**V1 (Launch):**
1. User triggers share (from trip menu or post-trip prompt)
2. Select tone + optional prompt
3. AI generates text + selects photos
4. User reviews in preview (can edit text)
5. "Copy to clipboard" + "Open [Facebook/Twitter/Instagram]" buttons
6. User pastes in social platform

**V2 (Future):**
1. User connects social accounts (OAuth) in Settings → Connected Social Accounts
2. Same generation flow
3. One-click "Post to Facebook" / "Post to Instagram" / "Post to Twitter"
4. Direct API posting (requires platform app approval)

### Sharing Triggers
- **Post-trip prompt** — after trip end date, show "Share your trip highlights?" notification
- **Daily highlight** — during trip, offer "Share today's highlight" (end of day)
- **Manual** — "Share" button in trip menu anytime
- **After uploading photos** — suggest sharing after batch upload

### Social Platforms
- Facebook (text + photos)
- Twitter/X (text + photo, respect 280 char limit)
- Instagram (photo + caption)
- WhatsApp (text + link)
- LinkedIn (text + photo, professional tone default)
- Copy link (generic)

### Settings Section
- Connected social accounts (OAuth tokens)
- Default tone preference
- Auto-suggest sharing (on/off)
- Daily highlight notifications (on/off)

### Premium Gate & Upgrade Hook
- Free users: see the "Share" button, get a preview of what AI would generate (blurred/truncated), then "Upgrade to Premium to unlock AI Sharing"
- Pro users: limited to 3 AI-generated shares per trip
- Premium users: unlimited

### Acceptance Criteria
1. User can trigger social sharing from trip menu or post-trip prompt
2. User can select tone (casual/professional/funny/inspirational/custom)
3. AI generates platform-appropriate text with hashtags
4. AI selects best photos from trip gallery for the share
5. User can review and edit generated text before sharing
6. "Copy to clipboard" works for all platforms (V1)
7. Platform-specific buttons open the social network with pre-filled content where possible
8. Post-trip notification prompts user to share highlights
9. Settings page has Connected Social Accounts section (stub)
10. Free/Pro users see upgrade prompt when trying to generate
11. Admin can toggle feature and configure per-plan limits
12. Share history shown in trip (what was shared and when)

---

## Requirement 46: Trip Card Header Images

**Priority:** Low (UI Enhancement)  
**Status:** Ready to Implement

### Description

Each trip card in the "My Trips" list displays a relevant destination hero image as the card header. Images are sourced from Unsplash based on the trip's destination/city name.

### Acceptance Criteria
1. Trip cards display a destination-relevant header image
2. Images are fetched from Unsplash CDN (no API key needed for static URLs)
3. If no destination is set, show a generic travel placeholder
4. Images are lazy-loaded for performance
5. Image can be customized by user (upload own header photo) in future


## Requirement 47: CRM & Marketing Automation Platform

**Priority:** High  
**Status:** Phase A in progress  
**Full spec:** #[[file:docs/crm-marketing-requirements.md]]

### Description

Built-in CRM and marketing automation system in the admin panel. Manages lead capture, email campaigns (AI-powered), social media campaigns, and analytics. Eliminates need for external tools like Mailchimp/HubSpot.

### Key Components
1. **Lead capture** — landing page form with CAPTCHA, email validation, geo-detection, travel preferences
2. **Contact management** — lifecycle tracking (Lead→Free→Trial→Pro→Premium→Churned), segments, tags
3. **AI email campaigns** — Bedrock-powered content generation, automated sequences (welcome, trial conversion, re-engagement)
4. **Social media campaigns** — AI content creation for Facebook, Instagram, Twitter, LinkedIn, TikTok (organic + paid ads)
5. **Analytics** — email opens/clicks, social engagement/reach, conversion tracking, ROAS for ads
6. **GDPR compliance** — cookie consent, privacy policy, terms of service, consent records

### Acceptance Criteria
1. Landing page has lead capture form with name, email, country (auto-detect), travel style, trips/year
2. Form protected by reCAPTCHA v3 + email validation (format + MX)
3. Leads stored in database with source tracking (UTM, referrer)
4. Admin CRM shows all contacts with search, segments, lifecycle stage
5. Welcome email series triggered automatically on lead signup
6. Trial conversion series triggered on trial start
7. AI generates email content from prompt + tone selection
8. Social media posts can be created, scheduled, and published from admin
9. AI generates platform-specific content (text + image + hashtags)
10. Email analytics: open rate, click rate, unsubscribe rate
11. Social analytics: impressions, engagement, follower growth
12. Cookie consent banner with accept/reject/customize
13. Privacy Policy, Terms of Service, Cookie Policy pages exist
14. Registration form includes Terms consent checkbox
15. All consent records auditable (GDPR compliance)

---

## Requirement 48: GDPR Compliance & Legal Pages

**Priority:** Critical (legal requirement)  
**Status:** Not started

### Pages Required
- `/privacy` — Privacy Policy
- `/terms` — Terms of Service
- `/cookies` — Cookie Policy

### Registration Updates
- Terms of Service checkbox (required)
- Marketing consent checkbox (optional, pre-unchecked)
- Consent timestamp + policy version stored

### Cookie Consent
- GDPR-compliant banner on first visit
- Categories: Essential, Analytics, Marketing
- Accept All / Reject All / Customize
- Cookie stored + database record for audit

### Acceptance Criteria
1. Privacy Policy page exists and covers: data collected, storage, sharing, user rights
2. Terms of Service page exists and covers: usage rules, liability, termination
3. Cookie Policy page lists all cookies used
4. Cookie banner appears on first visit with category options
5. Registration form requires Terms acceptance
6. Consent records stored with timestamp + version
7. Users can withdraw consent from settings
8. Data export available on request (GDPR Article 20)
9. Account deletion removes all PII (GDPR Article 17)
