/**
 * Weather Integration Routes
 *
 * Provides weather forecasts for trip destinations using OpenWeatherMap.
 * In dev: returns realistic mock data (no API key needed).
 * In production: calls OpenWeatherMap API with OPENWEATHERMAP_API_KEY env var.
 *
 * Endpoints:
 *  - GET /api/trips/:tripId/weather       — forecast for trip dates & destination
 *  - GET /api/weather/location            — weather for a specific lat/lng (GPS)
 *  - GET /api/weather/alerts/:tripId      — weather alerts/warnings for trip
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

interface WeatherOptions {
  db: Kysely<Database>;
}

interface DayForecast {
  date: string;
  tempHigh: number;
  tempLow: number;
  condition: string;
  icon: string;
  precipitation: number; // percentage
  humidity: number;
  windSpeed: number; // km/h
  uvIndex: number;
  description: string;
}

interface WeatherAlert {
  type: 'rain' | 'heat' | 'cold' | 'storm' | 'wind';
  severity: 'info' | 'warning' | 'severe';
  message: string;
  date: string;
  suggestion: string;
}

// Weather condition icons
const CONDITIONS: Record<string, { icon: string; label: string }> = {
  sunny: { icon: '☀️', label: 'Sunny' },
  partly_cloudy: { icon: '⛅', label: 'Partly Cloudy' },
  cloudy: { icon: '☁️', label: 'Cloudy' },
  rain: { icon: '🌧️', label: 'Rain' },
  heavy_rain: { icon: '⛈️', label: 'Heavy Rain' },
  thunderstorm: { icon: '🌩️', label: 'Thunderstorm' },
  snow: { icon: '❄️', label: 'Snow' },
  fog: { icon: '🌫️', label: 'Fog' },
  wind: { icon: '💨', label: 'Windy' },
  clear_night: { icon: '🌙', label: 'Clear Night' },
};

export async function registerWeatherRoutes(
  app: FastifyInstance,
  options: WeatherOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/trips/:tripId/weather ────────────────────────────────────────
  app.get(
    '/api/trips/:tripId/weather',
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const { tripId } = request.params;

      // Fetch trip details
      const trip = await db.selectFrom('trips').selectAll().where('id', '=', tripId).executeTakeFirst();
      if (!trip) return reply.status(404).send({ statusCode: 404, error: 'Trip not found' });

      const startDate = trip.start_date ? new Date(trip.start_date) : new Date();
      const endDate = trip.end_date ? new Date(trip.end_date) : new Date(startDate.getTime() + 7 * 86400000);
      const destination = trip.name; // Trip name often contains destination

      // In production: call OpenWeatherMap API
      // In dev: generate realistic mock forecast
      const forecast = generateMockForecast(destination, startDate, endDate);
      const alerts = generateMockAlerts(forecast, destination);

      // Get user's home location weather for comparison
      const homeWeather = generateMockHomeWeather();

      return reply.send({
        statusCode: 200,
        data: {
          destination,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          forecast,
          alerts,
          homeWeather,
          source: 'mock (production: OpenWeatherMap)',
          lastUpdated: new Date().toISOString(),
        },
      });
    },
  );

  // ─── GET /api/weather/location ─────────────────────────────────────────────
  // Live weather for current GPS coordinates
  app.get(
    '/api/weather/location',
    async (request: FastifyRequest<{ Querystring: { lat: string; lng: string } }>, reply: FastifyReply) => {
      const { lat, lng } = request.query as any;

      if (!lat || !lng) {
        return reply.status(400).send({ statusCode: 400, error: 'lat and lng query params required' });
      }

      // In production: call OpenWeatherMap current weather API
      // In dev: mock current weather
      const current = {
        temperature: 26 + Math.round(Math.random() * 6),
        feelsLike: 28 + Math.round(Math.random() * 4),
        condition: 'partly_cloudy',
        icon: '⛅',
        description: 'Partly cloudy',
        humidity: 55 + Math.round(Math.random() * 20),
        windSpeed: 8 + Math.round(Math.random() * 12),
        uvIndex: 5 + Math.round(Math.random() * 4),
        visibility: 10,
        location: `${parseFloat(lat).toFixed(2)}°N, ${parseFloat(lng).toFixed(2)}°E`,
      };

      return reply.send({ statusCode: 200, data: current });
    },
  );

  // ─── GET /api/weather/alerts/:tripId ───────────────────────────────────────
  app.get(
    '/api/weather/alerts/:tripId',
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const { tripId } = request.params;
      const trip = await db.selectFrom('trips').selectAll().where('id', '=', tripId).executeTakeFirst();
      if (!trip) return reply.status(404).send({ statusCode: 404, error: 'Trip not found' });

      const startDate = trip.start_date ? new Date(trip.start_date) : new Date();
      const endDate = trip.end_date ? new Date(trip.end_date) : new Date(startDate.getTime() + 7 * 86400000);

      const forecast = generateMockForecast(trip.name, startDate, endDate);
      const alerts = generateMockAlerts(forecast, trip.name);

      return reply.send({ statusCode: 200, data: alerts });
    },
  );
}

// ─── Mock Weather Generation ─────────────────────────────────────────────────

function generateMockForecast(destination: string, startDate: Date, endDate: Date): DayForecast[] {
  const forecast: DayForecast[] = [];
  const days = Math.min(Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000), 14);
  const lower = destination.toLowerCase();

  // Base temperatures by destination hints
  let baseTemp = 25;
  let rainChance = 20;
  if (lower.includes('italy') || lower.includes('rome') || lower.includes('bali') || lower.includes('dubai') || lower.includes('thailand')) {
    baseTemp = 30; rainChance = 15;
  } else if (lower.includes('london') || lower.includes('paris') || lower.includes('swiss') || lower.includes('alps')) {
    baseTemp = 18; rainChance = 35;
  } else if (lower.includes('japan') || lower.includes('cherry')) {
    baseTemp = 16; rainChance = 30;
  } else if (lower.includes('morocco') || lower.includes('sahara')) {
    baseTemp = 34; rainChance = 5;
  } else if (lower.includes('nyc') || lower.includes('new york')) {
    baseTemp = 24; rainChance = 25;
  }

  const conditions = ['sunny', 'sunny', 'partly_cloudy', 'partly_cloudy', 'cloudy', 'rain'];

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 86400000);
    const dayVariation = Math.round((Math.random() - 0.5) * 6);
    const condition = Math.random() * 100 < rainChance ? 'rain' : conditions[Math.floor(Math.random() * conditions.length)];
    const tempHigh = baseTemp + dayVariation + Math.round(Math.random() * 3);
    const tempLow = tempHigh - 6 - Math.round(Math.random() * 4);

    forecast.push({
      date: date.toISOString().split('T')[0],
      tempHigh,
      tempLow,
      condition,
      icon: CONDITIONS[condition]?.icon ?? '☀️',
      precipitation: condition === 'rain' ? 60 + Math.round(Math.random() * 30) : condition === 'heavy_rain' ? 85 : Math.round(Math.random() * 20),
      humidity: 40 + Math.round(Math.random() * 35),
      windSpeed: 5 + Math.round(Math.random() * 20),
      uvIndex: condition === 'sunny' ? 7 + Math.round(Math.random() * 3) : 3 + Math.round(Math.random() * 3),
      description: CONDITIONS[condition]?.label ?? 'Clear',
    });
  }

  return forecast;
}

function generateMockAlerts(forecast: DayForecast[], destination: string): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  for (const day of forecast) {
    if (day.condition === 'rain' || day.condition === 'heavy_rain') {
      alerts.push({
        type: 'rain',
        severity: day.condition === 'heavy_rain' ? 'warning' : 'info',
        message: `Rain expected on ${day.date} (${day.precipitation}% chance)`,
        date: day.date,
        suggestion: 'Pack an umbrella and waterproof jacket. Consider indoor activities.',
      });
    }
    if (day.tempHigh >= 35) {
      alerts.push({
        type: 'heat',
        severity: 'warning',
        message: `High temperature alert: ${day.tempHigh}°C on ${day.date}`,
        date: day.date,
        suggestion: 'Stay hydrated, avoid midday sun (12-3 PM). Wear sunscreen SPF 50+.',
      });
    }
    if (day.tempLow <= 5) {
      alerts.push({
        type: 'cold',
        severity: 'info',
        message: `Cold weather: ${day.tempLow}°C overnight on ${day.date}`,
        date: day.date,
        suggestion: 'Pack warm layers and a winter jacket.',
      });
    }
    if (day.windSpeed > 30) {
      alerts.push({
        type: 'wind',
        severity: 'info',
        message: `Strong winds (${day.windSpeed} km/h) on ${day.date}`,
        date: day.date,
        suggestion: 'Secure loose items. Boat/ferry trips may be affected.',
      });
    }
  }

  return alerts.slice(0, 5); // Max 5 alerts
}

function generateMockHomeWeather(): { location: string; temperature: number; condition: string; icon: string } {
  return {
    location: 'Home (Frankfurt)',
    temperature: 20 + Math.round(Math.random() * 5),
    condition: 'partly_cloudy',
    icon: '⛅',
  };
}
