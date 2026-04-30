# RidesRus - Technical Requirements Document (TRD) v2

## 1. System Architecture Overview
The RidesRus platform relies on a real-time, high-availability architecture with low latency to support live bus tracking, synchronized seat availability, and instant hail requests. The system employs a multi-client structure communicating with a centralized backend via RESTful APIs and WebSockets.

---

## 2. Phase 1: MVP Architecture (Completed)
This section documents the technical stack currently in production for the MVP.

### 2.1 Backend / API Layer
*   **Framework:** NestJS (Node.js/TypeScript).
*   **Real-time Engine:** `socket.io` Gateway listening on port `3005`. Handles `hail_bus`, `ping_location`, `bus_moved`, and `stop_update` events.
*   **Data Store:** In-memory tracking and seeded mock data arrays.

### 2.2 Frontend / Client Layers
*   **Passenger Mobile App:** React Native / Expo (TypeScript).
    *   **Mapping:** Embedded Leaflet HTML inside `react-native-webview` (to bypass native Expo Go linking restrictions).
    *   **Auth:** Clerk `useSignIn` and `useSignUp` (Email & Password strategy).
*   **Driver Tablet Console:** React Native / Expo (TypeScript).
    *   Currently receives WebSocket broadcasts of passenger hails and stop selections.
*   **Admin Dashboard:** Next.js with Tailwind CSS.
    *   **Fleet Simulator:** Uses `setInterval` and coordinate waypoints to actively mock fleet movements over WebSockets.

---

## 3. Phase 2: Production Architecture (Upcoming)
This section outlines the infrastructure upgrades required to move the MVP to a scalable, real-world production environment.

### 3.1 Backend Upgrades
*   **Relational Database:** **PostgreSQL** (via Supabase or AWS RDS).
    *   *Stores:* Users, Drivers, Buses, Routes, Transactions, Ratings, and Trip Logs.
*   **ORM:** Prisma ORM for type-safe database queries.
*   **In-Memory / Cache:** **Redis** (via AWS ElastiCache or Upstash).
    *   *Role:* Absorbs the massive volume of high-frequency GPS pings from driver tablets and broadcasts them to clients without locking or overloading the PostgreSQL database.

### 3.2 External API Integrations
*   **Live Payments:** **Flutterwave** API.
    *   NestJS will implement webhook listeners to securely verify transaction statuses.
    *   Implementation of Virtual Accounts and Card Tokenization for seamless ₦500 deductions.
*   **Native Mapping & Location:**
    *   Transition from Leaflet WebViews to native `react-native-maps` rendering.
    *   Implement `expo-location` on the Driver Console for live background telemetry (replacing the Admin Simulator).
*   **Authentication (OAuth):**
    *   Transition from Expo Go to custom EAS (Expo Application Services) Development Builds to enable native bridging for Clerk's Google and Apple OAuth flows.

### 3.3 Offline-First Driver Architecture
Connectivity along Lagos transit corridors (e.g., Lekki-Epe Expressway) is notoriously intermittent. The driver console cannot freeze if a 4G connection drops to EDGE.
*   **Local DB:** `expo-sqlite` on the driver tablet.
*   **Optimistic UI:** Every driver action (accepting a hail, confirming boarding) is written to SQLite immediately, updating the UI instantly without network lag.
*   **Sync Queue:** A background sync worker monitors network state via `@react-native-community/netinfo`. When internet is restored, pending actions are flushed to the NestJS backend in batch.

### 3.4 Ratings System
*   **Schema Addition:** Add a `Review` model in Prisma linking `PassengerId`, `DriverId`, `TripId`, `Rating` (1-5), and `Comment`.
*   **Frontend Implementation:** A modal triggered on the Passenger App upon receiving a `trip_completed` WebSocket event from the Driver Console.

---

## 4. Deployment Strategy
*   **Backend Server:** Render (Dockerized NestJS container) or AWS EC2.
*   **Admin Dashboard:** Vercel (Edge network optimized for Next.js).
*   **Mobile Apps:** 
    *   Phase 2 requires ejecting from Expo Go.
    *   Use **Expo Application Services (EAS)** to compile standalone `.apk` (Android) and `.ipa` (iOS) binaries.
    *   Deploy Driver Console specifically for Android 10+ tablets with Kiosk Mode (Screen Pinning) enabled.
