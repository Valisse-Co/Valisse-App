# Valisse — Project TODO

## Phase 1: Design System & Database Schema
- [x] Global CSS variables (eggshell white, dusty rose primary, beige, warm accents)
- [x] Google Fonts integration (Cormorant Garamond + DM Sans)
- [x] Database schema: 15 tables (users, posts, postAnalytics, collections, savedPosts, likes, bookings, availability, lastMinuteSlots, conversations, messages, reviews, subscriptions, follows, notifications)
- [x] Server db.ts: all query helpers for all 15 tables
- [x] tRPC routers: auth, users, posts, collections, bookings, availability, lastMinute, messaging, reviews, analytics, subscriptions, notifications

## Phase 2: Splash, Onboarding & Auth
- [x] Splash screen with animated logo and tagline "Book the Look You Love"
- [x] Onboarding flow for Clients (style preferences, color preferences, location)
- [x] Onboarding flow for Nail Techs (business name, bio, services, price range, phone)
- [x] Dual-role registration: Client vs Nail Tech
- [x] Login / logout flow with Manus OAuth

## Phase 3: Client Experience
- [x] Discover feed: 2-column masonry grid with style/shape/color filters
- [x] Post card component (image, tech name, location, save/like button)
- [x] Post detail page: fullscreen image, nail tech preview, "Book This Look" CTA, "Message" CTA
- [x] Nail Tech profile page: portfolio grid, bio, location, prices, services, reviews, follower count
- [x] Saved collections: create/delete named boards, save/unsave posts, filter by collection
- [x] Client bookings page: upcoming/past tabs, cancel, leave review CTA

## Phase 4: Nail Tech Experience
- [x] Nail Tech dashboard with analytics cards (views, likes, bookings, booking rate)
- [x] Create/edit post: multi-image upload, caption, style/shape/color tags, location
- [x] Edit / delete posts from dashboard
- [x] Analytics: views, likes, booking rate per post and overall
- [x] Last-minute slots: create with date/time/note, list view, delete from dashboard

## Phase 5: Booking System
- [x] Booking flow: 3-step wizard (service → date/time → confirm), success screen
- [x] Nail Tech: confirm/decline/complete bookings
- [x] Client: upcoming and past bookings history
- [x] Nail Tech: booking management with pending/upcoming/past tabs

## Phase 6: Messaging, Reviews & Subscriptions
- [x] Messaging: conversation list page
- [x] Real-time chat with 3-second polling, send text messages
- [x] Book CTA in chat header for clients
- [x] Reviews: star rating display on profiles, review cards with client name/date/text
- [x] Aggregate ratings displayed on nail tech profiles
- [x] Subscription tiers: Free / Pro ($29/mo) / Pro Annual ($249/yr) with feature comparison

## Phase 7: Polish & QA
- [x] Mobile-first responsive layout (max-w-md centered)
- [x] Smooth animations and transitions (framer-motion)
- [x] Loading states and empty states on all pages
- [x] Bottom navigation: client (Discover/Messages/Bookings/Saved) and tech (Dashboard/Messages/Bookings/Post)
- [x] Vitest unit tests: 10 tests passing (auth, role-based access, analytics)
- [x] Final checkpoint and delivery

## Color System Fix
- [x] Replace all blush/pink/red CSS variables with emerald (#0F8F6F) and eggshell (#F7F4EE)
- [x] Sweep all page files for hardcoded pink/red/blush Tailwind classes and replace with emerald
- [x] Update buttons, CTAs, active nav states, icons, highlights to emerald
- [x] Verify no pink/red accents remain anywhere in the UI

## TechBookings Page Rebuild
- [x] Backend: tRPC procedure for today's bookings (filtered by current date)
- [x] Backend: tRPC procedures for weekly schedule (get/set working days, hours, breaks, blocks)
- [x] Frontend: Today tab — vertical timeline of today's appointments with client name, time, service, status
- [x] Frontend: Schedule tab — weekly availability editor (working days toggle, hours per day, breaks, blocked time)
- [x] Clean minimal layout, fast to edit, no clutter
