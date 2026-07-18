/**
 * Email Parser Service
 *
 * Detects booking confirmation emails and extracts structured data
 * using AWS Comprehend for classification and entity extraction,
 * with regex fallback for common confirmation email formats.
 *
 * Implements Requirements: 2.3, 2.4, 2.5, 2.9
 */

import {
  ComprehendClient,
  ClassifyDocumentCommand,
  DetectEntitiesCommand,
} from '@aws-sdk/client-comprehend';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FlightFields {
  airline: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  departureAirport: string;
  arrivalAirport: string;
}

export interface HotelFields {
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  address: string;
}

export interface CarRentalFields {
  company: string;
  pickupDate: string;
  returnDate: string;
  pickupLocation: string;
  returnLocation: string;
}

export type BookingType = 'flight' | 'hotel' | 'car_rental';

export interface ExtractedBooking {
  type: BookingType;
  confidence: number; // 0-1 extraction confidence
  fields: Partial<FlightFields | HotelFields | CarRentalFields>;
  missingFields: string[];
  sourceEmailId: string;
}

export interface EmailParserConfig {
  region: string;
  classifierArn?: string; // Custom classifier endpoint ARN
}

export interface EmailContent {
  id: string;
  from: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
}

export interface ClassificationResult {
  isBookingConfirmation: boolean;
  bookingType: BookingType | null;
  confidence: number;
}

// ─── Required Fields by Booking Type ─────────────────────────────────────────

const REQUIRED_FLIGHT_FIELDS: (keyof FlightFields)[] = [
  'airline',
  'flightNumber',
  'departureTime',
  'arrivalTime',
  'departureAirport',
  'arrivalAirport',
];

const REQUIRED_HOTEL_FIELDS: (keyof HotelFields)[] = [
  'hotelName',
  'checkInDate',
  'checkOutDate',
  'address',
];

const REQUIRED_CAR_RENTAL_FIELDS: (keyof CarRentalFields)[] = [
  'company',
  'pickupDate',
  'returnDate',
  'pickupLocation',
  'returnLocation',
];

// ─── Regex Patterns ──────────────────────────────────────────────────────────

/** Flight number patterns: 2-letter IATA code followed by 1-4 digits */
const FLIGHT_NUMBER_REGEX = /\b([A-Z]{2})\s?(\d{1,4})\b/g;

/** Airport codes: 3-letter IATA codes in context */
const AIRPORT_CODE_REGEX = /\b([A-Z]{3})\b/g;

/** Common airline names */
const AIRLINE_NAMES = [
  'Delta', 'United', 'American Airlines', 'Southwest',
  'JetBlue', 'Alaska Airlines', 'Spirit', 'Frontier',
  'British Airways', 'Lufthansa', 'Air France', 'Emirates',
  'Qatar Airways', 'Singapore Airlines', 'KLM', 'Ryanair',
  'EasyJet', 'Air Canada', 'Qantas', 'Virgin Atlantic',
];

/** Common hotel brands */
const HOTEL_BRANDS = [
  'Hilton', 'Marriott', 'Hyatt', 'IHG', 'Sheraton',
  'Holiday Inn', 'Best Western', 'Radisson', 'Wyndham',
  'Four Seasons', 'Ritz-Carlton', 'Hampton Inn', 'Courtyard',
  'Residence Inn', 'DoubleTree', 'Embassy Suites', 'Westin',
  'W Hotel', 'Fairmont', 'Accor', 'Novotel', 'ibis',
];

/** Common car rental companies */
const CAR_RENTAL_COMPANIES = [
  'Hertz', 'Avis', 'Enterprise', 'Budget', 'National',
  'Alamo', 'Dollar', 'Thrifty', 'Sixt', 'Europcar',
  'Turo', 'Zipcar',
];

/** Date patterns: various common formats */
const DATE_PATTERNS = [
  // Jan 15, 2024 or January 15, 2024
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  // 2024-01-15
  /\b(\d{4})-(\d{2})-(\d{2})\b/g,
  // 01/15/2024 or 15/01/2024
  /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
];

/** Time patterns */
const TIME_PATTERNS = [
  // 10:30 AM/PM
  /\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)\b/g,
  // 14:30 or 9:30
  /\b(\d{1,2}):(\d{2})\b/g,
];

