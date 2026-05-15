import {
  boolean,
  float,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
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
  services: json("services").$type<string[]>(),
  priceRange: varchar("priceRange", { length: 32 }),
  instagramHandle: varchar("instagramHandle", { length: 64 }),
  // Dual-role account system
  hasDualRole: boolean("hasDualRole").default(false).notNull(),
  activeMode: mysqlEnum("activeMode", ["client", "nail_tech"]).default("client").notNull(),
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
