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

## Report Inappropriate Content
- [x] Schema: post_reports table (id, postId, reporterId, reason, note, status: pending|dismissed, createdAt)
- [x] Schema: posts table already has status='hidden' — used instead of separate isHidden field
- [x] Migration: generated and applied SQL for post_reports table
- [x] Backend: submitReport helper with duplicate guard (unique constraint on reporterId+postId)
- [x] Backend: getReportsForAdmin, dismissReport, hidePostByAdmin, deletePostByAdmin helpers
- [x] Backend: tRPC procedures — reports.submit, reports.hasReported, reports.list (admin), reports.dismiss, reports.hidePost, reports.deletePost
- [x] Backend: notify tech on report (in-app notification), notify owner/admin on report (notifyOwner)
- [x] Frontend: Report button (flag icon) on PostDetail and Discover feed card
- [x] Frontend: ReportSheet bottom sheet — reason selector (6 options) + optional note field + submit
- [x] Frontend: Duplicate guard — show "Already reported" state if user has reported this post
- [x] Frontend: posts with status='hidden' are already excluded from feed query (status filter in getDiscoverFeed)
- [x] Frontend: Admin panel (/admin/reports) — list of pending reports with post preview, reason, reporter, actions (Hide Post / Dismiss / Delete Post)
- [x] Frontend: Admin nav entry visible only to admin role users (added to AppLayout)
- [x] Demo: promoted Ashton Earl (id=1) to admin role in DB

## Report Feature Gaps
- [x] Hide hidden posts in PostDetail for non-admin users (show not found/removed state unless admin)
- [x] Add admin-only nav entry to AppLayout linking to /admin/reports

## Onboarding Flow (ToS / Privacy / SMS Consent)
- [x] Schema: add tosVersion (int), tosAcceptedAt, privacyAcceptedAt, smsConsent (bool), smsConsentAt to users table
- [x] Migration: generate and apply SQL
- [x] Backend: users.getConsentStatus procedure (returns needsConsent, currentVersion, userVersion, smsConsent)
- [x] Backend: users.acceptConsents procedure (writes tosVersion, tosAcceptedAt, privacyAcceptedAt, smsConsent, smsConsentAt)
- [x] Backend: re-consent gate — if CURRENT_TOS_VERSION > user.tosVersion, needsConsent=true
- [x] Frontend: Onboarding flow — role selection → profile setup → ConsentStep (final step)
- [x] Frontend: ConsentStep component — ToS + Privacy Policy + SMS opt-in checkboxes, Continue button
- [x] Frontend: TermsOfService full-text page at /terms
- [x] Frontend: PrivacyPolicy full-text page at /privacy
- [x] Frontend: Consent gate in App.tsx (ConsentGate wrapper) — blocks already-onboarded users who need re-consent
- [x] Frontend: /terms and /privacy registered as public routes in App.tsx

## Cancellation Policy Enforcement
- [x] Schema: cancellation_policies table (techId, windowHours 24-168, feeType flat|percent, feeAmount, gracePeriodHours=1, createdAt, updatedAt)
- [x] Schema: bookings table — add cancellationFeeStatus (none|pending|waived|charged), cancellationFeeAmount, cancelledBy (client|tech), cancelledAt
- [x] Migration: generate and apply SQL for both schema changes
- [x] Backend: cancellation.getPolicy (by techId, public), cancellation.setPolicy (protected, nail_tech only)
- [x] Backend: cancellation.cancel — enforce grace period, detect late cancel, set cancellationFeeStatus=pending if late, set cancelledBy
- [x] Backend: cancellation.waiveFee (tech-only), cancellation.markFeeCharged (admin/future Stripe hook)
- [x] Backend: cancellation.alternativeTechs — given a cancelled booking, return techs with open slots on same day ±1 day, same service type, sorted by proximity
- [x] Backend: resolveCancellationFee pure function (grace period, window check, flat/percent)
- [x] Frontend: TechBookings / Schedule tab — Cancellation Policy panel (window selector, fee type toggle, fee amount input, save button)
- [x] Frontend: BookingFlow confirm step — show policy summary with fee warning before client confirms
- [x] Frontend: Client Bookings — CancelDialog with grace period vs late-cancel distinction; fee warning before confirming
- [x] Frontend: Client Bookings — cancelled bookings with pending fee show "Pending fee: $X" badge
- [x] Frontend: Tech-cancel flow — tech confirms cancellation, backend sets cancelledBy=tech; client sees notification
- [x] Frontend: AltTechsModal in Notifications — shown to client after tech cancels; lists nearby techs with open slots, same service, same day ±1 day
- [x] Tests: resolveCancellationFee unit tests (grace, outside window, inside window, percent, null price)
- [x] Tests: cancellation router procedure tests — 20 tests passing

