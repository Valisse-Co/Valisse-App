import {
  boolean,
  float,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Valisse-specific
  userType: mysqlEnum("userType", ["client", "nail_tech"]).default("client").notNull(),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  location: text("location"),
  phone: varchar("phone", { length: 32 }),
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  // Client preferences
  stylePreferences: json("stylePreferences").$type<string[]>(),
  colorPreferences: json("colorPreferences").$type<string[]>(),
  // Nail Tech fields
  businessName: text("businessName"),
  businessAddress: text("businessAddress"),
  licenseNumber: varchar("licenseNumber", { length: 64 }),
  yearsExperience: int("yearsExperience"),
  services: json("services").$type<string[]>(),
  priceRange: varchar("priceRange", { length: 32 }),
  instagramHandle: varchar("instagramHandle", { length: 64 }),
  // Avatar storage
  avatarKey: text("avatarKey"),
  // Account state
  darkMode: boolean("darkMode").default(false).notNull(),
  deactivatedAt: timestamp("deactivatedAt"),
  connectedProvider: varchar("connectedProvider", { length: 64 }),
  // Subscription (tech only)
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["trial", "active", "expired", "cancelled"]).default("trial"),
  subscriptionStartedAt: timestamp("subscriptionStartedAt"),
  subscriptionTrialEndsAt: timestamp("subscriptionTrialEndsAt"),
  // Legal consents
  tosVersion: int("tosVersion").default(0).notNull(),
  tosAcceptedAt: timestamp("tosAcceptedAt"),
  privacyAcceptedAt: timestamp("privacyAcceptedAt"),
  smsConsent: boolean("smsConsent").default(false).notNull(),
  smsConsentAt: timestamp("smsConsentAt"),
  // Dual-role account system
  hasDualRole: boolean("hasDualRole").default(false).notNull(),
  activeMode: mysqlEnum("activeMode", ["client", "nail_tech"]).default("client").notNull(),
  // Smart Service Match global toggle (tech only)
  smartMatchEnabled: boolean("smartMatchEnabled").default(true).notNull(),
  // Geolocation for proximity filtering
  lat: float("lat"),
  lng: float("lng"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Subscriptions ────────────────────────────────────────────────────────────
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["trial", "active", "expired", "cancelled", "waived"]).default("trial").notNull(),
  tier: mysqlEnum("tier", ["free_trial", "growth", "monthly"]).default("free_trial").notNull(),
  trialStartedAt: timestamp("trialStartedAt").defaultNow().notNull(),
  trialEndsAt: timestamp("trialEndsAt"),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  followersAtTrialEnd: int("followersAtTrialEnd").default(0),
  growthBonusUnlocked: boolean("growthBonusUnlocked").default(false).notNull(),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;

// ─── Posts ────────────────────────────────────────────────────────────────────
export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  techId: int("techId").notNull(),
  imageUrls: json("imageUrls").$type<string[]>().notNull(),
  caption: text("caption"),
  style: varchar("style", { length: 64 }),
  shape: varchar("shape", { length: 64 }),
  color: varchar("color", { length: 64 }),
  colors: json("colors").$type<string[]>().default([]).notNull(),
  serviceId: int("serviceId"),
  location: text("location"),
  isPromoted: boolean("isPromoted").default(false).notNull(),
  promotedUntil: timestamp("promotedUntil"),
  status: mysqlEnum("status", ["published", "draft", "hidden"]).default("published").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

