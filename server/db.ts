import { and, desc, eq, gt, lt, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  availability,
  bookings,
  collections,
  conversations,
  follows,
  InsertBooking,
  InsertMessage,
  InsertPost,
  InsertReview,
  InsertUser,
  lastMinuteSlots,
  likes,
  messages,
  notifications,
  postAnalytics,
  posts,
  reviews,
  savedPosts,
  scheduleBlocks,
  subscriptions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function updateUserProfile(
  userId: number,
  data: Partial<InsertUser>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ─── Posts ────────────────────────────────────────────────────────────────────
export async function createPost(data: InsertPost) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(posts).values(data);
  const postId = (result as any).insertId as number;
  // create analytics row
  await db.insert(postAnalytics).values({ postId });
  return postId;
}

export async function getPostById(postId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  return result[0];
}

export async function getDiscoverFeed(
  limit = 20,
  offset = 0,
  filters?: { style?: string; shape?: string; color?: string }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(posts.status, "published")];
  if (filters?.style) conditions.push(eq(posts.style, filters.style));
  if (filters?.shape) conditions.push(eq(posts.shape, filters.shape));
  if (filters?.color) conditions.push(eq(posts.color, filters.color));

  return db
    .select({
      post: posts,
      tech: {
        id: users.id,
        name: users.name,
        businessName: users.businessName,
        avatarUrl: users.avatarUrl,
        location: users.location,
      },
      analytics: postAnalytics,
    })
    .from(posts)
    .leftJoin(users, eq(posts.techId, users.id))
    .leftJoin(postAnalytics, eq(posts.id, postAnalytics.postId))
    .where(and(...conditions))
    .orderBy(desc(posts.isPromoted), desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getTechPosts(techId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ post: posts, analytics: postAnalytics })
    .from(posts)
    .leftJoin(postAnalytics, eq(posts.id, postAnalytics.postId))
    .where(eq(posts.techId, techId))
    .orderBy(desc(posts.createdAt));
}

export async function updatePost(postId: number, techId: number, data: Partial<InsertPost>) {
  const db = await getDb();
  if (!db) return;
  await db.update(posts).set(data).where(and(eq(posts.id, postId), eq(posts.techId, techId)));
}

export async function deletePost(postId: number, techId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(posts).set({ status: "hidden" }).where(and(eq(posts.id, postId), eq(posts.techId, techId)));
}

export async function incrementPostViews(postId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(postAnalytics)
    .set({ views: sql`${postAnalytics.views} + 1` })
    .where(eq(postAnalytics.postId, postId));
}

// ─── Likes ────────────────────────────────────────────────────────────────────
export async function toggleLike(userId: number, postId: number) {
  const db = await getDb();
  if (!db) return { liked: false };
  const existing = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.postId, postId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(likes).where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
    await db
      .update(postAnalytics)
      .set({ likes: sql`GREATEST(${postAnalytics.likes} - 1, 0)` })
      .where(eq(postAnalytics.postId, postId));
    return { liked: false };
  } else {
    await db.insert(likes).values({ userId, postId });
    await db
      .update(postAnalytics)
      .set({ likes: sql`${postAnalytics.likes} + 1` })
      .where(eq(postAnalytics.postId, postId));
    return { liked: true };
  }
}

export async function getUserLikes(userId: number, postIds: number[]) {
  const db = await getDb();
  if (!db || postIds.length === 0) return [];
  return db
    .select({ postId: likes.postId })
    .from(likes)
    .where(and(eq(likes.userId, userId), sql`${likes.postId} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`));
}

// ─── Saves / Collections ──────────────────────────────────────────────────────
export async function toggleSave(userId: number, postId: number, collectionId?: number) {
  const db = await getDb();
  if (!db) return { saved: false };
  const existing = await db
    .select()
    .from(savedPosts)
    .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(savedPosts).where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)));
    await db
      .update(postAnalytics)
      .set({ saves: sql`GREATEST(${postAnalytics.saves} - 1, 0)` })
      .where(eq(postAnalytics.postId, postId));
    return { saved: false };
  } else {
    await db.insert(savedPosts).values({ userId, postId, collectionId: collectionId ?? null });
    await db
      .update(postAnalytics)
      .set({ saves: sql`${postAnalytics.saves} + 1` })
      .where(eq(postAnalytics.postId, postId));
    return { saved: true };
  }
}

export async function getUserSavedPosts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ savedPost: savedPosts, post: posts, tech: users })
    .from(savedPosts)
    .leftJoin(posts, eq(savedPosts.postId, posts.id))
    .leftJoin(users, eq(posts.techId, users.id))
    .where(eq(savedPosts.userId, userId))
    .orderBy(desc(savedPosts.createdAt));
}