## Logo Integration
- [x] Generate transparent-background logo PNG from Valisse_Logo.png (remove solid emerald square, keep circle mark)
- [x] Upload transparent logo as static webdev asset, get permanent URL
- [x] Update nav header: show logo mark + "Valisse" wordmark side by side (always-visible top bar)
- [x] Replace favicon with logo (32x32 and 180x180 PNG favicons + apple-touch-icon in index.html)
- [x] Add logo to splash/loading screen (replaces SVG placeholder, centered with animation)
- [x] Add logo to onboarding welcome screen (above "Welcome to Valisse" headline)
- [x] Replace text loading spinners in App.tsx with logo + spinner combo

## Settings Page & Sub-sections
- [x] Schema: add tech_services table (techId, category, customName, photoKey, photoUrl, priceInCents, durationMinutes, sortOrder, isActive)
- [x] Schema: add notification_preferences table (userId, type, inApp, sms, email)
- [x] Schema: add privacy_settings table (userId, profilePrivate, hideBookingHistory, hideFromNearMe, hideExactAddress, messagePermission, discoverVisible)
- [x] Schema: add blocked_users table (blockerId, blockedId, createdAt)
- [x] Schema: update users table — add phone, bio, location, avatarKey, avatarUrl, darkMode (bool), deactivatedAt, subscriptionStatus, subscriptionStartedAt, connectedProvider
- [x] Migration: generate and apply SQL
- [x] Backend: settings.updateProfile (client + tech fields), settings.getProfile
- [x] Backend: settings.getServices / settings.upsertService / settings.deleteService / settings.getServicesByTechId (public)
- [x] Backend: settings.getNotificationPreferences / settings.updateNotificationPreference
- [x] Backend: settings.getPrivacySettings / settings.updatePrivacySettings
- [x] Backend: settings.getBlockedUsers / settings.blockUser / settings.unblockUser
- [x] Backend: settings.updateDisplayName / settings.deactivateAccount / settings.getSubscriptionStatus
- [x] Frontend: Settings page shell — sectioned list with chevrons, user avatar + name header
- [x] Frontend: SettingsProfile sub-page — client + tech fields, avatar upload, services manager (add/edit/delete, photo per service, 5-min duration increments up to 6h)
- [x] Frontend: SettingsNotifications sub-page — grouped by type, per-channel (in-app/SMS/email) toggle rows
- [x] Frontend: SettingsPrivacy sub-page — client + tech controls, block user management (searchable, sorted by recent interaction)
- [x] Frontend: SettingsAccount sub-page — connected provider display, change display name, logout, deactivate account (soft)
- [x] Frontend: SettingsSubscription sub-page — trial countdown, status badge, Stripe CTA placeholder
- [x] Frontend: SettingsAppearance — dark/light mode toggle, persisted to DB
- [x] Frontend: SettingsSupport — links to ToS, Privacy Policy, Contact Support, Rate Valisse, Share App
- [x] Wire services into BookingFlow — tech's actual services (price + duration) replace hardcoded list; fallback defaults if no services set

## Color/Style Expansion, Multi-Color, Similar Matches, Post-Service Linking
- [x] Shared constants: add Brown, Nude/Beige, Burgundy, Coral, Lavender, Sage/Olive, Orange, Yellow, Peach, Rose Gold to COLOR_OPTIONS; remove Metallic/Holographic/Chrome from colors
- [x] Shared constants: add 3D Nails, Ombré, Chrome/Mirror, Stamping, Encapsulated, Press-On, Metallic, Holographic to STYLE_OPTIONS
- [x] Schema: add serviceId (FK → tech_services) to posts table; migration + apply
- [x] Backend: update getDiscoverFeed — exact-match bucket vs partial-match bucket, location default 10mi always active, multi-color auto-tag logic, score by match count within partial bucket
- [x] Backend: update createPost / updatePost procedures to require serviceId; add createServiceInline procedure for post creation flow
- [x] Frontend: Discover filter panel — multi-select colors, new styles, Multi-Color filter chip, location radius default 10mi
- [x] Frontend: Discover feed — similar-matches divider (subtle gray line + "Similar Matches" centered text) between exact and partial buckets
- [x] Frontend: Post cards — multi-color chip (shows "Multi-Color" + expands on tap to show all color tags)
- [x] Frontend: CreatePost — required service selector (pick from saved or create inline), multi-color tag selection
- [x] Frontend: PostDetail / feed cards — "Book This Look" auto-selects linked service → time slot picker with service summary at top; "Book Another Look" second button → navigates to service list page → booking flow
- [x] Frontend: TechProfile — "Book a Look" generic button → service list page → booking flow
- [x] Frontend: BookingFlow — service summary header (name, price, duration) shown at top of time slot picker step

