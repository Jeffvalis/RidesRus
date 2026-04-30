# Product Requirements Document (PRD) – RidesRus v2

## 1. Overview
RidesRus is a smart bus-hailing platform designed for Lagos commuters. The platform allows passengers to see available buses in real time, hail specific buses, board securely, pay seamlessly, and select drop-off stops. Drivers use a mounted tablet console for passenger management and trip coordination, while admins monitor operations via a real-time web dashboard.

This document outlines the product requirements, divided into **Phase 1 (MVP - Completed)** and **Phase 2 (Production Readiness - Upcoming)**.

---

## 2. Phase 1: Minimum Viable Product (MVP)
*Status: Completed & Tested*

### 2.1 Core Objectives Achieved
*   **Authentication Flow:** Implemented secure email-based sign-up and login for passengers.
*   **Live Tracking Simulation:** Created a robust fleet simulation engine to demonstrate real-time bus movement along the Lekki-VI corridor.
*   **Hailing & Seat Management:** Enabled passengers to hail a bus and see seat availability dynamically change.
*   **Driver & Admin Consoles:** Developed a tablet-optimized UI for drivers to receive hail notifications and an admin web dashboard for fleet monitoring.

### 2.2 Implemented Features
**Feature 1: User Authentication & Onboarding**
*   **Description:** Passengers can create an account using their email address.
*   **Status:** Live. Uses Clerk for secure identity management.

**Feature 2: Live Bus Tracking & Seat Availability**
*   **Description:** Passengers view buses on an interactive map. Buses are color-coded: White (Empty), Green (Seats Available), Red (Full).
*   **Status:** Live. Powered by a WebSocket connection to the NestJS backend.

**Feature 3: The Hailing Mechanism**
*   **Description:** Passengers tap a bus on the map, view the flat fare (₦500), and initiate a hail. The driver's console immediately receives a notification.
*   **Status:** Live. 

**Feature 4: Stop Selection & Dummy Wallet**
*   **Description:** After hailing, passengers can pick their drop-off stop and view a dummy wallet containing their balance, payment methods, and transaction history.
*   **Status:** Live.

**Feature 5: Admin Fleet Simulation**
*   **Description:** A dashboard tool that simulates real GPS pings along the Lekki-VI expressway to test the system's real-time capabilities.
*   **Status:** Live.

---

## 3. Phase 2: Production Readiness & Scale
*Status: Upcoming*

### 3.1 Core Objectives
*   **Transition to Real-World Hardware:** Move from simulated admin tracking to live background GPS tracking on driver tablets.
*   **Secure Payment Infrastructure:** Replace dummy wallets with live auto-deductions via Flutterwave.
*   **Enhanced Security:** Implement QR-based boarding verification.
*   **User Feedback Loop:** Introduce post-trip passenger ratings for drivers to ensure quality control.

### 3.2 Upcoming Features
**Feature 1: Real-Time Driver GPS Telemetry**
*   **Description:** The driver tablet console will passively collect and broadcast background GPS coordinates every 5 seconds, entirely replacing the Admin Simulator.
*   **User Story:** As a passenger, I want to see the actual, physical location of the bus on the road to time my arrival at the bus stop.

**Feature 2: Live Flutterwave Payments & Wallet**
*   **Description:** Passengers will link a debit card or transfer funds to a virtual account. Upon successful trip completion, the ₦500 fare will be automatically deducted.
*   **User Story:** As a passenger, I want to preload my wallet so I don't have to scramble for cash or worry about exact change.

**Feature 3: QR Code Boarding & Validation**
*   **Description:** To prevent fraud, passengers must scan a dynamic QR code displayed on the driver's tablet to confirm their hail and trigger the payment deduction.
*   **User Story:** As a driver, I want boarding to be automatically logged when a passenger enters, so I can focus on driving.

**Feature 4: Passenger & Driver Ratings**
*   **Description:** After selecting their drop-off stop and completing the ride, passengers will be prompted to rate the driver out of 5 stars and leave optional feedback.
*   **User Story:** As an admin, I want to monitor average driver ratings to identify poorly performing drivers and ensure high service standards.

**Feature 5: Social OAuth Logins**
*   **Description:** Integration of 'Sign in with Google' and 'Sign in with Apple' for one-click onboarding.
*   **User Story:** As a new user, I want to register instantly using my Google account instead of filling out a form.

---

## 4. Success Metrics & KPIs (Phase 2 Focus)
*   **Reliability:** 99% uptime on WebSocket connections during peak commuting hours (6 AM - 9 AM; 4 PM - 8 PM).
*   **Conversion:** 85% of hails successfully converted into validated QR boardings.
*   **Payment Success:** <2% failure rate on auto-deductions via the Flutterwave integration.
*   **Satisfaction:** Maintain an average driver rating of 4.2/5 stars across the fleet.
