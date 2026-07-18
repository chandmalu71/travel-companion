// ===== Sample Data =====
const tripData = {
  name: "Rome & Amalfi Coast 2026",
  dates: "Jul 12–20, 2026",
  startDate: "2026-07-12",
  endDate: "2026-07-20",
  budget: 5000,
  spent: 2450
};

const bookings = [
  {
    id: 1,
    type: "flight",
    icon: "✈️",
    title: "Delta DL456",
    subtitle: "JFK → FCO",
    detail: "Jul 12, 2026 • 8:30 PM",
    status: "upcoming",
    airline: "Delta Air Lines",
    flightNumber: "DL456",
    departure: "JFK - New York",
    arrival: "FCO - Rome Fiumicino",
    departureTime: "8:30 PM",
    arrivalTime: "10:45 AM +1",
    date: "Jul 12, 2026",
    checkinAvailable: true,
    checkinWindow: { opens: "Jul 11, 8:30 PM", closes: "Jul 12, 7:30 PM" }
  },
  {
    id: 2,
    type: "hotel",
    icon: "🏨",
    title: "Hotel Artemide",
    subtitle: "Rome, Italy",
    detail: "Jul 12–16, 2026 • 4 nights",
    status: "upcoming",
    hotelName: "Hotel Artemide",
    address: "Via Nazionale 22, Rome",
    checkIn: "Jul 12, 2026",
    checkOut: "Jul 16, 2026",
    nights: 4,
    confirmation: "HTL-892451"
  },
  {
    id: 3,
    type: "hotel",
    icon: "🏨",
    title: "Belmond Caruso",
    subtitle: "Ravello, Amalfi Coast",
    detail: "Jul 16–20, 2026 • 4 nights",
    status: "upcoming",
    hotelName: "Belmond Hotel Caruso",
    address: "Piazza San Giovanni del Toro 2, Ravello",
    checkIn: "Jul 16, 2026",
    checkOut: "Jul 20, 2026",
    nights: 4,
    confirmation: "BHC-337291"
  },
  {
    id: 4,
    type: "car",
    icon: "🚗",
    title: "Europcar",
    subtitle: "Amalfi Coast",
    detail: "Jul 16–20, 2026 • Compact SUV",
    status: "upcoming",
    company: "Europcar",
    vehicle: "Compact SUV",
    pickup: "Amalfi Coast Office",
    return: "Naples Airport",
    pickupDate: "Jul 16, 2026",
    returnDate: "Jul 20, 2026",
    confirmation: "EC-78234A"
  }
];

const expenses = [
  { merchant: "Trattoria Roma", amount: "€47.50", converted: "$52.10", category: "Food & Dining", date: "Jul 13", icon: "🍝" },
  { merchant: "Colosseum Tickets", amount: "€32.00", converted: "$35.10", category: "Tours", date: "Jul 13", icon: "🎫" },
  { merchant: "Taxi FCO → Hotel", amount: "€48.00", converted: "$52.70", category: "Transport", date: "Jul 12", icon: "🚕" },
  { merchant: "Gucci Outlet", amount: "€285.00", converted: "$312.80", category: "Shopping", date: "Jul 14", icon: "🛍️" },
  { merchant: "Ristorante Amore", amount: "€65.00", converted: "$71.30", category: "Food & Dining", date: "Jul 14", icon: "🍷" },
  { merchant: "Vatican Museum", amount: "€20.00", converted: "$21.95", category: "Tours", date: "Jul 15", icon: "🏛️" },
  { merchant: "Gelato Corner", amount: "€8.50", converted: "$9.30", category: "Food & Dining", date: "Jul 15", icon: "🍦" },
  { merchant: "Hotel Minibar", amount: "€22.00", converted: "$24.15", category: "Food & Dining", date: "Jul 13", icon: "🍹" }
];