## Apple Sign In & Google Sign In
- [x] Backend: add /api/oauth/google/start and /api/oauth/google/callback routes (credential-gated via GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars)
- [x] Backend: add /api/oauth/apple/start and /api/oauth/apple/callback routes (credential-gated via APPLE_CLIENT_ID / APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY env vars)
- [x] Backend: shared upsertSocialUser helper — find-or-create user by provider+sub, set connectedProvider field
- [x] Backend: issue same session cookie as Manus OAuth on successful social login
- [x] Frontend: Login page — add Apple and Google buttons with official branding
- [x] Frontend: buttons show "Coming Soon" tooltip / disabled state when provider env vars are absent (VITE_GOOGLE_ENABLED / VITE_APPLE_ENABLED feature flags)
- [x] Frontend: existing Manus "Sign In / Create Account" button remains as primary fallback for demo
- [x] Secrets: add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY placeholders (empty = disabled)

## Post Removal Options (Archive / Hide / Delete)
- [x] Schema: add status enum ('published','archived','hidden') to posts table; default 'published'; migration + apply
- [x] Backend: updatePostStatus procedure — sets status to 'archived' or 'hidden' (protectedProcedure, owner-only)
- [x] Backend: deletePost procedure — hard delete (protectedProcedure, owner-only, with confirmation flag)
- [x] Backend: getMyPosts procedure — returns all posts for the tech including archived/hidden with status field
- [x] Backend: restorePost procedure — sets status back to 'published'
- [x] Backend: feed/discover queries filter to status='published' only
- [x] Frontend: replace "Remove" button/menu item with "Manage Post" sheet showing Archive, Hide, Delete options
- [x] Frontend: Archive option — greyed card with lock icon, tooltip "Hidden from public, bookings still work"
- [x] Frontend: Hide option — unlisted, tooltip "Not in discover feed, direct link still works"
- [x] Frontend: Delete option — confirmation dialog with "This cannot be undone" warning
- [x] Frontend: Tech Dashboard Posts tab — show archived/hidden posts in a separate section with Restore button

## Account Deactivation & Permanent Deletion

- [x] Backend: deactivateAccount procedure — cancel all upcoming bookings (client pays fee if they are the cancelling party), hide tech posts (status→hidden), set user.status = "deactivated", send in-app notification to the other party on each cancelled booking
- [x] Backend: reactivateAccount procedure — set user.status = "active", restore tech posts (status→published)
- [x] Backend: permanentDeleteAccount procedure — cancel upcoming bookings (same fee logic), notify other party, hard-delete all user data (posts, bookings, services, messages, reviews, notifications, follows), delete user row
- [x] Backend: auth.me returns deactivated flag when user.status = "deactivated" so frontend can gate access
- [x] Frontend: Settings — replace single "Deactivate" button with two side-by-side options: "Deactivate Account" and "Delete Account Permanently"
- [x] Frontend: Deactivation warning modal — list upcoming bookings that will be cancelled, state cancellation fees apply for client-initiated cancellations, require typed confirmation ("DEACTIVATE")
- [x] Frontend: Permanent deletion warning modal — same booking/fee warning plus stronger language ("all data will be erased, this cannot be undone"), require typed confirmation ("DELETE")
- [x] Frontend: Reactivation gate — after sign-in, if account is deactivated show full-screen "Your account is deactivated" page with single "Reactivate My Account" button before granting access to the app