/** Check-in/out keywords */
const CHECKIN_KEYWORDS = ['check-in', 'check in', 'checkin', 'arrival'];
const CHECKOUT_KEYWORDS = ['check-out', 'check out', 'checkout', 'departure'];

/** Pickup/return keywords for car rental */
const PICKUP_KEYWORDS = ['pick-up', 'pick up', 'pickup', 'collection'];
const RETURN_KEYWORDS = ['return', 'drop-off', 'drop off', 'dropoff'];

// ─── Email Parser Service ────────────────────────────────────────────────────

export class EmailParserService {
  private readonly client: ComprehendClient;
  private readonly classifierArn?: string;

  constructor(config: EmailParserConfig) {
    this.client = new ComprehendClient({ region: config.region });
    this.classifierArn = config.classifierArn;
  }

  /**
   * Main orchestrator: classifies the email, extracts booking details,
   * and validates the result.
   */
  async parseEmail(email: EmailContent): Promise<ExtractedBooking | null> {
    const text = email.textBody || stripHtml(email.htmlBody ?? '');

    // Step 1: Classify the email
    const classification = await this.classifyEmail(text);
    if (!classification.isBookingConfirmation || !classification.bookingType) {
      return null;
    }

    // Step 2: Extract booking details (Comprehend + regex fallback)
    const fields = await this.extractBookingDetails(text, classification.bookingType);

    // Step 3: Determine missing fields and confidence
    const requiredFields = getRequiredFields(classification.bookingType);
    const presentFields = Object.keys(fields).filter(
      (key) => fields[key as keyof typeof fields] !== undefined && fields[key as keyof typeof fields] !== '',
    );
    const missingFields = requiredFields.filter((f) => !presentFields.includes(f));
    const confidence = requiredFields.length > 0
      ? presentFields.length / requiredFields.length
      : 0;

    return {
      type: classification.bookingType,
      confidence,
      fields,
      missingFields,
      sourceEmailId: email.id,
    };
  }

  /**
   * Classify whether an email is a booking confirmation using AWS Comprehend.
   * Falls back to keyword-based classification if no custom classifier is configured.
   */
  async classifyEmail(text: string): Promise<ClassificationResult> {
    // Try AWS Comprehend custom classifier if configured
    if (this.classifierArn) {
      try {
        const command = new ClassifyDocumentCommand({
          Text: text.slice(0, 5000), // Comprehend max text limit
          EndpointArn: this.classifierArn,
        });

        const response = await this.client.send(command);
        const classes = response.Classes ?? [];

        // Find the highest-confidence booking class
        const bookingClass = classes
          .filter((c) => c.Name && ['flight', 'hotel', 'car_rental'].includes(c.Name))
          .sort((a, b) => (b.Score ?? 0) - (a.Score ?? 0))[0];

        if (bookingClass && (bookingClass.Score ?? 0) > 0.7) {
          return {
            isBookingConfirmation: true,
            bookingType: bookingClass.Name as BookingType,
            confidence: bookingClass.Score ?? 0,
          };
        }

        // Check if classified as non-booking with high confidence
        const nonBooking = classes.find((c) => c.Name === 'non_booking');
        if (nonBooking && (nonBooking.Score ?? 0) > 0.8) {
          return { isBookingConfirmation: false, bookingType: null, confidence: 0 };
        }
      } catch {
        // Fall through to keyword-based classification on Comprehend error
      }
    }

    // Keyword-based fallback classification
    return this.classifyWithKeywords(text);
  }

  /**
   * Keyword-based classification fallback.
   */
  private classifyWithKeywords(text: string): ClassificationResult {
    const lowerText = text.toLowerCase();

    // Check for confirmation-related keywords (match word stems/variants)
    const hasConfirmation = /\b(confirm(?:ed|ation)?|book(?:ed|ing)|reserv(?:ed|ation)|itinerary|e-?ticket)\b/i.test(text);
    if (!hasConfirmation) {
      return { isBookingConfirmation: false, bookingType: null, confidence: 0 };
    }

    // Score each booking type
    const flightScore = this.scoreFlightKeywords(lowerText, text);
    const hotelScore = this.scoreHotelKeywords(lowerText);
    const carScore = this.scoreCarRentalKeywords(lowerText);

    const maxScore = Math.max(flightScore, hotelScore, carScore);

    if (maxScore < 2) {
      return { isBookingConfirmation: false, bookingType: null, confidence: 0 };
    }

    let bookingType: BookingType;
    if (flightScore === maxScore) bookingType = 'flight';
    else if (hotelScore === maxScore) bookingType = 'hotel';
    else bookingType = 'car_rental';

    // Normalize confidence: 2 keywords = 0.5, 4+ = 0.9
    const confidence = Math.min(0.9, 0.25 * maxScore);

    return { isBookingConfirmation: true, bookingType, confidence };
  }