const searchResults = [
  { name: "Colosseum", category: "Landmark", rating: 4.8, distance: "1.2 km", price: "$$", icon: "🏛️" },
  { name: "Trevi Fountain", category: "Landmark", rating: 4.7, distance: "0.8 km", price: "Free", icon: "⛲" },
  { name: "Sistine Chapel", category: "Museum", rating: 4.9, distance: "3.1 km", price: "$$$", icon: "🎨" },
  { name: "Trastevere Food Tour", category: "Food", rating: 4.6, distance: "2.4 km", price: "$$", icon: "🍕" },
  { name: "Borghese Gallery", category: "Museum", rating: 4.7, distance: "1.8 km", price: "$$", icon: "🖼️" }
];

const favorites = [
  { name: "Colosseum", category: "Landmark", trip: "Rome 2026", icon: "🏛️" },
  { name: "Trattoria Da Enzo", category: "Restaurant", trip: "Rome 2026", icon: "🍝" },
  { name: "Path of the Gods", category: "Outdoors", trip: "Amalfi 2026", icon: "🥾" },
  { name: "Ravello Concert", category: "Event", trip: "Amalfi 2026", icon: "🎵" },
  { name: "Positano Beach", category: "Beach", trip: "Amalfi 2026", icon: "🏖️" }
];

const sharedUsers = [
  { name: "Sarah Chen", email: "sarah@email.com", initials: "SC", access: "owner" },
  { name: "Marco Rossi", email: "marco@email.com", initials: "MR", access: "editor" },
  { name: "Emily Park", email: "emily@email.com", initials: "EP", access: "viewer" }
];

// ===== View Rendering Functions =====

function renderDashboard() {
  return `
    <div class="view active" id="view-dashboard">
      <div class="greeting">
        <h2>Welcome back, Alex 👋</h2>
        <p>Your trip to Rome is in 5 days!</p>
      </div>
      <select class="trip-selector">
        <option>🌍 Rome & Amalfi Coast 2026</option>
        <option>🏔️ Swiss Alps 2026 (Dec)</option>
        <option>+ Create New Trip</option>
      </select>
      <div class="current-trip">
        <h3>🇮🇹 ${tripData.name}</h3>
        <p>${tripData.dates} • 4 bookings confirmed</p>
      </div>
      <h3 class="section-title">Upcoming Bookings</h3>
      ${bookings.map(b => `
        <div class="card" onclick="showBookingDetail(${b.id})">
          <div class="booking-card">
            <div class="booking-icon">${b.icon}</div>
            <div class="booking-info">
              <h4>${b.title}</h4>
              <p>${b.subtitle} • ${b.detail}</p>
              ${b.checkinAvailable && b.status !== 'checked-in' ? `<button class="checkin-btn" onclick="event.stopPropagation(); showCheckinModal(${b.id})">✓ Check In</button>` : ''}
            </div>
            <span class="badge badge-${b.status === 'checked-in' ? 'checkedin' : b.status}">${b.status === 'checked-in' ? 'CHECKED IN' : b.status}</span>
          </div>
        </div>
      `).join('')}
      <div class="quick-actions">
        <button class="btn btn-primary" onclick="showModal('add-booking-modal')">+ Add Booking</button>
        <button class="btn btn-green" onclick="showModal('scanner-modal')">📷 Scan Receipt</button>
      </div>
    </div>
  `;
}

