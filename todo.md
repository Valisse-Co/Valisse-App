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

## Remove Likes → Saves as Primary Metric
- [x] Remove like button and like count from Discover feed post cards
- [x] Remove like button and like count from PostDetail page
- [x] Remove like count from TechProfile page
- [x] Update analytics dashboard: replace likes metric with saves metric
- [x] Update analytics: save count per post, total saves per profile
- [x] Update post card icons to bookmark style (not heart)
- [x] Remove getUserLikes / toggleLike from routers (or hide from UI)
- [x] Verify postAnalytics.saves is the source of truth for save counts

## Messages Empty State Fix
- [x] Show role-aware empty state in Messages: nail tech sees "Communicate with clients" copy, client sees "Book a nail tech" copy

## Client View Preview for Nail Techs
- [x] PostDetail: detect ?preview=1 query param and show "Client View" banner at top
- [x] PostDetail: show all tags (style, shape, color) in client view
- [x] PostDetail: rename "Book This Look" to "Book With [Tech Name]" when in preview mode
- [x] PostDetail: add "More from this artist" section with 3-6 other posts from same tech
- [x] TechDashboard Posts tab: tapping a post navigates to /post/:id?preview=1

## Discover Filters: Distance + Soonest Available
- [x] Schema: add lat/lng columns to users table
- [x] Backend: feed procedure accepts distanceMiles and soonestAvailable params
- [x] Backend: proximity filtering using Haversine formula on tech lat/lng
- [x] Backend: soonestAvailable sort — techs with upcoming availability slots ranked first
- [x] Frontend: Distance filter chips (5mi, 10mi, 25mi, 50+mi) with browser geolocation
- [x] Frontend: Soonest Available toggle filter chip
- [x] Frontend: combine new filters with existing style/shape/color filters

## Discover Filters — Follow-up Gaps
- [x] Profile/onboarding: save lat/lng when tech sets their location (geocode text location on profile save)
- [x] Discover: gracefully show techs without lat/lng when distance filter is active (show note or fallback)

## Dual-Account Authentication System
- [x] Schema: add activeMode column to users table (enum: client | nail_tech)
- [x] Backend: switchMode procedure (toggle activeMode between client/nail_tech)
- [x] Backend: becomeNailTech procedure (upgrade client to dual-role)
- [x] Frontend: Login page — email/password UI, Google/Apple buttons, Sign Up / Forgot Password
- [x] Frontend: Onboarding — role selection as first step (Client / Nail Tech)
- [x] Frontend: Account Switcher component — Client Mode / Nail Tech Mode toggle in AppLayout
- [x] Frontend: Settings page — Become a Nail Tech flow, Logout, account info
- [x] Frontend: AppLayout reads activeMode and shows correct nav (client vs tech)
- [x] Frontend: Seamless mode switch — no reload, instant nav change
- [x] Frontend: Logout clears session and returns to Login page

## Booking Flow Rebuild — Real Availability
- [x] Schema: add bufferMinutes column to availability table
- [x] Backend: getAvailableSlots procedure — computes open slots from working hours, existing bookings, blocked times, buffer gaps, and selected duration
- [x] Backend: prevent double bookings at creation time (validate slot is still free)
- [x] Frontend: BookingFlow step 1 — service selection with duration (1h / 1.5h / 2h)
- [x] Frontend: BookingFlow step 2 — calendar date picker (only shows working days)
- [x] Frontend: BookingFlow step 3 — time slot grid: available (selectable) vs unavailable (greyed out)
- [x] Frontend: real-time slot refresh (refetch on date/duration change, no full reload)
- [x] Frontend: smooth transitions between steps
- [x] Frontend: BookingFlow step 4 — confirm screen

## Buffer Time Setting in Schedule Tab
- [x] Schedule tab: add Buffer Time selector (0 / 10 / 15 / 30 / 45 / 60 min) per working day
- [x] Persist bufferMinutes to availability table via setWeeklySchedule procedure
- [x] BookingFlow slot grid already reads bufferMinutes — verify slots respect the new setting

## Buffer Time — Clarification
- [x] Buffer time is a single global setting applied to all working days (not per-day) — simpler UX, consistent with how most booking apps work
- [x] getAvailableSlots in db.ts reads bufferMinutes from availability rows and subtracts it from slot windows — verified by grep (line 774, 883-887)

## Style Tag System Upgrade
- [x] Shared STYLE_TAGS constant with 4 groups: Everyday, Themed, Seasonal, Holidays
- [x] New tags: Nude, Vintage, Disney, Seasonal Nails, Christmas, Halloween, Valentine's Day, Fourth of July, Thanksgiving, New Year's, Easter
- [x] CreatePost: grouped chip selector, 3-tag max, emerald selected state, no custom entry
- [x] Discover: grouped multi-select style filter chips, combine with all existing filters
- [x] Feed ranking: score posts by matching style tag count + recency + saves

