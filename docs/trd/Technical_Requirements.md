# RidesRus - Technical Requirements Document (TRD)

## 0. Confirmed Stack Decisions
| Decision | Choice | Rationale |
|---|---|---|
| **Maps & Routing** | **Mapbox** | More customizable, cost-effective for MVP, strong offline tile support |
| **Payment Gateway** | **Flutterwave** | Strong Nigerian market support, familiar from prior projects |
| **Driver Console DB** | **SQLite (on-device)** | Offline-first local queue for intermittent connectivity |

---

## 1. System Architecture Overview
The RidesRus platform relies on real-time, high-availability architecture with low latency to support live bus tracking, synchronized seat availability, and instant hail requests. 
The system employs a multi-client structure communicating with a centralized backend via RESTful APIs and WebSockets.

## 2. Technology Stack Constraints & Selections
*Note: Python has been explicitly excluded from both the frontend and backend stack.*

### 2.1 Backend / API Layer
*   **Language:** TypeScript
*   **Runtime:** Node.js
*   **Framework:** NestJS (Chosen for its robust, scalable architecture and native TypeScript support) or Express.js.
*   **Real-time Communication:** Socket.io (for WebSockets) to handle live bus GPS updates, hail alerts, and seat count changes.
*   **ORM:** Prisma or TypeORM.

### 2.2 Frontend / Client Layers
**A. Passenger Mobile App**
*   **Framework:** React Native / Expo (TypeScript)
*   **Platforms:** iOS & Android
*   **State Management:** Redux Toolkit or Zustand
*   **Map Integration:** `react-native-maps`

**B. Driver Tablet Console (Mounted)**
*   **Framework:** React Native (Targeting Android Tablets primarily, as per PRD) 
*   **Requirements:** Large UI/UX formatting, high contrast, offline fallbacks, and always-on-screen permissions.

**C. Admin Dashboard**
*   **Framework:** Next.js (React)
*   **Styling:** Tailwind CSS
*   **Role:** Fleet tracking, business analytics, user management, and route configurations.

### 2.3 Databases
*   **Primary Relational Database:** PostgreSQL 
    *   *Stores:* Users, Drivers, Buses, Routes, Transactions, completed Trip Logs.
*   **In-Memory / Cache:** Redis
    *   *Stores:* Live GPS coordinates of buses, real-time seat availability, active hail sessions, and temporary driver states. This ensures the map query load does not overwhelm the PostgreSQL database.

## 3. External APIs & Integrations
*   **Mapping & Routing:** Google Maps Platform (Maps SDK, Places API, Directions API) or Mapbox.
*   **Payment Gateway:** Paystack or Flutterwave (for processing cash-less QR boarding and wallet top-ups).
*   **Push Notifications:** Firebase Cloud Messaging (FCM) for alerting passengers when a stop is near and alerting drivers of hails.
*   **Cloud Hosting / Infrastructure:** AWS (EC2, RDS, ElastiCache) or Google Cloud.
*   **QR Code Handling:** Server-side generation library (e.g., `qrcode` npm package), paired with in-app scanner modules (`expo-camera` or `react-native-vision-camera`).

## 4. Core System Modules
1.  **Auth & IAM Module:** JWT-based user, driver, and admin authentication.
2.  **Geolocation Engine:** Continuously ingests GPS pings from driver tablets and broadcasts to nearby passenger apps via WebSockets.
3.  **Fleet & Seat Management:** Syncs the current live occupancy of buses in real-time. Changes color mapping (Green, White, Red).
4.  **Hailing & Dispatch Engine:** Manages the lifecycle of a passenger hail -> driver notification -> acceptance -> boarding.
5.  **Payment & Wallet Engine:** Processes seamless deductions when a passenger scans the specific QR code generated for their trip/board.
6.  **Trip Management:** Drop-off selection, ride completion routines, and feedback logging.

## 5. Critical Architectural Constraint: Offline-First Driver Console
This is the **most important architectural decision** for the Lagos context. Along routes like Lekki-Epe Expressway, connectivity is *intermittent*, not absent — a driver may have 4G at Chevron but drop to Edge (2G) near the Ajah flyover.

### Architecture: Optimistic UI + Local Queue
*   **Local Storage:** The driver tablet runs a local **SQLite** database (via `expo-sqlite`). Every driver action (hail acknowledgement, stop updates, boarding confirmations) is written to SQLite **first**, immediately, before any network call.
*   **Optimistic UI:** The driver's screen updates instantly with no loading spinners — they see the result of their action as if it succeeded.
*   **Background Sync Queue:** A background sync worker continuously monitors connectivity. When a 4G pocket is hit, it flushes the pending action queue to the NestJS backend in order, with conflict resolution timestamps.
*   **Server Reconciliation:** The backend accepts batched sync payloads and resolves any conflicts using event timestamps stored on-device.

### Libraries for Driver Console (React Native Android)
| Concern | Library |
|---|---|
| Local Database | `expo-sqlite` |
| Background Sync | `react-native-background-fetch` |
| Network State Detection | `@react-native-community/netinfo` |
| Optimistic State Management | Zustand with local persistence middleware |

---

## 6. Potential Bottlenecks & Mitigations
*   **GPS Connectivity in Lagos:** Implement client-side **dead-reckoning** and **Mapbox route-snapping** to prevent bus icons from jumping off-road when GPS signal degrades. The tablet stores last-known coordinates in SQLite.
*   **High Real-Time Data Volume:** Throttle GPS pings to every **5 seconds** (not 1s) and route all live position queries exclusively through **Redis** to protect PostgreSQL from write storms.
*   **QR Scanning Friction:** Use `react-native-vision-camera` which is significantly faster than expo-camera for QR decoding, works in low-light, and is performant on mid-range Android tablets.
*   **Driver Offline Sync Conflicts:** Use a `synced_at` timestamp on every SQLite record. Server-side conflict resolution always prefers the **earliest event timestamp** (first-in wins) to handle scenarios where two hail acknowledgements arrive out of order.