function renderTimeline() {
  return `
    <div class="view active" id="view-timeline">
      <div class="timeline-toggle">
        <button class="active" onclick="setTimelineMode(this, 'day')">Day by Day</button>
        <button onclick="setTimelineMode(this, 'overview')">Overview</button>
      </div>

      <div class="day-header">
        <h3>📍 Day 1 — Sat, Jul 12</h3>
        <div class="weather-widget">☀️ 31°C</div>
      </div>
      <div class="timeline-event">
        <div class="event-time">8:30 PM</div>
        <div class="event-details">
          <h4>✈️ Flight DL456 Departs</h4>
          <p>JFK → FCO • Delta Air Lines</p>
        </div>
      </div>
      <div class="daily-expense">Daily spend: <strong>$52.70</strong></div>

      <div class="day-header">
        <h3>📍 Day 2 — Sun, Jul 13</h3>
        <div class="weather-widget">⛅ 29°C</div>
      </div>
      <div class="timeline-event">
        <div class="event-time">10:45 AM</div>
        <div class="event-details">
          <h4>✈️ Arrive Rome FCO</h4>
          <p>Terminal 3 • Baggage Carousel 7</p>
        </div>
      </div>
      <div class="timeline-event">
        <div class="event-time">12:00 PM</div>
        <div class="event-details">
          <h4>🏨 Check-in Hotel Artemide</h4>
          <p>Via Nazionale 22, Rome</p>
        </div>
      </div>
      <div class="timeline-event activity">
        <div class="event-time">3:00 PM</div>
        <div class="event-details">
          <h4>🏛️ Colosseum Visit</h4>
          <p>Guided tour • 2 hours</p>
        </div>
      </div>
      <div class="timeline-event dining">
        <div class="event-time">7:30 PM</div>
        <div class="event-details">
          <h4>🍝 Dinner at Trattoria Roma</h4>
          <p>Trastevere district</p>
        </div>
      </div>
      <div class="daily-expense">Daily spend: <strong>$128.35</strong></div>

      <div class="day-header">
        <h3>📍 Day 3 — Mon, Jul 14</h3>
        <div class="weather-widget">🌤️ 32°C</div>
      </div>
      <div class="timeline-event activity">
        <div class="event-time">9:00 AM</div>
        <div class="event-details">
          <h4>⛲ Trevi Fountain & Spanish Steps</h4>
          <p>Walking tour • Morning</p>
        </div>
      </div>
      <div class="timeline-event activity">
        <div class="event-time">2:00 PM</div>
        <div class="event-details">
          <h4>🛍️ Shopping at Via Condotti</h4>
          <p>Luxury fashion district</p>
        </div>
      </div>
      <div class="timeline-event dining">
        <div class="event-time">8:00 PM</div>
        <div class="event-details">
          <h4>🍷 Ristorante Amore</h4>
          <p>Fine dining • Reservation confirmed</p>
        </div>
      </div>
      <div class="daily-expense">Daily spend: <strong>$384.10</strong></div>

      <div class="day-header">
        <h3>📍 Day 4 — Tue, Jul 15</h3>
        <div class="weather-widget">☀️ 33°C</div>
      </div>
      <div class="timeline-event activity">
        <div class="event-time">8:30 AM</div>
        <div class="event-details">
          <h4>🎨 Vatican & Sistine Chapel</h4>
          <p>Skip-the-line tickets</p>
        </div>
      </div>
      <div class="timeline-event dining">
        <div class="event-time">1:00 PM</div>
        <div class="event-details">
          <h4>🍦 Gelato Corner</h4>
          <p>Near Piazza Navona</p>
        </div>
      </div>
      <div class="daily-expense">Daily spend: <strong>$31.25</strong></div>
    </div>
  `;
}