  private scoreFlightKeywords(lowerText: string, originalText: string): number {
    let score = 0;
    if (/\b(flight|airline|boarding)\b/.test(lowerText)) score++;
    if (/\b(depart|arrival|terminal|gate)\b/.test(lowerText)) score++;
    if (/\b(passenger|seat|class)\b/.test(lowerText)) score++;
    if (FLIGHT_NUMBER_REGEX.test(originalText)) score++;
    if (AIRLINE_NAMES.some((a) => lowerText.includes(a.toLowerCase()))) score++;
    // Reset lastIndex after using global regex
    FLIGHT_NUMBER_REGEX.lastIndex = 0;
    return score;
  }

  private scoreHotelKeywords(lowerText: string): number {
    let score = 0;
    if (/\b(hotel|resort|inn|suite|lodge)\b/.test(lowerText)) score++;
    if (/\b(check.?in|check.?out)\b/.test(lowerText)) score++;
    if (/\b(room|guest|night|stay)\b/.test(lowerText)) score++;
    if (/\b(accommodation|property)\b/.test(lowerText)) score++;
    if (HOTEL_BRANDS.some((h) => lowerText.includes(h.toLowerCase()))) score++;
    return score;
  }

  private scoreCarRentalKeywords(lowerText: string): number {
    let score = 0;
    if (/\b(rental|rent|car|vehicle)\b/.test(lowerText)) score++;
    if (/\b(pick.?up|return|drop.?off)\b/.test(lowerText)) score++;
    if (/\b(driver|license|mileage)\b/.test(lowerText)) score++;
    if (/\b(insurance|coverage|waiver)\b/.test(lowerText)) score++;
    if (CAR_RENTAL_COMPANIES.some((c) => lowerText.includes(c.toLowerCase()))) score++;
    return score;
  }

  /**
   * Extract booking details using AWS Comprehend entity detection
   * combined with regex fallback patterns.
   */
  async extractBookingDetails(
    text: string,
    type: BookingType,
  ): Promise<Partial<FlightFields | HotelFields | CarRentalFields>> {
    // Try Comprehend entity extraction
    let entities: Array<{ type: string; text: string }> = [];
    try {
      const command = new DetectEntitiesCommand({
        Text: text.slice(0, 5000),
        LanguageCode: 'en',
      });
      const response = await this.client.send(command);
      entities = (response.Entities ?? []).map((e) => ({
        type: e.Type ?? 'OTHER',
        text: e.Text ?? '',
      }));
    } catch {
      // Fall through to regex-only extraction
    }

    // Extract fields based on type using regex + entities
    switch (type) {
      case 'flight':
        return this.extractFlightFields(text, entities);
      case 'hotel':
        return this.extractHotelFields(text, entities);
      case 'car_rental':
        return this.extractCarRentalFields(text, entities);
    }
  }

  /**
   * Extract flight-specific fields from email text.
   */
  private extractFlightFields(
    text: string,
    entities: Array<{ type: string; text: string }>,
  ): Partial<FlightFields> {
    const fields: Partial<FlightFields> = {};

    // Extract airline name
    const airlineEntity = entities.find((e) => e.type === 'ORGANIZATION');
    if (airlineEntity) {
      const matched = AIRLINE_NAMES.find(
        (a) => airlineEntity.text.toLowerCase().includes(a.toLowerCase()),
      );
      if (matched) fields.airline = matched;
    }
    if (!fields.airline) {
      fields.airline = AIRLINE_NAMES.find(
        (a) => text.toLowerCase().includes(a.toLowerCase()),
      );
    }

    // Extract flight number
    FLIGHT_NUMBER_REGEX.lastIndex = 0;
    const flightMatch = FLIGHT_NUMBER_REGEX.exec(text);
    if (flightMatch) {
      fields.flightNumber = `${flightMatch[1]}${flightMatch[2]}`;
    }

    // Extract airport codes (look for 3-letter codes near departure/arrival context)
    const airports = extractAirportCodes(text);
    if (airports.length >= 2) {
      fields.departureAirport = airports[0];
      fields.arrivalAirport = airports[1];
    } else if (airports.length === 1) {
      fields.departureAirport = airports[0];
    }

    // Extract dates and times
    const dateTimes = extractDateTimes(text);
    if (dateTimes.length >= 2) {
      fields.departureTime = dateTimes[0];
      fields.arrivalTime = dateTimes[1];
    } else if (dateTimes.length === 1) {
      fields.departureTime = dateTimes[0];
    }

    return fields;
  }