// ─── Post Analytics ───────────────────────────────────────────────────────────
export const postAnalytics = mysqlTable("post_analytics", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull().unique(),
  views: int("views").default(0).notNull(),
  likes: int("likes").default(0).notNull(),
  saves: int("saves").default(0).notNull(),
  bookingsFromPost: int("bookingsFromPost").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PostAnalytics = typeof postAnalytics.$inferSelect;

// ─── Likes ────────────────────────────────────────────────────────────────────
export const likes = mysqlTable("likes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  postId: int("postId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Collections (Saved boards) ───────────────────────────────────────────────
export const collections = mysqlTable("collections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  coverImageUrl: text("coverImageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Collection = typeof collections.$inferSelect;

// ─── Saved Posts ──────────────────────────────────────────────────────────────
export const savedPosts = mysqlTable("saved_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  postId: int("postId").notNull(),
  collectionId: int("collectionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SavedPost = typeof savedPosts.$inferSelect;

// ─── Follows ──────────────────────────────────────────────────────────────────
export const follows = mysqlTable("follows", {
  id: int("id").autoincrement().primaryKey(),
  followerId: int("followerId").notNull(),
  followingId: int("followingId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Availability ─────────────────────────────────────────────────────────────
export const availability = mysqlTable("availability", {
  id: int("id").autoincrement().primaryKey(),
  techId: int("techId").notNull(),
  dayOfWeek: int("dayOfWeek").notNull(), // 0=Sun … 6=Sat
  startTime: varchar("startTime", { length: 8 }).notNull(), // "09:00"
  endTime: varchar("endTime", { length: 8 }).notNull(),     // "17:00"
  isActive: boolean("isActive").default(true).notNull(),
  breakStart: varchar("breakStart", { length: 8 }),  // "12:00" optional
  breakEnd: varchar("breakEnd", { length: 8 }),      // "13:00" optional
  bufferMinutes: int("bufferMinutes").default(0).notNull(), // gap between appointments
  // Client-tier restriction for the whole day (can be overridden by booking_rules)
  clientTier: mysqlEnum("clientTier", ["open", "returning_only"]).default("open").notNull(),
  // Timestamp of the last clientTier change — used for recency-based conflict resolution
  clientTierUpdatedAt: timestamp("clientTierUpdatedAt").defaultNow().notNull(),
});

export type Availability = typeof availability.$inferSelect;

// ─── Booking Rules (client-tier restrictions on time blocks) ─────────────────
// These override the day-level clientTier on the availability row.
// Specificity + recency: the most recently created rule for a given time window wins.
export const bookingRules = mysqlTable("booking_rules", {
  id: int("id").autoincrement().primaryKey(),
  techId: int("techId").notNull(),
  // Recurring rule: applies every week on this day-of-week (0=Sun…6=Sat)
  dayOfWeek: int("dayOfWeek"),
  // One-off rule: applies only on this specific date (overrides recurring if more recent)
  specificDate: timestamp("specificDate"),
  startTime: varchar("startTime", { length: 8 }).notNull(), // "09:00"
  endTime: varchar("endTime", { length: 8 }).notNull(),     // "12:00"
  clientTier: mysqlEnum("clientTier", ["open", "returning_only"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BookingRule = typeof bookingRules.$inferSelect;
export type InsertBookingRule = typeof bookingRules.$inferInsert;

// ─── Schedule Blocks (blocked-off time) ──────────────────────────────────────
export const scheduleBlocks = mysqlTable("schedule_blocks", {
  id: int("id").autoincrement().primaryKey(),
  techId: int("techId").notNull(),
  blockDate: timestamp("blockDate").notNull(),
  startTime: varchar("startTime", { length: 8 }).notNull(),
  endTime: varchar("endTime", { length: 8 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduleBlock = typeof scheduleBlocks.$inferSelect;

// ─── Last-Minute Slots ────────────────────────────────────────────────────────
export const lastMinuteSlots = mysqlTable("last_minute_slots", {
  id: int("id").autoincrement().primaryKey(),
  techId: int("techId").notNull(),
  slotDate: timestamp("slotDate").notNull(),
  duration: int("duration").default(60).notNull(), // minutes
  note: text("note"),
  isBooked: boolean("isBooked").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LastMinuteSlot = typeof lastMinuteSlots.$inferSelect;

// ─── Bookings ─────────────────────────────────────────────────────────────────
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  techId: int("techId").notNull(),
  postId: int("postId"),
  serviceType: varchar("serviceType", { length: 128 }),
  scheduledAt: timestamp("scheduledAt").notNull(),
  duration: int("duration").default(60).notNull(), // minutes
  status: mysqlEnum("status", ["pending", "confirmed", "declined", "cancelled", "completed"]).default("pending").notNull(),
  depositPaid: boolean("depositPaid").default(false).notNull(),
  notes: text("notes"),
  techNotes: text("techNotes"),
  // Cancellation tracking
  cancelledBy: mysqlEnum("cancelledBy", ["client", "tech"]),
  cancelledAt: timestamp("cancelledAt"),
  cancellationFeeStatus: mysqlEnum("cancellationFeeStatus", ["none", "pending", "waived", "charged"]).default("none").notNull(),
  cancellationFeeAmount: float("cancellationFeeAmount"), // resolved fee in dollars at time of cancel
  // Smart Service Match
  needsReview: boolean("needsReview").default(false).notNull(),
  reviewAnswers: json("reviewAnswers").$type<Record<string, string>>(),
  reviewRecommendedService: varchar("reviewRecommendedService", { length: 128 }),
  reviewPhotoUrls: json("reviewPhotoUrls").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  techId: int("techId").notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  senderId: int("senderId").notNull(),
  content: text("content"),
  imageUrl: text("imageUrl"),
  bookingId: int("bookingId"),
  type: mysqlEnum("type", ["text", "image", "booking_request", "booking_card"]).default("text").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull().unique(),
  clientId: int("clientId").notNull(),
  techId: int("techId").notNull(),
  rating: int("rating").notNull(), // 1-5
  text: text("text"),
  photoUrl: text("photoUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  body: text("body"),
  relatedId: int("relatedId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── Tech Follows (client subscribes to a tech page) ─────────────────────────
export const techFollows = mysqlTable("tech_follows", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  techId: int("techId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.clientId, t.techId),
}));

export type TechFollow = typeof techFollows.$inferSelect;
export type InsertTechFollow = typeof techFollows.$inferInsert;

// ─── Post Reports ─────────────────────────────────────────────────────────────
export const postReports = mysqlTable("post_reports", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  reporterId: int("reporterId").notNull(),
  reason: mysqlEnum("reason", [
    "nudity",
    "stolen_content",
    "spam",
    "harassment",
    "violence",
    "other",
  ]).notNull(),
  note: text("note"),
  status: mysqlEnum("status", ["pending", "dismissed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uniqReporterPost: unique().on(t.reporterId, t.postId),
}));

export type PostReport = typeof postReports.$inferSelect;
export type InsertPostReport = typeof postReports.$inferInsert;

// ─── Cancellation Policies ────────────────────────────────────────────────────
// Each nail tech can define their own cancellation policy.
// windowHours: how many hours before the appointment the client can cancel for free.
// feeType: flat dollar amount or percentage of service price.
// feeAmount: dollar amount (if flat) or percentage 0-100 (if percent).
// gracePeriodHours: always-free window immediately after booking (default 1h).
export const cancellationPolicies = mysqlTable("cancellation_policies", {
  id: int("id").autoincrement().primaryKey(),
  techId: int("techId").notNull().unique(),
  windowHours: int("windowHours").default(24).notNull(), // 24, 48, 72, 96, 120, 144, 168
  feeType: mysqlEnum("feeType", ["flat", "percent"]).default("flat").notNull(),
  feeAmount: float("feeAmount").default(0).notNull(), // dollars if flat, 0-100 if percent
  gracePeriodHours: int("gracePeriodHours").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CancellationPolicy = typeof cancellationPolicies.$inferSelect;
export type InsertCancellationPolicy = typeof cancellationPolicies.$inferInsert;

// ─── Tech Services ────────────────────────────────────────────────────────────
// Each nail tech can define their offered services with price, duration, and photo.
export const techServices = mysqlTable("tech_services", {
  id: int("id").autoincrement().primaryKey(),
  techId: int("techId").notNull(),
  category: varchar("category", { length: 64 }).notNull(), // e.g. "Gel", "Acrylic", "Custom"
  customName: varchar("customName", { length: 128 }), // override display name
  photoKey: text("photoKey"),   // S3 key
  photoUrl: text("photoUrl"),   // served URL
  priceInCents: int("priceInCents").default(0).notNull(), // price in cents
  durationMinutes: int("durationMinutes").default(60).notNull(), // 5-min increments, max 360
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  smartMatchEnabled: boolean("smartMatchEnabled").default(true).notNull(), // per-service Smart Match toggle
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TechService = typeof techServices.$inferSelect;
export type InsertTechService = typeof techServices.$inferInsert;

// ─── Smart Match Configs ──────────────────────────────────────────────────────
// System defaults have techId = null. Tech overrides have a techId.
// questions: Array<{ id: string; text: string; options: string[] }>
// rules: Array<{ if: string[]; recommend: string; outcome: 'match'|'recommend'|'review' }>
export const smartMatchConfigs = mysqlTable("smart_match_configs", {
  id: int("id").autoincrement().primaryKey(),
  techId: int("techId"),           // null = system default
  serviceCategory: varchar("serviceCategory", { length: 128 }).notNull(),
  questions: json("questions").$type<Array<{ id: string; text: string; options: string[] }>>().notNull(),
  rules: json("rules").$type<Array<{ if: string[]; recommend: string; outcome: "match" | "recommend" | "review" }>>().notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SmartMatchConfig = typeof smartMatchConfigs.$inferSelect;
export type InsertSmartMatchConfig = typeof smartMatchConfigs.$inferInsert;

// ─── Smart Match Responses ────────────────────────────────────────────────────
// Stores the client's questionnaire answers and the resulting outcome.
// photoUrls: S3 URLs for any inspiration photos uploaded during the questionnaire.
export const smartMatchResponses = mysqlTable("smart_match_responses", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  techId: int("techId").notNull(),
  serviceCategory: varchar("serviceCategory", { length: 128 }).notNull(),
  answers: json("answers").$type<Record<string, string>>().notNull(),
  outcome: mysqlEnum("outcome", ["match", "recommend", "review"]).notNull(),
  recommendedService: varchar("recommendedService", { length: 128 }),
  photoUrls: json("photoUrls").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SmartMatchResponse = typeof smartMatchResponses.$inferSelect;
export type InsertSmartMatchResponse = typeof smartMatchResponses.$inferInsert;

// ─── Notification Preferences ─────────────────────────────────────────────────
// Per-user, per-type channel preferences (in-app, SMS, email).
export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  inApp: boolean("inApp").default(true).notNull(),
  sms: boolean("sms").default(false).notNull(),
  email: boolean("email").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uniqUserType: unique().on(t.userId, t.type),
}));

export type NotificationPreference = typeof notificationPreferences.$inferSelect;

// ─── Privacy Settings ─────────────────────────────────────────────────────────
export const privacySettings = mysqlTable("privacy_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Client controls
  profilePrivate: boolean("profilePrivate").default(false).notNull(),
  hideBookingHistory: boolean("hideBookingHistory").default(false).notNull(),
  hideFromNearMe: boolean("hideFromNearMe").default(false).notNull(),
  // Tech controls
  discoverVisible: boolean("discoverVisible").default(true).notNull(),
  hideExactAddress: boolean("hideExactAddress").default(false).notNull(),
  messagePermission: mysqlEnum("messagePermission", ["anyone", "booked_only"]).default("anyone").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PrivacySettings = typeof privacySettings.$inferSelect;

// ─── Blocked Users ────────────────────────────────────────────────────────────
export const blockedUsers = mysqlTable("blocked_users", {
  id: int("id").autoincrement().primaryKey(),
  blockerId: int("blockerId").notNull(),
  blockedId: int("blockedId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uniqBlock: unique().on(t.blockerId, t.blockedId),
}));

export type BlockedUser = typeof blockedUsers.$inferSelect;
