# Trip Members & Groups Architecture

## Overview

Every trip has a list of travellers organized into groups (families, friend circles, etc.). Members can be registered Nayya users, invited via email/phone/WhatsApp, or non-account travellers (kids, elderly). Groups are hierarchical and affect both visual display and expense splitting.

---

## Traveller Types

| Type | Has Account | Can Login | Example |
|------|------------|-----------|---------|
| **Registered User** | Yes | Yes | John (john@email.com) |
| **Invited (pending)** | No (yet) | No | Amy (invited via email, hasn't signed up) |
| **Non-account Adult** | No | No | Grandma Rose (won't use the app) |
| **Child (5-17)** | Optional | Optional | Max, age 12 |
| **Infant (0-2)** | No | No | Baby Lily, 18 months |

### Traveller Fields

| Field | Required | Notes |
|-------|----------|-------|
| Display name | Yes | Always shown |
| Email | No | Required for invitation |
| Phone | No | For phone/WhatsApp invite |
| Date of birth | No | Required for under-12 bookings |
| Traveller type | Yes | adult, child, infant |
| Passport name | No | For flight bookings |
| Passport number | No | Encrypted, for flight manifests |
| Nationality | No | For visa requirements |
| Account (user_id) | No | Linked if registered |
| Avatar URL | No | From account or uploaded |

---

## Groups

Groups organize travellers hierarchically within a trip.

### Structure
```
Trip: "Bali Group Retreat"
├── 🏠 Smith Family
│   ├── 👤 John Smith (owner, adult, registered)
│   ├── 👤 Sarah Smith (editor, adult, registered)
│   ├── 👦 Max Smith (child, age 12, no account)
│   └── 👶 Lily Smith (infant, age 1, no account)
├── 🏠 Jones Family
│   ├── 👤 Dave Jones (editor, adult, registered)
│   ├── 👤 Amy Jones (editor, adult, invited - pending)
│   └── 👦 Tom Jones (child, age 8, no account)
└── 👤 Charlie Davis (editor, adult, registered, no group)
```

### Group Properties

| Field | Notes |
|-------|-------|
| Name | "Smith Family", "College Friends", "Work Team" |
| Type | family, friends, colleagues, custom |
| Expense split mode | per_person, per_group (family counts as 1 unit) |
| Color | For visual distinction |

---

## Roles & Permissions

| Role | Can view trip | Can edit bookings | Can add expenses | Can manage members | Can delete trip |
|------|:---:|:---:|:---:|:---:|:---:|
| **Owner** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Editor** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Viewer** | ✓ | ✗ | ✗ | ✗ | ✗ |

- Only the **owner** can add/remove members
- Any member can **leave** the trip (if no unsettled expenses)
- Owner can **transfer ownership** to another registered member

---

## Invitations

### Invitation Channels

| Channel | How | Delivery |
|---------|-----|----------|
| **Email** | Enter email address | SES email with trip details + accept link |
| **Phone/SMS** | Enter phone number | SMS with short link (Twilio) |
| **WhatsApp** | Enter phone number | WhatsApp message via share URL |
| **Link** | Generate shareable link | Copy + paste anywhere |

### Invitation Fields

| Field | Notes |
|-------|-------|
| Trip ID | Which trip |
| Invited by | Who sent the invite |
| Channel | email, phone, whatsapp, link |
| Recipient | Email/phone/null (for links) |
| Role | What role they'll get on accept |
| Group ID | Which group to add them to (optional) |
| Expires at | User-configurable (1 day, 3 days, 7 days, 30 days, never) |
| Status | pending, accepted, declined, expired |
| Token | Unique accept token |
| Message | Personal note from inviter (optional) |

### Invitation Flow

1. Owner clicks "Invite Member" → enters email/phone/generates link
2. System checks if email/phone matches existing Nayya user
   - **If yes**: show "User found" indicator, send in-app notification + email
   - **If no**: send invitation email/SMS with signup link
3. Recipient clicks link → 
   - **If has account**: auto-add to trip (or ask to accept — admin-configurable)
   - **If no account**: redirected to signup, then auto-added after registration
4. Invitation can be **resent** or **cancelled** by the owner

### Admin Configuration

| Setting | Options | Default |
|---------|---------|---------|
| Auto-accept on signup | Yes / Ask first | Ask first |
| Default invitation expiry | 1d, 3d, 7d, 30d, never | 7 days |
| Allow phone invites | Yes / No | Yes |
| Allow WhatsApp invites | Yes / No | Yes |
| Allow link invites | Yes / No | Yes |

---

## Member Visibility

Owner can configure per-trip:
- **Full visibility**: all members see all other members
- **Group-only**: members only see people in their own group
- **Owner-managed**: only owner sees full list; members see their group + trip info

Default: **Full visibility**

---

## Database Schema

### `trip_travellers` (replaces/extends trip_members)

```sql
CREATE TABLE trip_travellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    group_id UUID REFERENCES trip_groups(id) ON DELETE SET NULL,
    
    -- Identity
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    avatar_url TEXT,
    
    -- Traveller details
    traveller_type VARCHAR(10) NOT NULL DEFAULT 'adult',  -- adult, child, infant
    date_of_birth DATE,
    passport_name VARCHAR(200),
    passport_number_encrypted TEXT,
    nationality VARCHAR(50),
    
    -- Role & status
    role VARCHAR(10) NOT NULL DEFAULT 'editor',  -- owner, editor, viewer
    status VARCHAR(10) NOT NULL DEFAULT 'active',  -- active, invited, left
    
    -- Metadata
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `trip_groups`

```sql
CREATE TABLE trip_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    group_type VARCHAR(20) DEFAULT 'family',  -- family, friends, colleagues, custom
    expense_split_mode VARCHAR(20) DEFAULT 'per_person',  -- per_person, per_group
    color VARCHAR(7),  -- hex color for UI
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `trip_invitations`

```sql
CREATE TABLE trip_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    
    -- Delivery
    channel VARCHAR(10) NOT NULL,  -- email, phone, whatsapp, link
    recipient VARCHAR(255),  -- email or phone (null for link invites)
    
    -- Configuration
    role VARCHAR(10) NOT NULL DEFAULT 'editor',
    group_id UUID REFERENCES trip_groups(id),
    message TEXT,
    expires_at TIMESTAMPTZ,
    
    -- State
    token VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(10) NOT NULL DEFAULT 'pending',  -- pending, accepted, declined, expired, cancelled
    accepted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints

### Trip Members

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trips/:tripId/travellers` | List all travellers (with groups) |
| POST | `/api/trips/:tripId/travellers` | Add a traveller (non-account or link to user) |
| PUT | `/api/trips/:tripId/travellers/:id` | Update traveller details |
| DELETE | `/api/trips/:tripId/travellers/:id` | Remove traveller from trip |
| POST | `/api/trips/:tripId/travellers/:id/leave` | Self-leave (if no expenses) |

### Groups

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trips/:tripId/groups` | List groups |
| POST | `/api/trips/:tripId/groups` | Create a group |
| PUT | `/api/trips/:tripId/groups/:id` | Update group (name, type, color) |
| DELETE | `/api/trips/:tripId/groups/:id` | Delete group (reassign members to ungrouped) |
| PUT | `/api/trips/:tripId/travellers/:id/move` | Move traveller to different group |

### Invitations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/trips/:tripId/invitations` | Send an invitation |
| GET | `/api/trips/:tripId/invitations` | List pending invitations |
| POST | `/api/trips/:tripId/invitations/:id/resend` | Resend invitation |
| DELETE | `/api/trips/:tripId/invitations/:id` | Cancel invitation |
| POST | `/api/invitations/:token/accept` | Accept an invitation (public) |
| POST | `/api/invitations/:token/decline` | Decline an invitation (public) |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/trip-memberships` | All memberships (stats, traceability) |
| POST | `/api/admin/trips/:tripId/travellers` | Force-add member |
| DELETE | `/api/admin/trips/:tripId/travellers/:id` | Force-remove member |

---

## UI Design

### Trip Detail Page — Members Tab

```
┌─────────────────────────────────────────────────────┐
│ Members (8)                           [+ Invite]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 🏠 Smith Family                    [⋯ group menu]  │
│   ├── 👤 John Smith        owner · adult   ✓ active │
│   ├── 👤 Sarah Smith       editor · adult  ✓ active │
│   ├── 👦 Max Smith         — · child (12)  👶       │
│   └── 👶 Lily Smith        — · infant (1)  👶       │
│                                                     │
│ 🏠 Jones Family                    [⋯ group menu]  │
│   ├── 👤 Dave Jones        editor · adult  ✓ active │
│   ├── 📧 Amy Jones         editor · adult  ⏳ invited│
│   └── 👦 Tom Jones         — · child (8)   👶       │
│                                                     │
│ 👤 Charlie Davis            editor · adult  ✓ active │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Pending Invitations (1)                             │
│   📧 amy@jones.com · Editor · expires in 5 days    │
│   [Resend] [Cancel]                                │
└─────────────────────────────────────────────────────┘
```

### Invite Modal

```
┌─────────────────────────────────────────────────────┐
│ Invite to Trip                                      │
├─────────────────────────────────────────────────────┤
│ How to invite:                                      │
│ [📧 Email] [📱 Phone] [💬 WhatsApp] [🔗 Link]      │
│                                                     │
│ Email: [amy@jones.com                            ]  │
│                                                     │
│ Role: [Editor ▾]                                    │
│ Group: [Jones Family ▾] or [+ New Group]            │
│ Expires: [7 days ▾]                                 │
│ Message: [Join us in Bali! 🏝️                   ]   │
│                                                     │
│                          [Cancel] [Send Invitation] │
└─────────────────────────────────────────────────────┘
```

### Trip Overview (avatar row)

On the trip card in the trips list:
```
Italy Summer 2026 · Aug 1–15
👤👤👦👶 + 👤👤👦  (7 travellers)
```

---

## Integration with Existing Features

1. **Expense splitting** → trip_travellers auto-populate the expense group members
2. **Booking traveller_names** → when adding a booking, suggest from trip_travellers
3. **Timeline** → show "who's arriving when" using traveller names
4. **Notifications** → notify all active members when bookings/expenses change
5. **Activity feed** → log member adds/removes/role changes

---

## Implementation Phases

### Phase 1 — Core Members & Groups
- Migration: `trip_travellers`, `trip_groups` tables
- API: CRUD for travellers and groups
- UI: Members tab in trip detail (hierarchical list, add/remove)
- Avatar row on trip overview cards

### Phase 2 — Invitations
- Migration: `trip_invitations` table
- API: invitation CRUD + accept/decline endpoints
- UI: Invite modal (email/phone/WhatsApp/link channels)
- Email template for invitations
- Pending invitations list

### Phase 3 — Integration
- Auto-populate expense group from trip_travellers
- Booking traveller name suggestions
- Leave trip (with expense check)
- Admin panel: trip memberships view

### Phase 4 — Advanced
- WhatsApp invite via share API
- Phone invite via SMS (Twilio)
- Passport/DOB fields for flight manifests
- Group-level expense splitting (family as one unit)
- Visibility settings (owner configurable)
