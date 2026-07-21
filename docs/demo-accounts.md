# Demo Accounts & Test Data

All demo accounts use password: **`Demo1234`**

## Accounts

| Name | Email | Role | Trips | Bookings | Expenses | Connections |
|------|-------|------|-------|----------|----------|-------------|
| Alice Johnson | alice@demo.nayya.ai | super-admin | 3 | 4 | 6 | 4 |
| Bob Smith | bob@demo.nayya.ai | user | 2 | 5 | 4 | 3 |
| Charlie Brown | charlie@demo.nayya.ai | user | 1 | 1 | 1 | 2 |
| Dana Wilson | dana@demo.nayya.ai | support | 2 | 5 | 5 | 0 |
| Eve Martinez | eve@demo.nayya.ai | user | 2 | 2 | 5 | 0 |

**Super Admin:** chand.malu@gmail.com / SuperAdmin2026! (no test data — clean account)

---

## Trips

| Owner | Trip Name | Dates | Budget | Bookings |
|-------|-----------|-------|--------|----------|
| Alice | Italy Summer 2026 | Aug 1–15, 2026 | — | 2 flights + 1 hotel |
| Alice | Bali Group Retreat | Oct 10–20, 2026 | — | 1 flight |
| Alice | (3rd trip from seed) | — | — | — |
| Bob | Japan Cherry Blossom | Mar 20 – Apr 5, 2027 | — | 3 bookings |
| Bob | Barcelona Weekend | Aug 22–25, 2026 | €1,500 | 1 flight (Vueling LGW→BCN) + Hotel Arts |
| Charlie | NYC Weekend | Sep 5–8, 2026 | — | 1 booking |
| Dana | Swiss Alps Skiing | Feb 1–8, 2027 | CHF 3,500 | Swiss Air LHR→ZRH + The Chedi Andermatt + car rental |
| Dana | Greek Islands Hopping | Sep 1–12, 2026 | €2,800 | Aegean LHR→ATH + Grace Santorini |
| Eve | Paris Romantic Getaway | Dec 20–27, 2026 | — | — |
| Eve | Morocco Adventure | Nov 15–25, 2026 | €2,000 | Royal Air Maroc CDG→RAK + La Mamounia |

---

## Bookings Detail

### Flights
| User | Trip | Airline | Flight | Route | Date | Class | Seat | PNR |
|------|------|---------|--------|-------|------|-------|------|-----|
| Dana | Swiss Alps | Swiss Air | LX1073 | LHR → ZRH | Feb 1, 2027 | Economy | 22A | LX1073-DW |
| Dana | Greek Islands | Aegean Airlines | A3601 | LHR → ATH | Sep 1, 2026 | Economy | 8C | A3601-DW |
| Eve | Morocco | Royal Air Maroc | AT800 | CDG → RAK | Nov 15, 2026 | Economy | 15F | AT800-EM |
| Bob | Barcelona | Vueling | VY8200 | LGW → BCN | Aug 22, 2026 | Economy | 4A | VY8200-BS |

### Hotels
| User | Trip | Hotel | Location | Dates | Room |
|------|------|-------|----------|-------|------|
| Dana | Swiss Alps | The Chedi Andermatt | Andermatt, Switzerland | Feb 1–8, 2027 | Deluxe Room Mountain View |
| Dana | Greek Islands | Grace Santorini | Imerovigli, Santorini | Sep 1–12, 2026 | Suite with Caldera View |
| Eve | Morocco | La Mamounia | Marrakech, Morocco | Nov 15–25, 2026 | Superior Room Garden View |
| Bob | Barcelona | Hotel Arts Barcelona | Barcelona, Spain | Aug 22–25, 2026 | Deluxe Sea View |

---

## Expenses

### Alice's Expenses
| Trip | Merchant | Amount | Category | Shared |
|------|----------|--------|----------|--------|
| Italy Summer | (from seed) | EUR 45.50 | food_dining | No |
| Italy Summer | (from seed) | EUR 180.00 | accommodation | No |
| Bali | (from seed) | USD 200.00 | tours_activities | Yes |
| — | (from seed) | USD 50.00 | transportation | No |
| — | Cafe Central | EUR 42.00 | food_dining | No |
| — | Amazon | USD 120.00 | shopping | No |