export async function getUserCollections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(collections).where(eq(collections.userId, userId)).orderBy(desc(collections.createdAt));
}

export async function createCollection(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(collections).values({ userId, name });
  return (result as any).insertId as number;
}

export async function updateCollection(id: number, userId: number, data: { name?: string; coverImageUrl?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(collections).set(data).where(and(eq(collections.id, id), eq(collections.userId, userId)));
}

export async function deleteCollection(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(collections).where(and(eq(collections.id, id), eq(collections.userId, userId)));
}

// ─── Bookings ─────────────────────────────────────────────────────────────────
export async function createBooking(data: InsertBooking) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(bookings).values(data);
  return (result as any).insertId as number;
}

export async function getClientBookings(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ booking: bookings, tech: users })
    .from(bookings)
    .leftJoin(users, eq(bookings.techId, users.id))
    .where(eq(bookings.clientId, clientId))
    .orderBy(desc(bookings.scheduledAt));
}

export async function getTechBookings(techId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ booking: bookings, client: users })
    .from(bookings)
    .leftJoin(users, eq(bookings.clientId, users.id))
    .where(eq(bookings.techId, techId))
    .orderBy(desc(bookings.scheduledAt));
}

export async function getTodayBookings(techId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return db
    .select({ booking: bookings, client: users })
    .from(bookings)
    .leftJoin(users, eq(bookings.clientId, users.id))
    .where(
      and(
        eq(bookings.techId, techId),
        gt(bookings.scheduledAt, startOfDay),
        lt(bookings.scheduledAt, endOfDay)
      )
    )
    .orderBy(bookings.scheduledAt);
}

export async function getWeeklySchedule(techId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(availability).where(eq(availability.techId, techId)).orderBy(availability.dayOfWeek);
}

export async function setWeeklySchedule(
  techId: number,
  schedule: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
    breakStart?: string | null;
    breakEnd?: string | null;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db.delete(availability).where(eq(availability.techId, techId));
  if (schedule.length > 0) {
    await db.insert(availability).values(
      schedule.map(s => ({
        techId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: s.isActive,
        breakStart: s.breakStart ?? null,
        breakEnd: s.breakEnd ?? null,
      }))
    );
  }
}

export async function getScheduleBlocks(techId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(scheduleBlocks)
    .where(eq(scheduleBlocks.techId, techId))
    .orderBy(scheduleBlocks.blockDate);
}

export async function createScheduleBlock(
  techId: number,
  block: { blockDate: Date; startTime: string; endTime: string; reason?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(scheduleBlocks).values({
    techId,
    blockDate: block.blockDate,
    startTime: block.startTime,
    endTime: block.endTime,
    reason: block.reason ?? null,
  });
}

export async function deleteScheduleBlock(blockId: number, techId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(scheduleBlocks)
    .where(and(eq(scheduleBlocks.id, blockId), eq(scheduleBlocks.techId, techId)));
}

export async function updateBookingStatus(
  bookingId: number,
  status: "confirmed" | "declined" | "cancelled" | "completed",
  userId: number
) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ status }).where(eq(bookings.id, bookingId));
  // increment analytics if booking is confirmed
  if (status === "confirmed") {
    const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (booking[0]?.postId) {
      await db
        .update(postAnalytics)
        .set({ bookingsFromPost: sql`${postAnalytics.bookingsFromPost} + 1` })
        .where(eq(postAnalytics.postId, booking[0].postId));
    }
  }
}

// ─── Availability ─────────────────────────────────────────────────────────────
export async function getTechAvailability(techId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(availability).where(eq(availability.techId, techId));
}

export async function setTechAvailability(
  techId: number,
  slots: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>
) {
  const db = await getDb();
  if (!db) return;
  await db.delete(availability).where(eq(availability.techId, techId));
  if (slots.length > 0) {
    await db.insert(availability).values(slots.map(s => ({ ...s, techId })));
  }
}

// ─── Last-Minute Slots ────────────────────────────────────────────────────────
export async function createLastMinuteSlot(techId: number, slotDate: Date, duration: number, note?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(lastMinuteSlots).values({ techId, slotDate, duration, note: note ?? null });
  return (result as any).insertId as number;
}

export async function getTechLastMinuteSlots(techId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(lastMinuteSlots)
    .where(and(eq(lastMinuteSlots.techId, techId), gt(lastMinuteSlots.slotDate, new Date())))
    .orderBy(lastMinuteSlots.slotDate);
}