## Demo Accounts
- [x] Enable hasDualRole on nail tech account (id=1) so it can switch to client mode
- [x] Create demo client user row in DB with a fixed openId for demo login
- [x] Add /api/demo-login/:role endpoint (dev-only) that issues a session cookie for the demo account
- [x] Add DemoBar component shown only in dev/demo mode with one-click account switching (skipped — direct URLs are simpler)
- [x] Fix Splash.tsx redirect to respect activeMode for dual-role users

## Availability & Booking Calendar Fix
- [x] Audit availability schema, db helpers, and getAvailableSlots logic
- [x] Fix getAvailableSlots to return ALL slots (available + unavailable) with a status field
- [x] Fix BookingFlow calendar to show all days in tech schedule, highlight available ones
- [x] Fix BookingFlow time picker to show all 15-min slots in the day's window, gray out unavailable ones
- [x] Ensure duration-fit check: slot is available only if [startTime + duration] fits within the availability window and doesn't overlap existing bookings
- [x] Add slot reason field to getAvailableSlots (booked / break / outside_hours / past) for richer UI feedback
- [x] Calendar: pre-fetch per-date slot counts so fully-booked days appear grayed out

## Client-Tier Booking Restrictions
- [x] Schema: add clientTier enum ('open' | 'returning_only') to availability table (whole-day recurring)
- [x] Schema: create booking_rules table for time-block-level and one-off date restrictions (techId, dayOfWeek nullable, specificDate nullable, startTime, endTime, clientTier, createdAt)
- [x] Migration: generate and apply SQL for both schema changes
- [x] Backend: getClientTierForSlot(techId, dateStr, timeStr) — resolves effective tier using specificity+recency rules
- [x] Backend: tRPC procedures — setDayTier, bookingRules, addBookingRule, removeBookingRule
- [x] Backend: isReturningClient(clientId, techId) — checks for at least one completed booking
- [x] Backend: enforce tier in getAvailableSlots — mark slots restricted with reason='returning_only' when client is new
- [x] Schedule editor UI: add clientTier selector (Open to All / Returning Only) on each availability day row
- [x] Schedule editor UI: add time-block rule panel — tech can add/edit/delete time-block rules per day (recurring or one-off date)
- [x] BookingFlow client view: gray out restricted slots with label "Returning clients only"
- [x] BookingFlow: pass clientId to availableSlots query so backend can resolve tier per client

## Client-Tier Gaps (follow-up)
- [x] Add clientTierUpdatedAt timestamp to availability table so getClientTierForSlot can compare recency of day-level vs time-block rules
- [x] Update getClientTierForSlot to use actual createdAt/updatedAt comparison for conflict resolution
- [x] Add updateBookingRule db helper + tRPC procedure for editing existing time-block rules
- [x] Schedule editor: add edit button on existing rules (opens pre-filled form)

## Client-Tier Gaps Round 2
- [x] Add updatedAt to booking_rules table; bump it on updateBookingRule; use it in getClientTierForSlot recency comparison
- [x] Expand schedule editor edit form to allow changing rule date/day scope and recurring vs one-off type

## Media Carousel (Post Photos/Videos)
- [x] Audit post media data model (images array, video field) and all render locations
- [x] Build reusable MediaCarousel component: peek-style swipe, dot indicators, pinch-to-zoom, tap-to-play video
- [x] Integrate MediaCarousel into feed card (thumbnail)
- [x] Integrate MediaCarousel into post detail view
- [x] Integrate MediaCarousel into booking flow confirmation step (post preview)

## Subscriptions Feature
- [x] Schema: techFollows table (clientId, techId, createdAt) — unique constraint on (clientId, techId)
- [x] Schema: notifications table already existed; extended with new_post type
- [x] Migration: generated and applied SQL for techFollows table
- [x] Backend: followTech, unfollowTech, isFollowingTech, getTechFollowerCount, getMyFollowedTechs helpers in db.ts
- [x] Backend: tRPC procedures — techFollowsRouter (follow, unfollow, isFollowing, followerCount, myFollows)
- [x] Backend: feed query boost — followed techs' posts ranked first in general feed
- [x] Backend: subscriptionsOnly feed filter — when active, only return posts from followed techs (other style/color filters still apply)
- [x] Backend: post-publish notification trigger — when tech creates a post, insert notification rows for all followers
- [x] Backend: tRPC procedures — notifications.list, notifications.markRead, notifications.markOne, notifications.unreadCount
- [x] Frontend: Subscribe/Unsubscribe button on TechProfile page
- [x] Frontend: Subscriber count shown on TechProfile (public)
- [x] Frontend: "Following" as first filter chip in Discover feed
- [x] Frontend: Feed respects subscriptions filter + existing style/color filters simultaneously
- [x] Frontend: Alerts nav item in client nav bar with unread badge count
- [x] Frontend: Notifications page (/notifications) with list and mark-read
- [x] Frontend: Toast pop-up when a new post notification arrives while client is in-app (30s polling)