### Bob's Expenses
| Trip | Merchant | Amount | Category | Shared |
|------|----------|--------|----------|--------|
| Japan | (from seed) | USD 120.00 | food_dining | No |
| Barcelona | La Boqueria | EUR 25.00 | food_dining | No |
| Barcelona | Sagrada Familia | EUR 35.00 | tours_activities | Yes |
| Barcelona | Tickets Restaurant | EUR 68.00 | food_dining | No |

### Charlie's Expenses
| Trip | Merchant | Amount | Category | Shared |
|------|----------|--------|----------|--------|
| NYC Weekend | (from seed) | USD 85.00 | food_dining | No |

### Dana's Expenses
| Trip | Merchant | Amount | Category | Shared |
|------|----------|--------|----------|--------|
| Swiss Alps | Ski Pass Andermatt | CHF 180.00 | tours_activities | No |
| Swiss Alps | Restaurant Bären | CHF 95.00 | food_dining | Yes |
| Swiss Alps | Mammut Store | CHF 250.00 | shopping | No |
| Greek Islands | Blue Star Ferries | EUR 45.00 | transportation | No |
| Greek Islands | Selene Restaurant | EUR 120.00 | food_dining | Yes |

### Eve's Expenses
| Trip | Merchant | Amount | Category | Shared |
|------|----------|--------|----------|--------|
| Paris | (from seed) | EUR 320.00 | accommodation | No |
| Morocco | Riad Transfer | EUR 35.00 | transportation | No |
| Morocco | Medina Walking Tour | EUR 60.00 | tours_activities | No |
| Morocco | Souk Marketplace | EUR 85.00 | shopping | No |
| Morocco | Sahara Day Trip | EUR 150.00 | tours_activities | Yes |

---

## Connections (My Network)

### Alice's Network
| Contact | Status | Label | Source |
|---------|--------|-------|--------|
| Bob Smith | Connected | Travel Buddy | trip_accept |
| Charlie Brown | Connected | Colleague | trip_accept |
| Dana Wilson | Connected | Friend | trip_accept |
| Eve Martinez | Invited | — | manual |

### Bob's Network
| Contact | Status | Label | Source |
|---------|--------|-------|--------|
| Alice Johnson | Connected | Travel Buddy | trip_accept |
| Charlie Brown | Connected | Colleague | trip_accept |
| Eve Martinez | Declined | — | manual |

### Charlie's Network
| Contact | Status | Label | Source |
|---------|--------|-------|--------|
| Alice Johnson | Connected | Colleague | trip_accept |
| Bob Smith | Connected | — | trip_accept |

### Chand's Network
| Contact | Status | Label | Source |
|---------|--------|-------|--------|
| Alice Johnson | Connected | Family | manual |
| Bob Smith | Connected | Friend | manual |
| Dana Wilson | Invited | Partner | manual |
| External Friend | Invited | Family | manual |
| (+ test contacts from E2E runs) | | | |

---

## How to Re-seed

```bash
# Run the seed script (creates users + base data)
cd packages/api && npx tsx src/scripts/seed-mock-data.ts

# To clean all mock data first:
cd packages/api && npx tsx src/scripts/seed-mock-data.ts --clean
```

Note: The additional trips/bookings/expenses for Dana, Eve, and Bob (Swiss Alps, Greek Islands, Morocco, Barcelona) were added via direct SQL and are NOT part of the seed script. If you run `--clean`, you'll need to re-run the SQL inserts or add them to the seed script.

---

## Test Scenarios

### Currency Conversion
- Log in as **Dana** → has CHF expenses (Swiss Alps) and EUR expenses (Greek Islands)
- Set display currency to EUR in Settings
- Expenses page should show CHF amounts with `≈ €X.XX` conversion

### Multi-Currency Trips
- **Bob's Barcelona** trip has EUR expenses
- **Dana's Swiss Alps** has CHF expenses
- Total should convert to user's preferred display currency

### My Network / Connections
- **Alice** has 4 connections (3 connected, 1 invited)
- **Bob** has 3 connections (2 connected, 1 declined)
- Test adding a manual contact, editing labels, filtering by status

### Shared Expenses
- Dana's "Restaurant Bären" (CHF 95, shared) and "Selene Restaurant" (EUR 120, shared)
- Eve's "Sahara Day Trip" (EUR 150, shared)
- Bob's "Sagrada Familia" (EUR 35, shared)

### Settings / Preferences
- All accounts can set interests, dietary, allergies from admin-managed lists
- Currency preference affects expense display across all pages