  /**
   * Extract hotel-specific fields from email text.
   */
  private extractHotelFields(
    text: string,
    entities: Array<{ type: string; text: string }>,
  ): Partial<HotelFields> {
    const fields: Partial<HotelFields> = {};

    // Extract hotel name from entities or known brands
    const orgEntity = entities.find((e) => e.type === 'ORGANIZATION');
    if (orgEntity) {
      const matched = HOTEL_BRANDS.find(
        (h) => orgEntity.text.toLowerCase().includes(h.toLowerCase()),
      );
      if (matched) fields.hotelName = orgEntity.text;
    }
    if (!fields.hotelName) {
      fields.hotelName = HOTEL_BRANDS.find(
        (h) => text.toLowerCase().includes(h.toLowerCase()),
      );
      // Try to get full hotel name from context
      if (fields.hotelName) {
        const hotelNameRegex = new RegExp(
          `(${fields.hotelName}[\\w\\s]{0,30})`,
          'i',
        );
        const nameMatch = hotelNameRegex.exec(text);
        if (nameMatch) {
          fields.hotelName = nameMatch[1]!.trim();
        }
      }
    }

    // Extract check-in date (look near check-in keywords)
    const checkInDate = extractDateNearKeyword(text, CHECKIN_KEYWORDS);
    if (checkInDate) fields.checkInDate = checkInDate;

    // Extract check-out date (look near check-out keywords)
    const checkOutDate = extractDateNearKeyword(text, CHECKOUT_KEYWORDS);
    if (checkOutDate) fields.checkOutDate = checkOutDate;

    // If we couldn't find dates near keywords, use any dates found
    if (!fields.checkInDate || !fields.checkOutDate) {
      const allDates = extractAllDates(text);
      if (!fields.checkInDate && allDates.length >= 1) {
        fields.checkInDate = allDates[0];
      }
      if (!fields.checkOutDate && allDates.length >= 2) {
        fields.checkOutDate = allDates[1];
      }
    }

    // Extract address from entities
    const locationEntity = entities.find((e) => e.type === 'LOCATION');
    if (locationEntity) {
      fields.address = locationEntity.text;
    }
    if (!fields.address) {
      fields.address = extractAddress(text);
    }

    return fields;
  }

  /**
   * Extract car rental-specific fields from email text.
   */
  private extractCarRentalFields(
    text: string,
    entities: Array<{ type: string; text: string }>,
  ): Partial<CarRentalFields> {
    const fields: Partial<CarRentalFields> = {};

    // Extract company name
    const orgEntity = entities.find((e) => e.type === 'ORGANIZATION');
    if (orgEntity) {
      const matched = CAR_RENTAL_COMPANIES.find(
        (c) => orgEntity.text.toLowerCase().includes(c.toLowerCase()),
      );
      if (matched) fields.company = matched;
    }
    if (!fields.company) {
      fields.company = CAR_RENTAL_COMPANIES.find(
        (c) => text.toLowerCase().includes(c.toLowerCase()),
      );
    }

    // Extract pickup date (near pickup keywords)
    const pickupDate = extractDateNearKeyword(text, PICKUP_KEYWORDS);
    if (pickupDate) fields.pickupDate = pickupDate;

    // Extract return date (near return keywords)
    const returnDate = extractDateNearKeyword(text, RETURN_KEYWORDS);
    if (returnDate) fields.returnDate = returnDate;

    // If we couldn't find dates near keywords, use any dates found
    if (!fields.pickupDate || !fields.returnDate) {
      const allDates = extractAllDates(text);
      if (!fields.pickupDate && allDates.length >= 1) {
        fields.pickupDate = allDates[0];
      }
      if (!fields.returnDate && allDates.length >= 2) {
        fields.returnDate = allDates[1];
      }
    }

    // Extract locations near pickup/return keywords
    const locationEntities = entities.filter((e) => e.type === 'LOCATION');
    if (locationEntities.length >= 2) {
      fields.pickupLocation = locationEntities[0]!.text;
      fields.returnLocation = locationEntities[1]!.text;
    } else if (locationEntities.length === 1) {
      fields.pickupLocation = locationEntities[0]!.text;
      fields.returnLocation = locationEntities[0]!.text;
    }

    // Regex fallback for locations
    if (!fields.pickupLocation) {
      fields.pickupLocation = extractTextNearKeyword(text, PICKUP_KEYWORDS);
    }
    if (!fields.returnLocation) {
      fields.returnLocation = extractTextNearKeyword(text, RETURN_KEYWORDS);
    }

    return fields;
  }