export async function getOpenLastMinuteSlots() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ slot: lastMinuteSlots, tech: users })
    .from(lastMinuteSlots)
    .leftJoin(users, eq(lastMinuteSlots.techId, users.id))
    .where(and(eq(lastMinuteSlots.isBooked, false), gt(lastMinuteSlots.slotDate, new Date())))
    .orderBy(lastMinuteSlots.slotDate)
    .limit(20);
}

export async function deleteLastMinuteSlot(id: number, techId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(lastMinuteSlots).where(and(eq(lastMinuteSlots.id, id), eq(lastMinuteSlots.techId, techId)));
}

// ─── Conversations & Messages ─────────────────────────────────────────────────
export async function getOrCreateConversation(clientId: number, techId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.clientId, clientId), eq(conversations.techId, techId)))
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [result] = await db.insert(conversations).values({ clientId, techId });
  const id = (result as any).insertId as number;
  const created = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return created[0];
}

export async function getUserConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ conversation: conversations, client: users, tech: users })
    .from(conversations)
    .leftJoin(users, or(eq(conversations.clientId, users.id), eq(conversations.techId, users.id)))
    .where(or(eq(conversations.clientId, userId), eq(conversations.techId, userId)))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getConversationMessages(conversationId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

export async function sendMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(messages).values(data);
  const id = (result as any).insertId as number;
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, data.conversationId));
  return id;
}

export async function markMessagesRead(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(messages)
    .set({ isRead: true })
    .where(and(eq(messages.conversationId, conversationId), ne(messages.senderId, userId)));
}

// ─── Reviews ──────────────────────────────────────────────────────────────────
export async function createReview(data: InsertReview) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(reviews).values(data);
  return (result as any).insertId as number;
}

export async function getTechReviews(techId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ review: reviews, client: users })
    .from(reviews)
    .leftJoin(users, eq(reviews.clientId, users.id))
    .where(eq(reviews.techId, techId))
    .orderBy(desc(reviews.createdAt));
}

export async function getTechRatingStats(techId: number) {
  const db = await getDb();
  if (!db) return { average: 0, count: 0 };
  const result = await db
    .select({
      average: sql<number>`AVG(${reviews.rating})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(reviews)
    .where(eq(reviews.techId, techId));
  return { average: Number(result[0]?.average ?? 0), count: Number(result[0]?.count ?? 0) };
}

// ─── Subscriptions ────────────────────────────────────────────────────────────
export async function getOrCreateSubscription(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [result] = await db.insert(subscriptions).values({ userId, trialEndsAt });
  const id = (result as any).insertId as number;
  const created = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return created[0];
}

export async function updateSubscription(userId: number, data: Partial<typeof subscriptions.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions).set(data).where(eq(subscriptions.userId, userId));
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function getTechAnalytics(techId: number) {
  const db = await getDb();
  if (!db) return null;
  const techPosts = await db.select({ id: posts.id }).from(posts).where(eq(posts.techId, techId));
  const postIds = techPosts.map(p => p.id);
  if (postIds.length === 0) return { totalViews: 0, totalLikes: 0, totalSaves: 0, totalBookings: 0, bookingRate: 0 };

  const analytics = await db
    .select({
      totalViews: sql<number>`SUM(${postAnalytics.views})`,
      totalLikes: sql<number>`SUM(${postAnalytics.likes})`,
      totalSaves: sql<number>`SUM(${postAnalytics.saves})`,
      totalBookings: sql<number>`SUM(${postAnalytics.bookingsFromPost})`,
    })
    .from(postAnalytics)
    .where(sql`${postAnalytics.postId} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`);

  const totalViews = Number(analytics[0]?.totalViews ?? 0);
  const totalBookings = Number(analytics[0]?.totalBookings ?? 0);
  return {
    totalViews,
    totalLikes: Number(analytics[0]?.totalLikes ?? 0),
    totalSaves: Number(analytics[0]?.totalSaves ?? 0),
    totalBookings,
    bookingRate: totalViews > 0 ? Math.round((totalBookings / totalViews) * 100 * 10) / 10 : 0,
  };
}

// ─── Follows ──────────────────────────────────────────────────────────────────
export async function toggleFollow(followerId: number, followingId: number) {
  const db = await getDb();
  if (!db) return { following: false };
  const existing = await db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1);
  if (existing.length > 0) {
    await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
    return { following: false };
  } else {
    await db.insert(follows).values({ followerId, followingId });
    return { following: true };
  }
}

export async function getFollowerCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(follows)
    .where(eq(follows.followingId, userId));
  return Number(result[0]?.count ?? 0);
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function createNotification(userId: number, type: string, title: string, body?: string, relatedId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({ userId, type, title, body: body ?? null, relatedId: relatedId ?? null });
}

export async function getUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(30);
}

export async function markNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}
