# Travel Companion - UI/UX Prototype

A static HTML/CSS/JS prototype demonstrating the Travel Companion app's core screens and interactions.

## How to Run

Simply open `index.html` in any modern web browser:

```bash
open index.html
```

Or use a local server:

```bash
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## Screens

1. **Dashboard / Home** - Welcome greeting, upcoming trips and bookings
2. **Timeline** - Day-by-day and overview modes with weather
3. **Map** - Geographic view of trip locations
4. **Expenses** - Budget tracking, expense list, receipt scanning
5. **Profile** - User settings and preferences
6. **Booking Detail** - Full booking information (via card tap)
7. **AI Search** - Natural language activity search
8. **Favorites** - Saved places and collections
9. **Receipt Scanner** - AI-powered receipt extraction
10. **Trip Sharing** - Share trips with companions

## Navigation

- Use the bottom tab bar to switch between main views
- Tap booking cards on the Dashboard for detail views
- Use the search icon (header) for AI Search
- Use the heart icon (header) for Favorites

## Tech Stack

- Pure HTML5, CSS3, JavaScript (ES6+)
- No build step or dependencies required
- Google Fonts (Inter) loaded via CDN
- Mobile-first responsive design (390px mobile frame on desktop)