function renderMap() {
  return `
    <div class="view active" id="view-map">
      <div class="day-chips">
        <div class="day-chip active">All Days</div>
        <div class="day-chip">Day 1</div>
        <div class="day-chip">Day 2</div>
        <div class="day-chip">Day 3</div>
        <div class="day-chip">Day 4</div>
        <div class="day-chip">Day 5</div>
      </div>
      <div class="map-container">
        <div class="map-grid"></div>
        <div class="map-pin" style="top: 25%; left: 30%" title="Hotel Artemide">📍</div>
        <div class="map-pin" style="top: 40%; left: 55%" title="Colosseum">🏛️</div>
        <div class="map-pin" style="top: 20%; left: 45%" title="Trevi Fountain">⛲</div>
        <div class="map-pin" style="top: 15%; left: 70%" title="Sistine Chapel">🎨</div>
        <div class="map-pin" style="top: 60%; left: 25%" title="Trattoria Roma">🍝</div>
        <div class="map-pin" style="top: 70%; left: 65%" title="FCO Airport">✈️</div>
        <div class="map-pin" style="top: 50%; left: 80%" title="Ristorante Amore">🍷</div>
      </div>
      <div class="bottom-sheet">
        <div class="sheet-handle"></div>
        <div class="location-item">
          <div class="location-dot" style="background: var(--primary-blue)"></div>
          <div class="location-info">
            <h4>Hotel Artemide</h4>
            <p>Via Nazionale 22 • Hotel</p>
          </div>
        </div>
        <div class="location-item">
          <div class="location-dot" style="background: #9C27B0"></div>
          <div class="location-info">
            <h4>Colosseum</h4>
            <p>1.2 km away • Attraction</p>
          </div>
        </div>
        <div class="location-item">
          <div class="location-dot" style="background: #F9AB00"></div>
          <div class="location-info">
            <h4>Trattoria Roma</h4>
            <p>2.4 km away • Restaurant</p>
          </div>
        </div>
        <div class="location-item">
          <div class="location-dot" style="background: #757575"></div>
          <div class="location-info">
            <h4>FCO Airport</h4>
            <p>25 km away • Airport</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderExpenses() {
  const percentage = Math.round((tripData.spent / tripData.budget) * 100);
  let barColor = 'green';
  if (percentage >= 100) barColor = 'red';
  else if (percentage >= 80) barColor = 'yellow';

  return `
    <div class="view active" id="view-expenses">
      <div class="budget-bar">
        <div class="budget-header">
          <span>$${tripData.spent.toLocaleString()} / $${tripData.budget.toLocaleString()}</span>
          <small>${percentage}% used</small>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${barColor}" style="width: ${Math.min(percentage, 100)}%"></div>
        </div>
      </div>

      <h3 class="section-title">Category Breakdown</h3>
      <div class="category-breakdown">
        <div class="category-item">
          <div class="category-dot" style="background: #F9AB00"></div>
          <span>Food & Dining — 38%</span>
        </div>
        <div class="category-item">
          <div class="category-dot" style="background: #9C27B0"></div>
          <span>Shopping — 28%</span>
        </div>
        <div class="category-item">
          <div class="category-dot" style="background: var(--primary-blue)"></div>
          <span>Tours — 18%</span>
        </div>
        <div class="category-item">
          <div class="category-dot" style="background: var(--active-green)"></div>
          <span>Transport — 10%</span>
        </div>
        <div class="category-item">
          <div class="category-dot" style="background: var(--error)"></div>
          <span>Entertainment — 4%</span>
        </div>
        <div class="category-item">
          <div class="category-dot" style="background: #757575"></div>
          <span>Other — 2%</span>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3 class="section-title" style="margin-top:0;">Recent Expenses</h3>
        <button class="btn btn-green" onclick="showModal('scanner-modal')">📷 Scan</button>
      </div>

      ${expenses.map(e => `
        <div class="expense-item">
          <div class="expense-icon">${e.icon}</div>
          <div class="expense-info">
            <h4>${e.merchant}</h4>
            <p>${e.date}</p>
            <span class="category-tag">${e.category}</span>
          </div>
          <div class="expense-amount">${e.converted}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderProfile() {
  return `
    <div class="view active" id="view-profile">
      <div class="profile-header">
        <div class="avatar">AC</div>
        <h3>Alex Chen</h3>
        <p>alex.chen@email.com</p>
      </div>
      <div class="profile-menu">
        <div class="menu-item" onclick="showModal('sharing-modal')">
          <span>👥</span>
          <span class="menu-item-text">Trip Sharing</span>
          <span class="menu-item-arrow">›</span>
        </div>
        <div class="menu-item" onclick="showModal('favorites-modal')">
          <span>❤️</span>
          <span class="menu-item-text">Favorites & Wishlist</span>
          <span class="menu-item-arrow">›</span>
        </div>
        <div class="menu-item">
          <span>💱</span>
          <span class="menu-item-text">Currency: USD</span>
          <span class="menu-item-arrow">›</span>
        </div>
        <div class="menu-item">
          <span>🔔</span>
          <span class="menu-item-text">Notifications</span>
          <span class="menu-item-arrow">›</span>
        </div>
        <div class="menu-item">
          <span>📄</span>
          <span class="menu-item-text">Documents</span>
          <span class="menu-item-arrow">›</span>
        </div>
        <div class="menu-item">
          <span>🌙</span>
          <span class="menu-item-text">Dark Mode</span>
          <span class="menu-item-arrow">›</span>
        </div>
        <div class="menu-item">
          <span>📱</span>
          <span class="menu-item-text">Offline Trips (2 saved)</span>
          <span class="menu-item-arrow">›</span>
        </div>
        <div class="menu-item">
          <span>❓</span>
          <span class="menu-item-text">Help & Support</span>
          <span class="menu-item-arrow">›</span>
        </div>
        <div class="menu-item">
          <span>🚪</span>
          <span class="menu-item-text">Sign Out</span>
          <span class="menu-item-arrow">›</span>
        </div>
      </div>
    </div>
  `;
}

// ===== Modal Renderers =====

function renderSearchModal() {
  return `
    <div class="modal-overlay" id="search-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>🔍 AI Search</h2>
          <button class="modal-close" onclick="closeModal('search-modal')">✕</button>
        </div>
        <input class="search-input" type="text" placeholder="What are you looking for?" value="Things to do in Rome">
        <div class="filter-chips">
          <div class="filter-chip active">All</div>
          <div class="filter-chip">Restaurants</div>
          <div class="filter-chip">Museums</div>
          <div class="filter-chip">Outdoors</div>
          <div class="filter-chip">Events</div>
          <div class="filter-chip">Shopping</div>
        </div>
        <div class="personalization-banner">
          ✨ Based on your interests in history and fine dining
        </div>
        ${searchResults.map(r => `
          <div class="search-result">
            <div class="result-image">${r.icon}</div>
            <div class="result-info">
              <h4>${r.name}</h4>
              <div class="stars">${'★'.repeat(Math.floor(r.rating))}${r.rating % 1 ? '½' : ''}</div>
              <div class="result-meta">
                <span>${r.distance}</span>
                <span>•</span>
                <span>${r.price}</span>
                <span>•</span>
                <span>${r.category}</span>
              </div>
            </div>
            <button class="heart-btn" onclick="this.classList.toggle('liked')">♡</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderFavoritesModal() {
  return `
    <div class="modal-overlay" id="favorites-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>❤️ Favorites</h2>
          <button class="modal-close" onclick="closeModal('favorites-modal')">✕</button>
        </div>
        <div class="collections-scroll">
          <div class="collection-chip active">All</div>
          <div class="collection-chip">Must Visit</div>
          <div class="collection-chip">Food Spots</div>
          <div class="collection-chip">Day Trips</div>
          <div class="collection-chip">Nightlife</div>
        </div>
        ${favorites.map(f => `
          <div class="favorite-card">
            <div class="fav-icon">${f.icon}</div>
            <div class="fav-info">
              <h4>${f.name}</h4>
              <p>${f.category} • ${f.trip}</p>
            </div>
            <span class="badge badge-upcoming">${f.category}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderScannerModal() {
  return `
    <div class="modal-overlay" id="scanner-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>📷 Receipt Scanner</h2>
          <button class="modal-close" onclick="closeModal('scanner-modal')">✕</button>
        </div>
        <div class="scanner-viewfinder"></div>
        <div class="scanner-actions">
          <button class="btn btn-primary" onclick="simulateScan()">📸 Take Photo</button>
          <button class="btn btn-outline">📁 Upload Image</button>
        </div>
        <div id="scan-results" style="display:none;">
          <div class="scanned-header">✅ Receipt Scanned Successfully</div>
          <div class="scanned-fields">
            <div class="scanned-field">
              <label>Merchant</label>
              <span>Trattoria Roma</span>
            </div>
            <div class="scanned-field">
              <label>Amount</label>
              <span>€47.50</span>
            </div>
            <div class="scanned-field">
              <label>Date</label>
              <span>Jul 15, 2026</span>
            </div>
            <div class="scanned-field">
              <label>Category</label>
              <span><span class="badge badge-active">Food & Dining</span></span>
            </div>
          </div>
          <div style="display:flex; gap:8px; margin-top:16px;">
            <button class="btn btn-green" style="flex:1; justify-content:center;" onclick="closeModal('scanner-modal')">✓ Confirm</button>
            <button class="btn btn-outline" style="flex:1; justify-content:center;">✏️ Edit</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSharingModal() {
  return `
    <div class="modal-overlay" id="sharing-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>👥 Trip Sharing</h2>
          <button class="modal-close" onclick="closeModal('sharing-modal')">✕</button>
        </div>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
          Rome & Amalfi Coast 2026
        </p>
        ${sharedUsers.map(u => `
          <div class="shared-user">
            <div class="shared-avatar">${u.initials}</div>
            <div class="shared-info">
              <h4>${u.name}</h4>
              <p>${u.email}</p>
            </div>
            <span class="access-badge ${u.access}">${u.access}</span>
          </div>
        `).join('')}
        <button class="btn btn-primary" style="width:100%; justify-content:center; margin-top:16px;">
          + Invite Companion
        </button>
        <div class="share-link-section">
          <input type="text" value="https://travelco.app/trip/r0m3-2026" readonly>
          <button class="copy-btn" onclick="this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy',1500)">Copy</button>
        </div>
      </div>
    </div>
  `;
}

function renderAddBookingModal() {
  return `
    <div class="modal-overlay" id="add-booking-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>+ Add Booking</h2>
          <button class="modal-close" onclick="closeModal('add-booking-modal')">✕</button>
        </div>
        <div class="filter-chips" style="margin-bottom:16px;">
          <div class="filter-chip active">✈️ Flight</div>
          <div class="filter-chip">🏨 Hotel</div>
          <div class="filter-chip">🚗 Car</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px;">
          <input class="search-input" style="margin-bottom:0;" placeholder="Airline" value="Delta Air Lines">
          <input class="search-input" style="margin-bottom:0;" placeholder="Flight Number" value="DL456">
          <div style="display:flex; gap:8px;">
            <input class="search-input" style="margin-bottom:0; flex:1;" placeholder="From" value="JFK">
            <input class="search-input" style="margin-bottom:0; flex:1;" placeholder="To" value="FCO">
          </div>
          <input class="search-input" style="margin-bottom:0;" type="date" value="2026-07-12">
          <input class="search-input" style="margin-bottom:0;" placeholder="Departure Time" value="8:30 PM">
          <button class="btn btn-primary" style="width:100%; justify-content:center; margin-top:8px;" onclick="closeModal('add-booking-modal')">
            Save Booking
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderBookingDetail(id) {
  const booking = bookings.find(b => b.id === id);
  if (!booking) return '';

  let detailRows = '';
  if (booking.type === 'flight') {
    detailRows = `
      <div class="detail-row"><label>Airline</label><span>${booking.airline}</span></div>
      <div class="detail-row"><label>Flight</label><span>${booking.flightNumber}</span></div>
      <div class="detail-row"><label>From</label><span>${booking.departure}</span></div>
      <div class="detail-row"><label>To</label><span>${booking.arrival}</span></div>
      <div class="detail-row"><label>Departure</label><span>${booking.departureTime}</span></div>
      <div class="detail-row"><label>Arrival</label><span>${booking.arrivalTime}</span></div>
      <div class="detail-row"><label>Date</label><span>${booking.date}</span></div>
    `;
  } else if (booking.type === 'hotel') {
    detailRows = `
      <div class="detail-row"><label>Hotel</label><span>${booking.hotelName}</span></div>
      <div class="detail-row"><label>Address</label><span>${booking.address}</span></div>
      <div class="detail-row"><label>Check-in</label><span>${booking.checkIn}</span></div>
      <div class="detail-row"><label>Check-out</label><span>${booking.checkOut}</span></div>
      <div class="detail-row"><label>Duration</label><span>${booking.nights} nights</span></div>
      <div class="detail-row"><label>Confirmation</label><span>${booking.confirmation}</span></div>
    `;
  } else if (booking.type === 'car') {
    detailRows = `
      <div class="detail-row"><label>Company</label><span>${booking.company}</span></div>
      <div class="detail-row"><label>Vehicle</label><span>${booking.vehicle}</span></div>
      <div class="detail-row"><label>Pickup</label><span>${booking.pickup}</span></div>
      <div class="detail-row"><label>Return</label><span>${booking.return}</span></div>
      <div class="detail-row"><label>Pickup Date</label><span>${booking.pickupDate}</span></div>
      <div class="detail-row"><label>Return Date</label><span>${booking.returnDate}</span></div>
      <div class="detail-row"><label>Confirmation</label><span>${booking.confirmation}</span></div>
    `;
  }

  return `
    <div class="modal-overlay active" id="booking-detail-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Booking Details</h2>
          <button class="modal-close" onclick="closeModal('booking-detail-modal')">✕</button>
        </div>
        <div class="detail-header">
          <div class="detail-icon">${booking.icon}</div>
          <div class="detail-title">${booking.title}</div>
          <div class="detail-subtitle">${booking.subtitle}</div>
          <span class="badge badge-${booking.status === 'checked-in' ? 'checkedin' : booking.status}" style="margin-top:8px;">${booking.status === 'checked-in' ? 'CHECKED IN' : booking.status}</span>
        </div>
        <div class="detail-section">
          <h3>Details</h3>
          ${detailRows}
        </div>
        ${booking.type === 'flight' && booking.checkinAvailable ? `
        <div class="checkin-section">
          <h3>Check-in</h3>
          <div class="checkin-window">Opens: ${booking.checkinWindow.opens} • Closes: ${booking.checkinWindow.closes}</div>
          ${booking.status === 'checked-in' ? `
            <div class="checkin-complete-state">Checked In ✓</div>
          ` : `
            <button class="btn-checkin-now" onclick="event.stopPropagation(); closeModal('booking-detail-modal'); showCheckinModal(${booking.id})">✓ Check In Now</button>
          `}
        </div>
        ` : ''}
        <div class="detail-section">
          <h3>Documents</h3>
          <div class="doc-item">
            <span>📄</span>
            <div class="doc-info">
              Confirmation Email
              <small>Auto-extracted • Jul 1, 2026</small>
            </div>
          </div>
          <div class="doc-item">
            <span>🎫</span>
            <div class="doc-info">
              ${booking.type === 'flight' ? 'Boarding Pass' : booking.type === 'hotel' ? 'Booking Voucher' : 'Rental Agreement'}
              <small>PDF • 245 KB</small>
            </div>
          </div>
        </div>
        <div class="detail-section">
          <h3>Associated Expenses</h3>
          ${booking.type === 'flight' ? `
            <div class="expense-item">
              <div class="expense-icon">🚕</div>
              <div class="expense-info">
                <h4>Taxi FCO → Hotel</h4>
                <p>Jul 12</p>
              </div>
              <div class="expense-amount">$52.70</div>
            </div>
          ` : `<p style="font-size:13px; color:var(--text-secondary);">No expenses linked yet</p>`}
        </div>
        <button class="btn btn-outline" style="width:100%; justify-content:center; margin-top:12px;">
          + Add Expense
        </button>
      </div>
    </div>
  `;
}

// ===== Check-in Functions =====

function renderCheckinModal(id) {
  const booking = bookings.find(b => b.id === id);
  if (!booking) return '';

  return `
    <div class="modal-overlay active" id="checkin-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Flight Check-in</h2>
          <button class="modal-close" onclick="closeModal('checkin-modal')">✕</button>
        </div>
        <div class="checkin-modal-header">
          <div class="airline-logo">✈️</div>
          <div class="flight-info">
            <h4>${booking.airline} ${booking.flightNumber}</h4>
            <p>${booking.departure.split(' - ')[0]} → ${booking.arrival.split(' - ')[0]} • ${booking.date}</p>
          </div>
        </div>
        <div id="checkin-state">
          <div class="checkin-progress">
            <div class="spinner"></div>
            <p>Opening ${booking.airline} check-in...</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function showCheckinModal(id) {
  const container = document.getElementById('modals-container');
  container.innerHTML = renderCheckinModal(id);

  // Simulate loading then show success after 2 seconds
  setTimeout(() => {
    const stateContainer = document.getElementById('checkin-state');
    if (stateContainer) {
      stateContainer.innerHTML = `
        <div class="checkin-success">
          <div class="success-icon">✅</div>
          <h3>Check-in Complete!</h3>
          <p>You're all set for your flight. Your boarding pass is ready.</p>
          <div class="checkin-actions">
            <button class="btn btn-outline" onclick="closeModal('checkin-modal')">Upload Boarding Pass</button>
            <button class="btn btn-green" onclick="completeCheckin(${id})">Done</button>
          </div>
        </div>
      `;
    }
  }, 2000);
}

function completeCheckin(id) {
  const booking = bookings.find(b => b.id === id);
  if (booking) {
    booking.status = 'checked-in';
  }
  closeModal('checkin-modal');
  // Re-render dashboard if currently on dashboard view
  if (currentView === 'dashboard') {
    const content = document.getElementById('app-content');
    content.innerHTML = views['dashboard']();
  }
}

// ===== Navigation & Interaction Logic =====

const views = {
  dashboard: renderDashboard,
  timeline: renderTimeline,
  map: renderMap,
  expenses: renderExpenses,
  profile: renderProfile
};

const headerTitles = {
  dashboard: "Travel Companion",
  timeline: "Timeline",
  map: "Map",
  expenses: "Expenses",
  profile: "Profile"
};

let currentView = 'dashboard';

function switchView(viewName) {
  currentView = viewName;
  const content = document.getElementById('app-content');
  content.innerHTML = views[viewName]();
  document.getElementById('header-title').textContent = headerTitles[viewName];

  // Update tab bar active state
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });
}

function showModal(modalId) {
  const container = document.getElementById('modals-container');
  let html = '';
  switch(modalId) {
    case 'search-modal': html = renderSearchModal(); break;
    case 'favorites-modal': html = renderFavoritesModal(); break;
    case 'scanner-modal': html = renderScannerModal(); break;
    case 'sharing-modal': html = renderSharingModal(); break;
    case 'add-booking-modal': html = renderAddBookingModal(); break;
  }
  container.innerHTML = html;
  setTimeout(() => {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }, 10);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      document.getElementById('modals-container').innerHTML = '';
    }, 200);
  }
}

function showBookingDetail(id) {
  const container = document.getElementById('modals-container');
  container.innerHTML = renderBookingDetail(id);
}

function simulateScan() {
  const results = document.getElementById('scan-results');
  if (results) {
    results.style.display = 'block';
    results.scrollIntoView({ behavior: 'smooth' });
  }
}

function setTimelineMode(btn, mode) {
  const toggleBtns = btn.parentElement.querySelectorAll('button');
  toggleBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ===== Event Listeners =====

document.addEventListener('DOMContentLoaded', () => {
  // Initialize with dashboard
  switchView('dashboard');

  // Tab bar navigation
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      switchView(tab.dataset.view);
    });
  });

  // Close modals by clicking overlay background
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
      setTimeout(() => {
        document.getElementById('modals-container').innerHTML = '';
      }, 200);
    }
  });

  // Day chips interaction
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('day-chip')) {
      const chips = e.target.parentElement.querySelectorAll('.day-chip');
      chips.forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
    }
    if (e.target.classList.contains('filter-chip')) {
      const chips = e.target.parentElement.querySelectorAll('.filter-chip');
      chips.forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
    }
    if (e.target.classList.contains('collection-chip')) {
      const chips = e.target.parentElement.querySelectorAll('.collection-chip');
      chips.forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
    }
  });
});