  /**
   * Parse email using only regex patterns (no AWS services).
   * Used as a complete fallback when AWS Comprehend is unavailable.
   */
  parseWithRegexFallback(email: EmailContent): ExtractedBooking | null {
    const text = email.textBody || stripHtml(email.htmlBody ?? '');

    // Classify with keywords
    const classification = this.classifyWithKeywords(text);
    if (!classification.isBookingConfirmation || !classification.bookingType) {
      return null;
    }

    // Extract using regex only (no entities)
    let fields: Partial<FlightFields | HotelFields | CarRentalFields>;
    switch (classification.bookingType) {
      case 'flight':
        fields = this.extractFlightFields(text, []);
        break;
      case 'hotel':
        fields = this.extractHotelFields(text, []);
        break;
      case 'car_rental':
        fields = this.extractCarRentalFields(text, []);
        break;
    }

    const requiredFields = getRequiredFields(classification.bookingType);
    const presentFields = Object.keys(fields).filter(
      (key) => fields[key as keyof typeof fields] !== undefined && fields[key as keyof typeof fields] !== '',
    );
    const missingFields = requiredFields.filter((f) => !presentFields.includes(f));
    const confidence = requiredFields.length > 0
      ? presentFields.length / requiredFields.length
      : 0;

    return {
      type: classification.bookingType,
      confidence,
      fields,
      missingFields,
      sourceEmailId: email.id,
    };
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Get required fields for a booking type.
 */
export function getRequiredFields(type: BookingType): string[] {
  switch (type) {
    case 'flight':
      return [...REQUIRED_FLIGHT_FIELDS];
    case 'hotel':
      return [...REQUIRED_HOTEL_FIELDS];
    case 'car_rental':
      return [...REQUIRED_CAR_RENTAL_FIELDS];
  }
}

/**
 * Strip HTML tags from a string.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract airport codes from text, filtering out common non-airport 3-letter words.
 */
export function extractAirportCodes(text: string): string[] {
  const excludeWords = new Set([
    'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL',
    'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'HAD',
    'HAS', 'HIS', 'HOW', 'MAN', 'NEW', 'NOW', 'OLD', 'SEE',
    'WAY', 'WHO', 'DID', 'GET', 'LET', 'SAY', 'SHE', 'TOO',
    'USE', 'MAY', 'FEB', 'MAR', 'APR', 'JUN', 'JUL', 'AUG',
    'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'MON', 'TUE', 'WED',
    'THU', 'FRI', 'SAT', 'SUN', 'EST', 'PST', 'CST', 'MST',
    'GMT', 'UTC', 'PDT', 'EDT', 'CDT', 'MDT',
  ]);

  // Look for airport codes near travel-related context (codes must be uppercase)
  const contextPattern = /(?:from|to|depart(?:ing|ure)?|arriv(?:ing|al)?|airport)\s*:?\s*([A-Z]{3})\b/g;
  const contextMatches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = contextPattern.exec(text)) !== null) {
    const code = match[1]!;
    if (!excludeWords.has(code)) {
      contextMatches.push(code);
    }
  }

  if (contextMatches.length >= 2) {
    return contextMatches.slice(0, 2);
  }

  // Fallback: find 3-letter uppercase codes with parentheses, e.g., (JFK)
  const parenPattern = /\(([A-Z]{3})\)/g;
  const parenMatches: string[] = [];
  while ((match = parenPattern.exec(text)) !== null) {
    const code = match[1]!;
    if (!excludeWords.has(code)) {
      parenMatches.push(code);
    }
  }

  if (contextMatches.length > 0 || parenMatches.length > 0) {
    // Deduplicate while preserving order
    const seen = new Set<string>();
    const combined: string[] = [];
    for (const code of [...contextMatches, ...parenMatches]) {
      if (!seen.has(code)) {
        seen.add(code);
        combined.push(code);
      }
    }
    return combined.slice(0, 2);
  }

