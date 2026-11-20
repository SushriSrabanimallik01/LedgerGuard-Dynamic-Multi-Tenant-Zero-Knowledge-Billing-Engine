# LedgerGuard-Dynamic-Multi-Tenant-Zero-Knowledge-Billing-Engine
 A secure multi-tenant billing engine built with the MERN stack, featuring isolated tenant data, JWT-based authentication, Redis distributed locks, and MongoDB ACID transactions to ensure reliable, duplicate-free billing and transaction integrity.


# Overview

LedgerGuard is a frontend-focused billing and invoice management dashboard built using React and Vite.
The project aims to provide a centralized interface for managing billing activities, monitoring invoice statuses, and viewing financial information through a clean, professional dashboard.

It currently includes a dashboard interface, login and registration pages, and client-side form validation.

The project is being developed incrementally, with backend integration and database-driven authentication planned for upcoming development phases.

# Objectives

- Build a professional financial dashboard.
- Create a structured interface for invoice management.
- Display financial statistics and transaction information.
- Implement login and registration interfaces.
- Validate user input using JavaScript.
- Develop a scalable foundation for future backend and database integration.

# Features Implemented

# 1. Dashboard
- Dark fintech-inspired user interface.
- Sidebar navigation.
- Responsive dashboard layout.
- Financial statistics cards.
- Revenue visualization.
- Recent transactions section.
- Invoice creation interface.

# 2. Login Interface
- Email and password fields.
- Required-field validation.
- Email format validation.
- Login form submission handling.

# 3. Registration Interface
- Full name, email and password fields.
- Password confirmation.
- Minimum password length validation.
- Password matching validation.
- Required-field validation.

# 4. Navigation
- Login-to-registration navigation.
- Registration-to-login navigation.
- Dashboard access after successful demo login.

**Current authentication limitation:** Authentication is currently frontend-only. One registered account is held temporarily in React state. Data is not persisted across browser refreshes, and this implementation is not suitable for production authentication.

# Technology Stack

| Technology |---------------| Purpose |

| React |----------------| Frontend user interface |
| Vite |-----------------| Development server and build tool |
| JavaScript (ES6+) |----| Application logic and validation |
| CSS3 |-----------------| Styling and responsive layout |
| Lucide React |---------| Interface icons |


# Project Structure
(FRONTEND)
LedgerGuard/
│
├── client/
│   ├── public/
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   └── Topbar.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   └── auth/
│   │   │       ├── Login.jsx
│   │   │       └── Register.jsx
│   │   │
│   │   ├── data/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── index.html
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md


## Current Development Status

| Module -------------------------------------------------------| Status |

| React project setup -----------------------------------------| Completed |
| Dashboard UI ------------------------------------------------| Completed |
| Sidebar navigation ------------------------------------------| Completed |
| Topbar ------------------------------------------------------| Completed |
| Invoice interface -------------------------------------| Initial implementation |
| Login page --------------------------------------------------| Completed |
| Registration page -------------------------------------------| Completed |
| JavaScript form validation ----------------------------------| Completed |
| Temporary demo login flow -----------------------------------| Completed |
| Backend API -------------------------------------------------| Planned |
| MongoDB integration -----------------------------------------| Planned |
| Secure password storage -------------------------------------| Planned |
| JWT-based authentication ------------------------------------| Planned |
| Persistent user accounts ------------------------------------| Planned |

# Future Roadmap

-  MongoDB Atlas database integration.
-  Node.js and Express backend.
-  User registration API.
-  Password hashing using bcrypt.
-  JWT-based authentication.
-  Persistent user accounts.
-  Protected dashboard routes.
-  Functional logout.
-  Invoice CRUD operations.
-  Financial reporting and analytics.
-  Improved deployment and production configuration.


# Contribution

This project is currently under active development.