## Smart Service Match
- [x] Schema: smart_match_configs table (id, techId nullable, serviceCategory, questions JSON, rules JSON, isEnabled, createdAt, updatedAt); smart_match_responses table (id, bookingId, techId, serviceCategory, answers JSON, outcome, recommendedService, photoUrls JSON, createdAt); bookings.needsReview bool default false, bookings.reviewAnswers JSON, bookings.reviewRecommendedService; migration + apply
- [x] Seed: 13 default questionnaire configs (Gel Manicure, Structured Gel, Acrylic Full Set, Acrylic Fill, Gel-X, Dip Powder, Manicure, Pedicure, Nail Art/Add-Ons, Removal, Repair, Press-On, Custom/Not Sure) as system defaults (techId=null)
- [x] Backend: getSmartMatchConfig(techId, serviceCategory) — returns tech-customized config if exists, else system default
- [x] Backend: evaluateSmartMatchRules(answers, rules) — pure function returning outcome (match|recommend|review) + recommendedService
- [x] Backend: submitSmartMatchResponse — save answers, outcome, photo S3 uploads, link to booking; if outcome=review set booking.needsReview=true
- [x] Backend: getTechBookings — sort needsReview=true first, then by scheduledAt; include reviewAnswers + reviewRecommendedService
- [x] Backend: techReviewAction procedure — approve | changeService | requestInfo | adjustPriceDuration
- [x] Backend: getSmartMatchConfigs (tech dashboard) — list all categories with tech overrides
- [x] Backend: updateSmartMatchConfig — tech can edit questions/rules/isEnabled per category
- [x] Backend: globalSmartMatchToggle — settings.updateProfile adds smartMatchEnabled bool to tech profile
- [x] Backend: perServiceSmartMatch — tech_services.smartMatchEnabled bool column; migration + apply
- [x] Frontend: BookingFlow — after service selected, check if smart match is enabled (global + per-service); if yes insert Smart Match step before date picker
- [x] Frontend: Smart Match questionnaire UI — progress indicator (Q 1 of 3), large touch-target choice buttons, back navigation, smooth step transitions
- [x] Frontend: Smart Match photo upload step — shown for Nail Art/Add-Ons and Custom categories; S3 upload, preview thumbnails
- [x] Frontend: Smart Match outcome — Match screen (green check, "Great! Your selected service looks like the right choice", continue to date picker)
- [x] Frontend: Smart Match outcome — Recommend screen (recommended service name, 3 action buttons: Switch / Send to Tech / Continue Anyway)
- [x] Frontend: Smart Match outcome — Review screen (send to tech as primary, continue anyway, go back)
- [x] Frontend: Tech Dashboard — Smart Match tab with category list; per-category toggle + question/rule editor (add/edit/delete questions, edit rules)
- [x] Frontend: Tech Dashboard Bookings tab — Needs Review cards sorted to top with amber badge; expandable panel showing client answers + recommended service; action buttons (Approve / Change Service / Request Info / Adjust Price+Duration)
- [x] Frontend: Settings Profile — global Smart Match on/off toggle for tech (smartMatchEnabled)
- [x] Frontend: Service create/edit dialog — per-service Smart Match toggle (smartMatchEnabled on tech_services row)

## Last-Minute Slots (Enhanced)
- [x] Schema: update last_minute_slots table — add date (DATE), startTime (VARCHAR), endTime (VARCHAR), note (TEXT), isPushed (BOOLEAN), expiresAt (BIGINT); migration applied
- [x] Backend: createLastMinuteSlot, deleteLastMinuteSlot, getActiveSlotsForTech (public, filters expired), getTechOwnSlots (protected) helpers in db.ts
- [x] Backend: lastMinuteSlots router — create (sends follower in-app notifications; $5 push placeholder), delete, list public, list own
- [x] Backend: getDiscoverFeed injects active slot cards into feed results (mixed in, not separate section)
- [x] Frontend: TechDashboard — "Post Last-Minute Slot" sheet: date picker (today + 7 days), start/end time dropdowns (AM/PM), optional note, "Push for $5" placeholder button (Stripe coming soon)
- [x] Frontend: Discover feed — LastMinuteSlotCard component (urgent styling, date, time range, tech name/avatar, Book Now CTA)
- [x] Frontend: TechProfile Schedule tab — active last-minute slots shown above weekly hours
- [x] Auto-expiry: slots filtered out of feed/profile when current time > slot end time on the slot date

