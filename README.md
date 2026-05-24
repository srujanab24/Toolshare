# 🔧 ToolShare — Community Tool Sharing Platform

A full-stack Node.js application for renting and listing tools in your community.

---

## ✨ Features

### For Tool Owners
- Register as a **Tool Owner** with a dedicated owner account
- **List tools** with photos, pricing, category, condition, and location
- **Owner Dashboard** with revenue charts, booking management, top tools
- **Accept / Decline / Complete** bookings
- Block availability dates on a calendar
- Real-time **chat** with customers

### For Customers
- Register as a **Customer** with a separate customer account
- **Browse & Search** tools by keyword, category, price, location
- **Availability Calendar** — see booked dates before renting
- **Book tools** with date range selection and notes
- **Customer Dashboard** — track bookings, spending, active rentals
- **Cancel bookings** that haven't started
- Leave **star ratings + text reviews** after completed rentals
- Real-time **chat** with tool owners

### Platform Features
- JWT-based authentication (separate flows for Owner / Customer)
- SQLite database (zero config, file-based)
- Real-time chat powered by **Socket.IO**
- Search & filter (keyword + category + price + location + availability)
- Responsive dark-themed UI

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd toolshare
npm install
```

### 2. Start the server
```bash
npm start
# or for auto-reload during development:
npm run dev
```

### 3. Open in browser
```
http://localhost:3000
```

---

## 🔐 Demo Accounts (auto-seeded)

| Role     | Email               | Password     |
|----------|---------------------|--------------|
| Owner    | owner@demo.com      | password123  |
| Customer | customer@demo.com   | password123  |

---

## 📁 Project Structure

```
toolshare/
├── server/
│   ├── index.js          # Express + Socket.IO server
│   ├── database.js       # SQLite setup + seed data
│   └── routes/
│       ├── auth.js       # Register / Login / Profile
│       ├── tools.js      # CRUD + Search + Filter
│       ├── bookings.js   # Create / Update bookings
│       ├── reviews.js    # Post / Get reviews
│       ├── chat.js       # Message history
│       └── dashboard.js  # Stats for owner & customer
├── public/
│   ├── index.html        # Single Page Application
│   ├── css/style.css     # Complete dark theme UI
│   └── js/app.js         # All frontend logic
├── .env                  # Configuration
├── package.json
└── README.md
```

---

## 🗄️ Database Schema

- **users** — id, name, email, password (bcrypt), role (owner/customer), phone, address
- **tools** — id, owner_id, title, description, category, price_per_day, deposit, location, image, is_available, condition
- **bookings** — id, tool_id, customer_id, owner_id, start_date, end_date, total_days, total_amount, status (pending/confirmed/active/completed/cancelled)
- **reviews** — id, tool_id, booking_id, reviewer_id, rating (1-5), comment
- **messages** — id, sender_id, receiver_id, message, tool_id, is_read
- **availability_blocks** — id, tool_id, blocked_date, reason

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint         | Description        |
|--------|------------------|--------------------|
| POST   | /api/auth/register | Create account   |
| POST   | /api/auth/login  | Login              |
| GET    | /api/auth/me     | Get profile        |
| PUT    | /api/auth/me     | Update profile     |

### Tools
| Method | Endpoint               | Description            |
|--------|------------------------|------------------------|
| GET    | /api/tools             | List (with filters)    |
| GET    | /api/tools/:id         | Tool detail + reviews  |
| POST   | /api/tools             | Create (owner)         |
| PUT    | /api/tools/:id         | Update (owner)         |
| DELETE | /api/tools/:id         | Delete (owner)         |
| POST   | /api/tools/:id/block   | Block a date           |

### Bookings
| Method | Endpoint                    | Description            |
|--------|-----------------------------|------------------------|
| POST   | /api/bookings               | Create booking         |
| GET    | /api/bookings               | Get my bookings        |
| PATCH  | /api/bookings/:id/status    | Update status          |

### Reviews
| Method | Endpoint              | Description      |
|--------|-----------------------|------------------|
| POST   | /api/reviews          | Post review      |
| GET    | /api/reviews/tool/:id | Tool reviews     |

### Chat
| Method | Endpoint                   | Description         |
|--------|----------------------------|---------------------|
| GET    | /api/chat/conversations    | All conversations   |
| GET    | /api/chat/:userId          | Messages with user  |

### Dashboard
| Method | Endpoint              | Description          |
|--------|-----------------------|----------------------|
| GET    | /api/dashboard/owner  | Owner analytics      |
| GET    | /api/dashboard/customer | Customer stats     |

---

## 🔧 Customization

- Change `JWT_SECRET` in `.env` for production
- Database file: `toolshare.db` (auto-created)
- To add image upload: integrate `multer` (already in dependencies)
- To add email notifications: integrate `nodemailer`

---

## 📦 Tech Stack

- **Backend**: Node.js, Express, better-sqlite3, bcryptjs, jsonwebtoken, Socket.IO
- **Frontend**: Vanilla JS SPA, CSS custom properties, Font Awesome, Google Fonts (Syne + DM Sans)
- **Database**: SQLite (via better-sqlite3 — no install needed)
- **Real-time**: Socket.IO for live chat