  // Last resort: find standalone 3-letter uppercase codes
  const standalonePattern = /\b([A-Z]{3})\b/g;
  const standaloneMatches: string[] = [];
  while ((match = standalonePattern.exec(text)) !== null) {
    const code = match[1]!;
    if (!excludeWords.has(code)) {
      standaloneMatches.push(code);
    }
  }

  return standaloneMatches.slice(0, 2);
}

/**
 * Extract date-time strings from text.
 * Returns ISO-like date strings.
 */
export function extractDateTimes(text: string): string[] {
  const results: string[] = [];

  // Match "Jan 15, 2024 at 10:30 AM" pattern
  const fullPattern = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})(?:\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(AM|PM|am|pm))?/gi;
  let match: RegExpExecArray | null;

  while ((match = fullPattern.exec(text)) !== null) {
    const month = match[1]!;
    const day = match[2]!;
    const year = match[3]!;
    const hour = match[4];
    const minute = match[5];
    const ampm = match[6];

    let dateStr = `${month} ${day}, ${year}`;
    if (hour && minute) {
      dateStr += ` ${hour}:${minute}${ampm ? ' ' + ampm : ''}`;
    }
    results.push(dateStr);
  }

  // Match "2024-01-15T10:30" ISO format
  const isoPattern = /\b(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2})?)?/g;
  while ((match = isoPattern.exec(text)) !== null) {
    const date = match[1]!;
    const time = match[2];
    results.push(time ? `${date} ${time}` : date);
  }

  return results;
}

/**
 * Extract all dates from text (without times).
 */
export function extractAllDates(text: string): string[] {
  const results: string[] = [];

  // Month Day, Year
  const namedPattern = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/gi;
  let match: RegExpExecArray | null;

  while ((match = namedPattern.exec(text)) !== null) {
    results.push(`${match[1]} ${match[2]}, ${match[3]}`);
  }

  // ISO dates
  const isoPattern = /\b(\d{4}-\d{2}-\d{2})\b/g;
  while ((match = isoPattern.exec(text)) !== null) {
    results.push(match[1]!);
  }

  return results;
}

/**
 * Extract a date that appears near a keyword in the text.
 */
export function extractDateNearKeyword(text: string, keywords: string[]): string | undefined {
  for (const keyword of keywords) {
    const keywordIndex = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (keywordIndex === -1) continue;

    // Look within 100 characters after the keyword
    const searchWindow = text.slice(keywordIndex, keywordIndex + 150);

    // Try named date pattern
    const namedMatch = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i.exec(searchWindow);
    if (namedMatch) {
      return `${namedMatch[1]} ${namedMatch[2]}, ${namedMatch[3]}`;
    }

    // Try ISO date pattern
    const isoMatch = /\b(\d{4}-\d{2}-\d{2})\b/.exec(searchWindow);
    if (isoMatch) {
      return isoMatch[1];
    }

    // Try MM/DD/YYYY pattern
    const slashMatch = /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/.exec(searchWindow);
    if (slashMatch) {
      return slashMatch[1];
    }
  }
  return undefined;
}

/**
 * Extract a text snippet near a keyword (for location extraction).
 */
export function extractTextNearKeyword(text: string, keywords: string[]): string | undefined {
  for (const keyword of keywords) {
    const pattern = new RegExp(
      `${keyword}[:\\s]+([^\\n,]{5,50})`,
      'i',
    );
    const match = pattern.exec(text);
    if (match) {
      return match[1]!.trim();
    }
  }
  return undefined;
}

/**
 * Extract an address-like string from text.
 * Looks for patterns like "123 Main St, City, ST 12345"
 */
export function extractAddress(text: string): string | undefined {
  const addressPattern = /\b(\d+\s+[A-Za-z\s]+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Dr(?:ive)?|Rd|Road|Ln|Lane|Way|Pl(?:ace)?|Ct|Court)[.,]?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)\b/i;
  const match = addressPattern.exec(text);
  if (match) {
    return match[1]!.trim();
  }

  // Try simpler address pattern near "address" keyword
  const addrKeyword = /address[:\s]+([^\n]{10,100})/i.exec(text);
  if (addrKeyword) {
    return addrKeyword[1]!.trim();
  }

  return undefined;
}