## Alerts Tab — Last-Minute Slot Badge
- [x] Backend: getUnreadSlotNotificationCount helper (filters by type=last_minute_slot, isRead=false)
- [x] Backend: notifications.unreadSlotCount tRPC procedure (polled every 30s)
- [x] Frontend: AppLayout — Alerts nav icon switches to filled Zap when unreadSlotCount > 0
- [x] Frontend: AppLayout — toast.warning for new last_minute_slot notifications (8s, "Book Now" action)
- [x] Frontend: Notifications page — slot notifications pinned at top in dedicated "Last-Minute Openings" section
- [x] Frontend: Slot notification card — gradient accent bar, Zap icon, pulsing "new" badge, "Book Now" CTA
- [x] Frontend: Slot section header — pulsing dot + count badge ("2 new") when unread slots exist
- [x] Frontend: Regular notifications shown below with "Other Notifications" divider

## Save / Album Feature Rebuild
- [x] Schema: add unique constraint on saved_posts(userId, postId) for canonical save row; add post_album_memberships table (id, userId, postId, collectionId, createdAt) for multi-album membership; migration + apply
- [x] Backend: savePost helper (upsert canonical save row, increment analytics.saves); unsavePost helper (delete save row + all album memberships, decrement analytics.saves)
- [x] Backend: setAlbumMemberships(userId, postId, collectionIds[]) — replaces all album memberships for a post in one call
- [x] Backend: getPostSaveState(userId, postId) — returns { isSaved, albumIds[] }
- [x] Backend: getSavedPostIds(userId) — batch saved post IDs for feed icon state
- [x] Backend: getSavedPostsForAlbum(userId, collectionId | null) — null = All Saved
- [x] Backend: getCollectionsWithMeta(userId) — returns collections with post count and cover image
- [x] Backend: tRPC procedures — posts.saveState, posts.save, posts.unsave, posts.setAlbumMemberships, collections.listWithMeta, collections.postsInAlbum, collections.savedPostIds
- [x] Frontend: SaveAlbumSheet component — bottom sheet with checkbox list of custom albums, "New Album" inline input, Save/Done button
- [x] Frontend: Discover feed — bookmark icon opens SaveAlbumSheet; green when isSaved; sheet pre-checks current albums
- [x] Frontend: PostDetail — bookmark icon opens SaveAlbumSheet; green when isSaved
- [x] Frontend: Saved page — grid tiles: "All Saved" first, then custom album tiles; tap tile navigates to album detail view
- [x] Frontend: Album detail view — grid of posts in that album, with unsave/remove option

## Location / Distance Feature
- [x] Schema: add fullAddress (TEXT), addressLat (DOUBLE), addressLng (DOUBLE), addressCity (VARCHAR), addressState (VARCHAR), fuzzedLat (DOUBLE), fuzzedLng (DOUBLE) to users table; migration applied
- [x] Backend: geocodeAddress(address) helper using Google Maps Geocoding API; generateFuzzedCoords(lat, lng) helper (random offset within 0.5–1 mi radius)
- [x] Backend: updateTechAddress procedure (protectedProcedure) — accepts fullAddress, geocodes it, stores real + fuzzed coords, city, state
- [x] Backend: getDiscoverFeed returns addressCity, addressState, fuzzedLat, fuzzedLng (never real lat/lng) for each tech
- [x] Backend: getPostById / TechProfile returns addressCity, addressState, fuzzedLat, fuzzedLng
- [x] Backend: booking confirmation page — when booking status = confirmed, return fullAddress to the client who owns the booking
- [x] Frontend: Onboarding (tech) — Google Places address autocomplete input; on select, call updateTechAddress
- [x] Frontend: Discover — on first visit, prompt for browser geolocation permission; fallback to manual city/zip entry; store in localStorage
- [x] Frontend: Discover — show "X.X mi away · City, ST" under tech name on post cards using client coords vs tech fuzzed coords
- [x] Frontend: TechProfile — show "City, ST · ~X.X mi away" in header; show fuzzed map pin with circle radius overlay
- [x] Frontend: BookingConfirmation — show full address section when booking.status === "confirmed"

## Location Feature Follow-ups
- [x] SettingsProfile: add Google Places address autocomplete for existing techs (same flow as onboarding)
- [x] Discover: add "Nearest First" sort chip that ranks feed by distance (requires client coords)
- [x] PostDetail: add city/state + distance label to tech preview card
