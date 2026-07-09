import { and, desc, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  availability,
  bookingRules,
  bookings,
  collections,
  conversations,
  follows,
  InsertBooking,
  InsertBookingRule,
  InsertMessage,
  InsertPost,
  InsertReview,
  InsertUser,
  lastMinuteSlots,
  likes,
  messages,
  notifications,
  postAnalytics,
  postReports,
  posts,
  reviews,
  savedPosts,
  scheduleBlocks,
  subscriptions,
  cancellationPolicies,
  techFollows,
  techServices,
  notificationPreferences,
  privacySettings,
  blockedUsers,
  TechService,
  NotificationPreference,
  PrivacySettings,
  BlockedUser,
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
  filters?: {
    style?: string;   // legacy compat
    styles?: string[]; // multi-select
    shape?: string;
    color?: string;   // legacy single color
    colors?: string[]; // multi-select colors
    multiColor?: boolean; // filter for multi-color posts only
    distanceMiles?: number; // defaults to 10mi if userLat/userLng provided
    userLat?: number;
    userLng?: number;
    soonestAvailable?: boolean;
    subscriptionsOnly?: boolean; // only show posts from techs the client follows
  },
  clientId?: number // used for subscription boost + filter
) {
  const db = await getDb();
  if (!db) return [];

  // Fetch followed tech IDs for this client (used for boost + subscriptionsOnly filter)
  let followedTechIds: Set<number> = new Set();
  if (clientId) {
    const ids = await getFollowedTechIds(clientId);
    followedTechIds = new Set(ids);
  }

  const conditions = [eq(posts.status, "published")];
  // Style filter: multi-select OR single style (legacy)
  const activeStyles = filters?.styles && filters.styles.length > 0
    ? filters.styles
    : filters?.style ? [filters.style] : [];
  // Active color filters (multi-select)
  const activeColors = filters?.colors && filters.colors.length > 0
    ? filters.colors
    : filters?.color ? [filters.color] : [];
  // We do NOT push DB WHERE for styles/colors — handled in JS scoring below
  // (stored as JSON arrays, SQL equality won't work for multi-value fields)
  if (filters?.shape) conditions.push(eq(posts.shape, filters.shape));

  // Fetch base results with tech lat/lng included
  const rows = await db
    .select({
      post: posts,
      tech: {
        id: users.id,
        name: users.name,
        businessName: users.businessName,
        avatarUrl: users.avatarUrl,
        location: users.location,
        lat: users.lat,
        lng: users.lng,
      },
      analytics: postAnalytics,
    })
    .from(posts)
    .leftJoin(users, eq(posts.techId, users.id))
    .leftJoin(postAnalytics, eq(posts.id, postAnalytics.postId))
    .where(and(...conditions))
    .orderBy(desc(posts.isPromoted), desc(posts.createdAt))
    .limit(500); // over-fetch so we can filter/sort in JS

  // ── Haversine distance helper ─────────────────────────────────────────────
  const R = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const getDistMiles = (techLat: number, techLng: number, uLat: number, uLng: number) => {
    const dLat = toRad(techLat - uLat);
    const dLng = toRad(techLng - uLng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(uLat)) * Math.cos(toRad(techLat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Location is always active — default 10mi when lat/lng provided
  const hasLocation = filters?.userLat !== undefined && filters?.userLng !== undefined;
  const maxMiles = filters?.distanceMiles ?? 10;
  const uLat = filters?.userLat;
  const uLng = filters?.userLng;

  // ── Subscriptions-only filter ─────────────────────────────────────────
  let results = rows;
  if (filters?.subscriptionsOnly && followedTechIds.size > 0) {
    results = results.filter((r) => r.tech?.id != null && followedTechIds.has(r.tech.id));
  } else if (filters?.subscriptionsOnly) {
    return [];
  }

  // ── Soonest available sort ───────────────────────────────────────────────
  if (filters?.soonestAvailable) {
    // Fetch upcoming availability for all techs in the result set
    const techIds = Array.from(new Set(results.map((r) => r.tech?.id).filter((id): id is number => id != null)));
    const now = new Date();
    // Get availability rows for these techs
    const availRows = techIds.length
      ? await db
          .select({ techId: availability.techId, dayOfWeek: availability.dayOfWeek, startTime: availability.startTime })
          .from(availability)
          .where(and(sql`${availability.techId} IN (${sql.join(techIds.map((id) => sql`${id}`), sql`, `)})`, eq(availability.isActive, true)))
      : [];
    // Also check last-minute slots
    const slotRows = techIds.length
      ? await db
          .select({ techId: lastMinuteSlots.techId, slotDate: lastMinuteSlots.slotDate })
          .from(lastMinuteSlots)
          .where(and(sql`${lastMinuteSlots.techId} IN (${sql.join(techIds.map((id) => sql`${id}`), sql`, `)})`, gt(lastMinuteSlots.expiresAt, now.getTime())))
      : [];
    // Build a "has upcoming availability" set
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const todayIdx = now.getDay();
    const techHasSlot = new Set<number>();
    for (const row of availRows) {
      // dayOfWeek is stored as int (0=Sun…6=Sat)
      if ((row.dayOfWeek as number) >= todayIdx) techHasSlot.add(row.techId);
    }
    for (const row of slotRows) techHasSlot.add(row.techId);
    // Sort: techs with upcoming slots first
    results = [
      ...results.filter((r) => r.tech?.id && techHasSlot.has(r.tech.id)),
      ...results.filter((r) => !r.tech?.id || !techHasSlot.has(r.tech.id)),
    ];
  }

  // ── Scoring: exact-match vs partial-match split ─────────────────────────────────
  const now2 = Date.now();
  const ONE_DAY_MS = 86_400_000;

  // Total active filter dimensions (for exact-match determination)
  const totalFilterDimensions =
    (activeStyles.length > 0 ? 1 : 0) +
    (filters?.shape ? 1 : 0) +
    (activeColors.length > 0 || filters?.multiColor ? 1 : 0) +
    (hasLocation ? 1 : 0);

  const scored = results.map((r) => {
    let matchedDimensions = 0;

    // Style match
    let styleMatchCount = 0;
    if (activeStyles.length > 0 && r.post.style) {
      let postTags: string[] = [];
      try {
        const parsed = JSON.parse(r.post.style);
        postTags = Array.isArray(parsed) ? parsed : [r.post.style];
      } catch { postTags = [r.post.style]; }
      styleMatchCount = activeStyles.filter(t => postTags.includes(t)).length;
      if (styleMatchCount > 0) matchedDimensions++;
    } else if (activeStyles.length === 0) {
      matchedDimensions++;
    }

    // Shape match
    if (filters?.shape) {
      if (r.post.shape === filters.shape) matchedDimensions++;
    } else {
      matchedDimensions++;
    }

    // Color match (multi-select + multi-color auto-tag)
    let colorMatchCount = 0;
    const postColors: string[] = (() => {
      if (!r.post.colors) return r.post.color ? [r.post.color] : [];
      try {
        const parsed = typeof r.post.colors === 'string' ? JSON.parse(r.post.colors as string) : r.post.colors;
        return Array.isArray(parsed) ? parsed : (r.post.color ? [r.post.color] : []);
      } catch { return r.post.color ? [r.post.color] : []; }
    })();
    const isMultiColor = postColors.length >= 2;
    if (filters?.multiColor) {
      if (isMultiColor) { colorMatchCount = 1; matchedDimensions++; }
    } else if (activeColors.length > 0) {
      colorMatchCount = activeColors.filter(c => postColors.includes(c)).length;
      if (colorMatchCount > 0) matchedDimensions++;
    } else {
      matchedDimensions++;
    }

    // Location match
    let withinLocation = true;
    let distMiles = 0;
    if (hasLocation && uLat !== undefined && uLng !== undefined) {
      if (r.tech?.lat != null && r.tech?.lng != null) {
        distMiles = getDistMiles(r.tech.lat, r.tech.lng, uLat, uLng);
        withinLocation = distMiles <= maxMiles;
      } else {
        withinLocation = false;
      }
      if (withinLocation) matchedDimensions++;
    } else {
      matchedDimensions++;
    }

    // Base quality scores
    const saves = r.analytics?.saves ?? 0;
    const savesScore = saves > 0 ? Math.log2(saves + 1) * 2 : 0;
    const ageMs = now2 - (r.post.createdAt?.getTime() ?? 0);
    const ageDays = ageMs / ONE_DAY_MS;
    const recencyScore = Math.max(0, 7 - ageDays);
    const promotedBonus = r.post.isPromoted ? 100 : 0;
    const subscriptionBonus = (r.tech?.id != null && followedTechIds.has(r.tech.id)) ? 50 : 0;
    const styleScore = styleMatchCount * 10;
    const colorScore = colorMatchCount * 8;
    const proximityScore = (hasLocation && withinLocation && maxMiles > 0)
      ? Math.max(0, 5 - (distMiles / maxMiles) * 5)
      : 0;

    const baseScore = promotedBonus + subscriptionBonus + styleScore + colorScore + savesScore + recencyScore + proximityScore;
    const isExactMatch = totalFilterDimensions === 0 || matchedDimensions >= totalFilterDimensions;

    return { ...r, _score: baseScore, _matchedDimensions: matchedDimensions, _isExactMatch: isExactMatch, _isMultiColor: isMultiColor, _postColors: postColors };
  });

  // Split into exact matches and partial matches
  const exactMatches = scored.filter(r => r._isExactMatch).sort((a, b) => b._score - a._score);
  const partialMatches = scored
    .filter(r => !r._isExactMatch)
    .sort((a, b) => b._matchedDimensions - a._matchedDimensions || b._score - a._score);

  // Combine with divider marker for frontend
  const combined: any[] = [
    ...exactMatches,
    ...(partialMatches.length > 0 ? [{ _divider: true }] : []),
    ...partialMatches,
  ];

  return combined.slice(offset, offset + limit).map((r) => {
    if (r._divider) return { _divider: true } as any;
    const { _score: _s, _matchedDimensions: _m, _isExactMatch: _e, _isMultiColor, _postColors, ...rest } = r;
    return { ...rest, isMultiColor: _isMultiColor as boolean, postColors: _postColors as string[] };
  });
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

/** Soft-hide: sets status to 'hidden', post is recoverable. */
export async function deletePost(postId: number, techId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(posts).set({ status: "hidden" }).where(and(eq(posts.id, postId), eq(posts.techId, techId)));
}

/** Hard delete: permanently removes the post row. Cannot be undone. */
export async function hardDeletePost(postId: number, techId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.techId, techId)));
}

/** Restore a hidden post back to published. */
export async function restorePost(postId: number, techId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(posts).set({ status: "published" }).where(and(eq(posts.id, postId), eq(posts.techId, techId)));
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

export async function getBookingById(bookingId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  return rows[0] ?? null;
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
    bufferMinutes?: number | null;
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
        bufferMinutes: s.bufferMinutes ?? 0,
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
export async function createLastMinuteSlot(
  techId: number,
  slotDate: string,   // YYYY-MM-DD
  startTime: string,  // HH:MM 24h
  endTime: string,    // HH:MM 24h
  note: string | undefined,
  isPushed: boolean,
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // expiresAt = end of the slot window on the given date (unix ms)
  const expDate = new Date(`${slotDate}T${endTime}:00`);
  const expiresAt = expDate.getTime();
  const [result] = await db.insert(lastMinuteSlots).values({
    techId,
    slotDate,
    startTime,
    endTime,
    note: note ?? null,
    isPushed,
    expiresAt,
  });
  return (result as any).insertId as number;
}

export async function getTechLastMinuteSlots(techId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  return db
    .select()
    .from(lastMinuteSlots)
    .where(and(eq(lastMinuteSlots.techId, techId), gt(lastMinuteSlots.expiresAt, now)))
    .orderBy(lastMinuteSlots.slotDate, lastMinuteSlots.startTime);
}

export async function getOpenLastMinuteSlots() {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  return db
    .select({ slot: lastMinuteSlots, tech: users })
    .from(lastMinuteSlots)
    .leftJoin(users, eq(lastMinuteSlots.techId, users.id))
    .where(gt(lastMinuteSlots.expiresAt, now))
    .orderBy(lastMinuteSlots.slotDate, lastMinuteSlots.startTime)
    .limit(40);
}

export async function getActiveSlotsForTech(techId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  return db
    .select()
    .from(lastMinuteSlots)
    .where(and(eq(lastMinuteSlots.techId, techId), gt(lastMinuteSlots.expiresAt, now)))
    .orderBy(lastMinuteSlots.slotDate, lastMinuteSlots.startTime);
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

// ─── Available Slots Computation ──────────────────────────────────────────────
/**
 * Compute all time slots for a given tech on a given date, taking into account:
 *  - Working hours (availability table)
 *  - Break times
 *  - Buffer minutes between appointments
 *  - Existing confirmed/pending bookings
 *  - Blocked-off schedule blocks
 *  - Selected appointment duration
 *
 * Returns an array of { time: "HH:MM", available: boolean }
 */
export async function getAvailableSlots(
  techId: number,
  dateStr: string,   // "YYYY-MM-DD" in local time
  durationMinutes: number,
  clientId?: number  // optional — used to check returning-client status
): Promise<Array<{ time: string; available: boolean; reason: string | undefined }>> {
  const db = await getDb();
  if (!db) return [];

  // Parse the requested date
  const [year, month, day] = dateStr.split("-").map(Number);
  const requestedDate = new Date(year, month - 1, day);
  const dayOfWeek = requestedDate.getDay(); // 0=Sun…6=Sat

  // 1. Get the tech's availability rule for this day
  const avRows = await db
    .select()
    .from(availability)
    .where(and(eq(availability.techId, techId), eq(availability.dayOfWeek, dayOfWeek), eq(availability.isActive, true)))
    .limit(1);

  if (avRows.length === 0) return []; // tech doesn't work this day

  const av = avRows[0];
  const bufferMins = av.bufferMinutes ?? 0;

  // Helper: "HH:MM" → minutes since midnight
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const toTime = (mins: number) => {
    const h = Math.floor(mins / 60).toString().padStart(2, "0");
    const m = (mins % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  const workStart = toMins(av.startTime);
  const workEnd = toMins(av.endTime);
  const breakStart = av.breakStart ? toMins(av.breakStart) : null;
  const breakEnd = av.breakEnd ? toMins(av.breakEnd) : null;

  // 2. Build "blocked intervals" from existing bookings on this date
  const dayStart = new Date(year, month - 1, day, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day, 23, 59, 59);

  const existingBookings = await db
    .select({ scheduledAt: bookings.scheduledAt, duration: bookings.duration, status: bookings.status })
    .from(bookings)
    .where(
      and(
        eq(bookings.techId, techId),
        gt(bookings.scheduledAt, dayStart),
        lt(bookings.scheduledAt, dayEnd),
        sql`${bookings.status} IN ('pending', 'confirmed')`
      )
    );

  // 3. Build blocked intervals from schedule_blocks on this date
  const blocks = await db
    .select({ startTime: scheduleBlocks.startTime, endTime: scheduleBlocks.endTime })
    .from(scheduleBlocks)
    .where(
      and(
        eq(scheduleBlocks.techId, techId),
        gt(scheduleBlocks.blockDate, dayStart),
        lt(scheduleBlocks.blockDate, dayEnd)
      )
    );

  // Combine all blocked intervals (in minutes since midnight)
  type Interval = { start: number; end: number; reason: string };
  const blocked: Interval[] = [];

  for (const b of existingBookings) {
    const startMins = b.scheduledAt.getHours() * 60 + b.scheduledAt.getMinutes();
    const endMins = startMins + (b.duration ?? 60) + bufferMins;
    blocked.push({ start: startMins, end: endMins, reason: "booked" });
  }

  for (const bl of blocks) {
    blocked.push({ start: toMins(bl.startTime), end: toMins(bl.endTime), reason: "blocked" });
  }

  // Add break as a blocked interval
  if (breakStart !== null && breakEnd !== null) {
    blocked.push({ start: breakStart, end: breakEnd, reason: "break" });
  }

  // 4. Generate candidate slots every 15 minutes within working hours.
  //    We show ALL slots in the window (available + unavailable) so the client
  //    can see the full schedule. Slots that don't fit the duration, overlap a
  //    blocked interval, or are in the past are marked available=false.
  const slots: Array<{ time: string; available: boolean; reason: string | undefined }> = [];
  const slotInterval = 15; // 15-minute grid

  const now = new Date();
  const isToday =
    now.getFullYear() === year &&
    now.getMonth() === month - 1 &&
    now.getDate() === day;
  const nowMins = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

  // Iterate every 15 mins across the FULL working window so unavailable slots
  // are still visible (grayed out) in the UI.
  for (let t = workStart; t < workEnd; t += slotInterval) {
    const slotEnd = t + durationMinutes;

    // Slot doesn't fit before end of shift
    const doesntFit = slotEnd > workEnd;

    // Slot overlaps a blocked interval (booking, schedule block, or break)
    const isBlocked = blocked.some(
      (iv) => t < iv.end && slotEnd > iv.start
    );

    // Slot is in the past (today only)
    const isPast = isToday && t <= nowMins;

    let reason: string | undefined;
    if (isPast) reason = "past";
    else if (doesntFit) reason = "outside_hours";
    else if (isBlocked) {
      const blocker = blocked.find(iv => t < iv.end && (t + durationMinutes) > iv.start);
      reason = blocker?.reason ?? "booked";
    }

    // Client-tier check: if the slot is otherwise available, verify the client
    // meets the tier requirement for this specific time window.
    let tierReason: string | undefined;
    if (!doesntFit && !isBlocked && !isPast && clientId !== undefined) {
      const tier = await getClientTierForSlot(techId, dateStr, toTime(t));
      if (tier === "returning_only") {
        const isReturning = await isReturningClient(clientId, techId);
        if (!isReturning) {
          tierReason = "returning_only";
        }
      }
    }

    const finalReason = reason ?? tierReason;
    slots.push({
      time: toTime(t),
      available: !doesntFit && !isBlocked && !isPast && !tierReason,
      reason: finalReason,
    });
  }

  return slots;
}

/**
 * Returns a set of date strings ("YYYY-MM-DD") in the given month that have
 * at least one bookable slot for the given duration.
 * Used by the calendar to distinguish "working but fully booked" days from
 * "working with open slots" days.
 */
export async function getMonthBookableStatus(
  techId: number,
  year: number,
  month: number, // 1-indexed
  durationMinutes: number
): Promise<Record<string, boolean>> {
  const db = await getDb();
  if (!db) return {};

  // Get all active availability rules for this tech
  const avRows = await db
    .select()
    .from(availability)
    .where(and(eq(availability.techId, techId), eq(availability.isActive, true)));

  if (avRows.length === 0) return {};

  const workingDowSet = new Set(avRows.map(a => a.dayOfWeek));

  // Build date range for the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Collect working dates in this month
  const workingDates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dateStr < todayStr) continue;
    if (workingDowSet.has(date.getDay())) workingDates.push(dateStr);
  }

  if (workingDates.length === 0) return {};

  // Fetch all bookings in this month for this tech
  const monthStart = new Date(year, month - 1, 1, 0, 0, 0);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59);
  const existingBookings = await db
    .select({ scheduledAt: bookings.scheduledAt, duration: bookings.duration })
    .from(bookings)
    .where(
      and(
        eq(bookings.techId, techId),
        gt(bookings.scheduledAt, monthStart),
        lt(bookings.scheduledAt, monthEnd),
        sql`${bookings.status} IN ('pending', 'confirmed')`
      )
    );

  // Fetch schedule blocks in this month
  const blocks = await db
    .select({ blockDate: scheduleBlocks.blockDate, startTime: scheduleBlocks.startTime, endTime: scheduleBlocks.endTime })
    .from(scheduleBlocks)
    .where(
      and(
        eq(scheduleBlocks.techId, techId),
        gt(scheduleBlocks.blockDate, monthStart),
        lt(scheduleBlocks.blockDate, monthEnd)
      )
    );

  const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  const result: Record<string, boolean> = {};

  for (const dateStr of workingDates) {
    const [y, mo, day] = dateStr.split("-").map(Number);
    const dow = new Date(y, mo - 1, day).getDay();
    const av = avRows.find(a => a.dayOfWeek === dow);
    if (!av) { result[dateStr] = false; continue; }

    const bufferMins = av.bufferMinutes ?? 0;
    const workStart = toMins(av.startTime);
    const workEnd = toMins(av.endTime);
    const breakStart = av.breakStart ? toMins(av.breakStart) : null;
    const breakEnd = av.breakEnd ? toMins(av.breakEnd) : null;

    type Interval = { start: number; end: number };
    const blocked: Interval[] = [];

    for (const b of existingBookings) {
      const bDate = b.scheduledAt;
      if (bDate.getFullYear() === y && bDate.getMonth() === mo - 1 && bDate.getDate() === day) {
        const s = bDate.getHours() * 60 + bDate.getMinutes();
        blocked.push({ start: s, end: s + (b.duration ?? 60) + bufferMins });
      }
    }

    for (const bl of blocks) {
      const bDate = bl.blockDate;
      if (bDate.getFullYear() === y && bDate.getMonth() === mo - 1 && bDate.getDate() === day) {
        blocked.push({ start: toMins(bl.startTime), end: toMins(bl.endTime) });
      }
    }

    if (breakStart !== null && breakEnd !== null) {
      blocked.push({ start: breakStart, end: breakEnd });
    }

    const now = new Date();
    const isToday = now.getFullYear() === y && now.getMonth() === mo - 1 && now.getDate() === day;
    const nowMins = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

    let hasOpen = false;
    for (let t = workStart; t < workEnd; t += 15) {
      const slotEnd = t + durationMinutes;
      if (slotEnd > workEnd) continue;
      if (isToday && t <= nowMins) continue;
      if (blocked.some(iv => t < iv.end && slotEnd > iv.start)) continue;
      hasOpen = true;
      break;
    }

    result[dateStr] = hasOpen;
  }

  return result;
}

/**
 * Create a booking only if the slot is still free (prevents double-booking).
 * Throws if the slot is already taken.
 */
export async function createBookingWithConflictCheck(data: InsertBooking): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const scheduledAt = data.scheduledAt;
  const durationMins = data.duration ?? 60;
  const techId = data.techId;

  // Check for overlapping bookings
  const slotStart = scheduledAt;
  const slotEnd = new Date(scheduledAt.getTime() + durationMins * 60 * 1000);

  // Get buffer for this tech on this day
  const dayOfWeek = scheduledAt.getDay();
  const avRows = await db
    .select({ bufferMinutes: availability.bufferMinutes })
    .from(availability)
    .where(and(eq(availability.techId, techId), eq(availability.dayOfWeek, dayOfWeek)))
    .limit(1);
  const bufferMins = avRows[0]?.bufferMinutes ?? 0;

  // Window to check: from (slotStart - maxBuffer) to slotEnd
  const checkFrom = new Date(slotStart.getTime() - bufferMins * 60 * 1000 - 1);
  const checkTo = new Date(slotEnd.getTime() + bufferMins * 60 * 1000 + 1);

  const conflicts = await db
    .select({ id: bookings.id, scheduledAt: bookings.scheduledAt, duration: bookings.duration })
    .from(bookings)
    .where(
      and(
        eq(bookings.techId, techId),
        gt(bookings.scheduledAt, checkFrom),
        lt(bookings.scheduledAt, checkTo),
        sql`${bookings.status} IN ('pending', 'confirmed')`
      )
    );

  // Check actual overlap
  for (const c of conflicts) {
    const cStart = c.scheduledAt.getTime();
    const cEnd = cStart + (c.duration ?? 60) * 60 * 1000 + bufferMins * 60 * 1000;
    if (slotStart.getTime() < cEnd && slotEnd.getTime() > cStart) {
      throw new Error("This time slot is no longer available. Please choose another.");
    }
  }

  const [result] = await db.insert(bookings).values(data);
  return (result as any).insertId as number;
}

// ─── Booking Rules (client-tier restrictions) ─────────────────────────────────

/**
 * Returns true if the client has at least one completed booking with this tech.
 * Used to determine whether a "returning_only" slot is accessible.
 */
export async function isReturningClient(clientId: number, techId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.clientId, clientId),
        eq(bookings.techId, techId),
        sql`${bookings.status} = 'completed'`
      )
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Fetch all booking rules for a tech, ordered by createdAt desc (newest first).
 */
export async function getBookingRulesForTech(techId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookingRules)
    .where(eq(bookingRules.techId, techId))
    .orderBy(desc(bookingRules.createdAt));
}

/**
 * Resolve the effective clientTier for a given slot.
 *
 * Resolution order (most specific + most recent wins):
 *   1. One-off date rule whose window covers the slot time (most recently created wins)
 *   2. Recurring day-of-week rule whose window covers the slot time (most recently created wins)
 *   3. Whole-day clientTier from the availability row
 *   4. Default: "open"
 *
 * @param techId
 * @param dateStr  "YYYY-MM-DD"
 * @param slotTime "HH:MM" (start of the slot)
 */
export async function getClientTierForSlot(
  techId: number,
  dateStr: string,
  slotTime: string
): Promise<"open" | "returning_only"> {
  const db = await getDb();
  if (!db) return "open";

  const [year, month, day] = dateStr.split("-").map(Number);
  const dow = new Date(year, month - 1, day).getDay();
  const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const slotMins = toMins(slotTime);

  // Fetch all rules for this tech
  const rules = await db
    .select()
    .from(bookingRules)
    .where(eq(bookingRules.techId, techId))
    .orderBy(desc(bookingRules.createdAt));

  // Fetch the whole-day availability row for recency comparison
  const avRows = await db
    .select({ clientTier: availability.clientTier, clientTierUpdatedAt: availability.clientTierUpdatedAt })
    .from(availability)
    .where(and(eq(availability.techId, techId), eq(availability.dayOfWeek, dow), eq(availability.isActive, true)))
    .limit(1);
  const dayTier = avRows[0]?.clientTier ?? "open";
  const dayTierUpdatedAt = avRows[0]?.clientTierUpdatedAt ?? new Date(0);

  // Find the most recently created time-block rule that covers this slot
  // (rules are already ordered by createdAt desc, so the first match is the most recent)
  let matchingRule: typeof rules[0] | null = null;

  // 1. One-off date rules (specificDate matches dateStr)
  for (const rule of rules) {
    if (!rule.specificDate) continue;
    const rd = rule.specificDate;
    const rDateStr = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, "0")}-${String(rd.getDate()).padStart(2, "0")}`;
    if (rDateStr !== dateStr) continue;
    const rStart = toMins(rule.startTime);
    const rEnd   = toMins(rule.endTime);
    if (slotMins >= rStart && slotMins < rEnd) { matchingRule = rule; break; }
  }

  // 2. Recurring day-of-week rules (only if no one-off rule matched)
  if (!matchingRule) {
    for (const rule of rules) {
      if (rule.specificDate !== null) continue;
      if (rule.dayOfWeek !== dow) continue;
      const rStart = toMins(rule.startTime);
      const rEnd   = toMins(rule.endTime);
      if (slotMins >= rStart && slotMins < rEnd) { matchingRule = rule; break; }
    }
  }

  // 3. Recency-based conflict resolution:
  //    Use the rule's updatedAt (or createdAt if never edited) as the effective
  //    "last applied" timestamp. Compare against the day-level clientTierUpdatedAt.
  //    The most recently applied change wins.
  if (matchingRule) {
    const ruleTimestamp = matchingRule.updatedAt ?? matchingRule.createdAt ?? new Date(0);
    // Time-block rule wins if it was last modified AFTER the day-level tier was last set.
    if (ruleTimestamp >= dayTierUpdatedAt) return matchingRule.clientTier;
    // Day-level tier was set more recently — it overrides the time-block rule.
    return dayTier;
  }

  // 4. No time-block rule matched — use the whole-day tier
  return dayTier;
}

export async function createBookingRule(data: InsertBookingRule) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(bookingRules).values(data);
  return (result as any).insertId as number;
}

export async function deleteBookingRule(id: number, techId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(bookingRules).where(and(eq(bookingRules.id, id), eq(bookingRules.techId, techId)));
}

export async function updateBookingRule(
  id: number,
  techId: number,
  data: Partial<Pick<InsertBookingRule, "startTime" | "endTime" | "clientTier" | "dayOfWeek" | "specificDate">>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(bookingRules)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(bookingRules.id, id), eq(bookingRules.techId, techId)));
}

/**
 * Update the clientTier on an availability (whole-day) row.
 * Also stamps clientTierUpdatedAt so recency-based conflict resolution works.
 */
export async function setAvailabilityClientTier(
  techId: number,
  dayOfWeek: number,
  clientTier: "open" | "returning_only"
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(availability)
    .set({ clientTier, clientTierUpdatedAt: new Date() })
    .where(and(eq(availability.techId, techId), eq(availability.dayOfWeek, dayOfWeek)));
}

// ─── Tech Follows (client subscribes to tech page) ───────────────────────────

export async function followTech(clientId: number, techId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Upsert — ignore if already following (unique key handles it)
  try {
    await db.insert(techFollows).values({ clientId, techId });
  } catch (_) {
    // Duplicate entry — already following, no-op
  }
}

export async function unfollowTech(clientId: number, techId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .delete(techFollows)
    .where(and(eq(techFollows.clientId, clientId), eq(techFollows.techId, techId)));
}

export async function isTechFollowed(clientId: number, techId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: techFollows.id })
    .from(techFollows)
    .where(and(eq(techFollows.clientId, clientId), eq(techFollows.techId, techId)))
    .limit(1);
  return rows.length > 0;
}

export async function getTechFollowerCount(techId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(techFollows)
    .where(eq(techFollows.techId, techId));
  return Number(rows[0]?.count ?? 0);
}

/** Returns the list of techIds that a client follows */
export async function getFollowedTechIds(clientId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ techId: techFollows.techId })
    .from(techFollows)
    .where(eq(techFollows.clientId, clientId));
  return rows.map((r) => r.techId);
}

/** Returns all follower clientIds for a tech (used to fan-out notifications) */
export async function getTechFollowerIds(techId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ clientId: techFollows.clientId })
    .from(techFollows)
    .where(eq(techFollows.techId, techId));
  return rows.map((r) => r.clientId);
}

// ─── Notification helpers (extended) ─────────────────────────────────────────

export async function createNotification(data: {
  userId: number;
  type: string;
  title: string;
  body?: string;
  relatedId?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: data.body ?? null,
    relatedId: data.relatedId ?? null,
    isRead: false,
  });
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return Number(rows[0]?.count ?? 0);
}

export async function markSingleNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

/** Fan-out: create a new_post notification for every follower of a tech */
export async function notifyTechFollowers(techId: number, postId: number, techName: string) {
  const followerIds = await getTechFollowerIds(techId);
  if (followerIds.length === 0) return;
  const db = await getDb();
  if (!db) return;
  const rows = followerIds.map((clientId) => ({
    userId: clientId,
    type: "new_post",
    title: `${techName} posted something new`,
    body: "Tap to see the latest look.",
    relatedId: postId,
    isRead: false,
  }));
  // Insert in batches of 50 to avoid oversized queries
  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(notifications).values(rows.slice(i, i + 50));
  }
}

// ─── Post Reports ─────────────────────────────────────────────────────────────

export async function submitReport({
  postId,
  reporterId,
  reason,
  note,
}: {
  postId: number;
  reporterId: number;
  reason: "nudity" | "stolen_content" | "spam" | "harassment" | "violence" | "other";
  note?: string;
}): Promise<{ alreadyReported: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Duplicate guard
  const existing = await db
    .select({ id: postReports.id })
    .from(postReports)
    .where(
      and(
        eq(postReports.reporterId, reporterId),
        eq(postReports.postId, postId)
      )
    )
    .limit(1);

  if (existing.length > 0) return { alreadyReported: true };

  await db.insert(postReports).values({ postId, reporterId, reason, note: note ?? null });
  return { alreadyReported: false };
}

export async function hasUserReportedPost(reporterId: number, postId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: postReports.id })
    .from(postReports)
    .where(and(eq(postReports.reporterId, reporterId), eq(postReports.postId, postId)))
    .limit(1);
  return rows.length > 0;
}

export async function getReportsForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: postReports.id,
      postId: postReports.postId,
      reporterId: postReports.reporterId,
      reason: postReports.reason,
      note: postReports.note,
      status: postReports.status,
      createdAt: postReports.createdAt,
      reporterName: users.name,
      postCaption: posts.caption,
      postImageUrls: posts.imageUrls,
      postStatus: posts.status,
      techId: posts.techId,
    })
    .from(postReports)
    .leftJoin(users, eq(postReports.reporterId, users.id))
    .leftJoin(posts, eq(postReports.postId, posts.id))
    .orderBy(desc(postReports.createdAt));
}

export async function dismissReport(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(postReports)
    .set({ status: "dismissed" })
    .where(eq(postReports.id, reportId));
}

export async function hidePostByAdmin(postId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(posts)
    .set({ status: "hidden" })
    .where(eq(posts.id, postId));
  // Mark all pending reports for this post as dismissed
  await db
    .update(postReports)
    .set({ status: "dismissed" })
    .where(and(eq(postReports.postId, postId), eq(postReports.status, "pending")));
}

export async function deletePostByAdmin(postId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Remove reports first (FK safety)
  await db.delete(postReports).where(eq(postReports.postId, postId));
  await db.delete(posts).where(eq(posts.id, postId));
}

// ─── Cancellation Policies ────────────────────────────────────────────────────

export async function getCancellationPolicy(techId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(cancellationPolicies)
    .where(eq(cancellationPolicies.techId, techId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertCancellationPolicy(data: {
  techId: number;
  windowHours: number;
  feeType: "flat" | "percent";
  feeAmount: number;
  gracePeriodHours?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(cancellationPolicies)
    .values({
      techId: data.techId,
      windowHours: data.windowHours,
      feeType: data.feeType,
      feeAmount: data.feeAmount,
      gracePeriodHours: data.gracePeriodHours ?? 1,
    })
    .onDuplicateKeyUpdate({
      set: {
        windowHours: data.windowHours,
        feeType: data.feeType,
        feeAmount: data.feeAmount,
        gracePeriodHours: data.gracePeriodHours ?? 1,
      },
    });
}

/**
 * Compute the resolved cancellation fee in dollars for a booking.
 * Returns 0 if within grace period, 0 if outside the policy window (free cancel),
 * or the fee amount if inside the late-cancel window.
 *
 * @param booking - the booking row (needs scheduledAt, createdAt, servicePrice optional)
 * @param policy  - the tech's cancellation policy
 * @param nowMs   - current time in ms (injectable for testing)
 * @returns { isGrace, isLateCancellation, feeAmountDollars }
 */
export function resolveCancellationFee(
  booking: { scheduledAt: Date; createdAt: Date },
  policy: { windowHours: number; feeType: "flat" | "percent"; feeAmount: number; gracePeriodHours: number },
  servicePrice: number | null,
  nowMs: number = Date.now()
): { isGrace: boolean; isLateCancellation: boolean; feeAmountDollars: number } {
  const bookedAtMs = booking.createdAt.getTime();
  const scheduledAtMs = booking.scheduledAt.getTime();
  const graceEndMs = bookedAtMs + policy.gracePeriodHours * 60 * 60 * 1000;
  const windowStartMs = scheduledAtMs - policy.windowHours * 60 * 60 * 1000;

  // Within grace period → always free
  if (nowMs <= graceEndMs) {
    return { isGrace: true, isLateCancellation: false, feeAmountDollars: 0 };
  }

  // Outside the late-cancel window → free cancel
  if (nowMs <= windowStartMs) {
    return { isGrace: false, isLateCancellation: false, feeAmountDollars: 0 };
  }

  // Inside the late-cancel window → fee applies
  let feeAmountDollars = 0;
  if (policy.feeType === "flat") {
    feeAmountDollars = policy.feeAmount;
  } else if (policy.feeType === "percent" && servicePrice != null && servicePrice > 0) {
    feeAmountDollars = Math.round((servicePrice * policy.feeAmount) / 100 * 100) / 100;
  }
  return { isGrace: false, isLateCancellation: true, feeAmountDollars };
}

/**
 * Cancel a booking and apply cancellation policy logic.
 * Sets status=cancelled, cancelledBy, cancelledAt, and cancellationFeeStatus/Amount.
 */
export async function cancelBooking(
  bookingId: number,
  cancelledBy: "client" | "tech",
  feeStatus: "none" | "pending" | "waived",
  feeAmountDollars: number
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancelledBy,
      cancelledAt: new Date(),
      cancellationFeeStatus: feeStatus,
      cancellationFeeAmount: feeAmountDollars > 0 ? feeAmountDollars : null,
    })
    .where(eq(bookings.id, bookingId));
}

export async function waiveCancellationFee(bookingId: number, techId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookings)
    .set({ cancellationFeeStatus: "waived" })
    .where(and(eq(bookings.id, bookingId), eq(bookings.techId, techId)));
}

/**
 * Find alternative nail techs for a cancelled booking.
 * Returns techs who:
 *  - offer the same service type (or have no services set)
 *  - have at least one available slot on the same day ±1 day
 *  - are not the original tech
 * Sorted by proximity if lat/lng available, otherwise by name.
 */
export async function getAlternativeTechs(params: {
  originalTechId: number;
  serviceType: string | null;
  scheduledAt: Date;
  clientLat?: number | null;
  clientLng?: number | null;
}): Promise<Array<{
  id: number;
  name: string | null;
  businessName: string | null;
  avatarUrl: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  services: string[] | null;
  priceRange: string | null;
  distanceMiles: number | null;
}>> {
  const db = await getDb();
  if (!db) return [];

  const dayMs = 24 * 60 * 60 * 1000;
  const windowStart = new Date(params.scheduledAt.getTime() - dayMs);
  const windowEnd = new Date(params.scheduledAt.getTime() + dayMs);

  // Get all nail techs except the original
  const techs = await db
    .select({
      id: users.id,
      name: users.name,
      businessName: users.businessName,
      avatarUrl: users.avatarUrl,
      location: users.location,
      lat: users.lat,
      lng: users.lng,
      services: users.services,
      priceRange: users.priceRange,
    })
    .from(users)
    .where(
      and(
        eq(users.userType, "nail_tech"),
        ne(users.id, params.originalTechId)
      )
    );

  // Filter by service type if provided
  const filtered = techs.filter((t) => {
    if (!params.serviceType) return true;
    if (!t.services || t.services.length === 0) return true;
    return t.services.some(
      (s) => s.toLowerCase() === params.serviceType!.toLowerCase()
    );
  });

  // Check availability in the window for each tech
  const windowStartDow = windowStart.getDay();
  const windowEndDow = windowEnd.getDay();
  const dows = new Set<number>();
  for (let d = new Date(windowStart); d <= windowEnd; d = new Date(d.getTime() + dayMs)) {
    dows.add(d.getDay());
  }

  const availRows = await db
    .select({ techId: availability.techId, dayOfWeek: availability.dayOfWeek })
    .from(availability)
    .where(
      and(
        eq(availability.isActive, true),
        inArray(
          availability.techId,
          filtered.map((t) => t.id)
        )
      )
    );

  const techsWithSlots = new Set(
    availRows
      .filter((r) => dows.has(r.dayOfWeek))
      .map((r) => r.techId)
  );

  const candidates = filtered.filter((t) => techsWithSlots.has(t.id));

  // Compute distance if client lat/lng available
  const result = candidates.map((t) => {
    let distanceMiles: number | null = null;
    if (
      params.clientLat != null &&
      params.clientLng != null &&
      t.lat != null &&
      t.lng != null
    ) {
      const R = 3958.8;
      const dLat = ((t.lat - params.clientLat) * Math.PI) / 180;
      const dLng = ((t.lng - params.clientLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((params.clientLat * Math.PI) / 180) *
          Math.cos((t.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      distanceMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return { ...t, distanceMiles };
  });

  result.sort((a, b) => {
    if (a.distanceMiles != null && b.distanceMiles != null)
      return a.distanceMiles - b.distanceMiles;
    if (a.distanceMiles != null) return -1;
    if (b.distanceMiles != null) return 1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  return result.slice(0, 8);
}

// ─── Settings: Profile ────────────────────────────────────────────────────────

export async function softDeactivateUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ deactivatedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserDarkMode(userId: number, darkMode: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ darkMode, updatedAt: new Date() }).where(eq(users.id, userId));
}

// ─── Settings: Tech Services ──────────────────────────────────────────────────

export async function getTechServices(techId: number): Promise<TechService[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(techServices)
    .where(and(eq(techServices.techId, techId), eq(techServices.isActive, true)))
    .orderBy(techServices.sortOrder, techServices.createdAt);
}

export async function upsertTechService(data: {
  id?: number;
  techId: number;
  category: string;
  customName?: string;
  photoKey?: string;
  photoUrl?: string;
  priceInCents: number;
  durationMinutes: number;
  sortOrder?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (data.id) {
    await db
      .update(techServices)
      .set({
        category: data.category,
        customName: data.customName ?? null,
        photoKey: data.photoKey ?? null,
        photoUrl: data.photoUrl ?? null,
        priceInCents: data.priceInCents,
        durationMinutes: data.durationMinutes,
        sortOrder: data.sortOrder ?? 0,
        updatedAt: new Date(),
      })
      .where(and(eq(techServices.id, data.id), eq(techServices.techId, data.techId)));
    return data.id;
  } else {
    const result = await db.insert(techServices).values({
      techId: data.techId,
      category: data.category,
      customName: data.customName,
      photoKey: data.photoKey,
      photoUrl: data.photoUrl,
      priceInCents: data.priceInCents,
      durationMinutes: data.durationMinutes,
      sortOrder: data.sortOrder ?? 0,
    });
    return (result as any)[0]?.insertId ?? 0;
  }
}

export async function deleteTechService(serviceId: number, techId: number) {
  const db = await getDb();
  if (!db) return;
  // Soft-delete by marking inactive
  await db
    .update(techServices)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(techServices.id, serviceId), eq(techServices.techId, techId)));
}

export async function updateTechServicePhoto(
  serviceId: number,
  techId: number,
  photoKey: string,
  photoUrl: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(techServices)
    .set({ photoKey, photoUrl, updatedAt: new Date() })
    .where(and(eq(techServices.id, serviceId), eq(techServices.techId, techId)));
}

// ─── Settings: Notification Preferences ──────────────────────────────────────

const DEFAULT_CLIENT_NOTIF_TYPES = [
  "booking_confirmed",
  "booking_reminder",
  "booking_cancelled_by_tech",
  "new_post_from_followed",
  "promotional",
];

const DEFAULT_TECH_NOTIF_TYPES = [
  "new_booking_request",
  "booking_cancelled_by_client",
  "client_message",
  "payment_fee_update",
  "new_subscriber",
];

export async function getNotificationPreferences(
  userId: number,
  userType: "client" | "nail_tech"
): Promise<NotificationPreference[]> {
  const db = await getDb();
  if (!db) return [];
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));

  const types = userType === "nail_tech" ? DEFAULT_TECH_NOTIF_TYPES : DEFAULT_CLIENT_NOTIF_TYPES;
  // Return defaults merged with any saved prefs
  return types.map((type) => {
    const saved = existing.find((p) => p.type === type);
    return saved ?? ({
      id: 0,
      userId,
      type,
      inApp: true,
      sms: false,
      email: true,
      updatedAt: new Date(),
    } as NotificationPreference);
  });
}

export async function upsertNotificationPreference(
  userId: number,
  type: string,
  channels: { inApp: boolean; sms: boolean; email: boolean }
) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type)));
  if (existing.length > 0) {
    await db
      .update(notificationPreferences)
      .set({ ...channels, updatedAt: new Date() })
      .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type)));
  } else {
    await db.insert(notificationPreferences).values({ userId, type, ...channels });
  }
}

// ─── Settings: Privacy ────────────────────────────────────────────────────────

export async function getPrivacySettings(userId: number): Promise<PrivacySettings> {
  const db = await getDb();
  const defaults: PrivacySettings = {
    id: 0,
    userId,
    profilePrivate: false,
    hideBookingHistory: false,
    hideFromNearMe: false,
    discoverVisible: true,
    hideExactAddress: false,
    messagePermission: "anyone",
    updatedAt: new Date(),
  };
  if (!db) return defaults;
  const rows = await db.select().from(privacySettings).where(eq(privacySettings.userId, userId));
  return rows[0] ?? defaults;
}

export async function upsertPrivacySettings(
  userId: number,
  data: Partial<Omit<PrivacySettings, "id" | "userId" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(privacySettings).where(eq(privacySettings.userId, userId));
  if (existing.length > 0) {
    await db.update(privacySettings).set({ ...data, updatedAt: new Date() }).where(eq(privacySettings.userId, userId));
  } else {
    await db.insert(privacySettings).values({ userId, ...data });
  }
}

// ─── Settings: Block Users ────────────────────────────────────────────────────

export async function blockUser(blockerId: number, blockedId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(blockedUsers).values({ blockerId, blockedId });
  } catch {
    // Already blocked — ignore duplicate
  }
}

export async function unblockUser(blockerId: number, blockedId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(blockedUsers)
    .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, blockedId)));
}

export async function getBlockedUsers(
  blockerId: number,
  search?: string
): Promise<Array<{ id: number; blockedId: number; name: string | null; avatarUrl: string | null; blockedAt: Date }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: blockedUsers.id,
      blockedId: blockedUsers.blockedId,
      name: users.name,
      avatarUrl: users.avatarUrl,
      blockedAt: blockedUsers.createdAt,
    })
    .from(blockedUsers)
    .innerJoin(users, eq(users.id, blockedUsers.blockedId))
    .where(eq(blockedUsers.blockerId, blockerId))
    .orderBy(desc(blockedUsers.createdAt));

  if (search) {
    const q = search.toLowerCase();
    return rows.filter((r) => r.name?.toLowerCase().includes(q));
  }
  return rows;
}

// Returns users the current user has interacted with (bookings + messages), sorted by most recent
export async function getInteractedUsers(
  userId: number
): Promise<Array<{ id: number; name: string | null; avatarUrl: string | null; lastInteractionAt: Date }>> {
  const db = await getDb();
  if (!db) return [];

  // Get conversation partners
  const convRows = await db
    .select({
      partnerId: sql<number>`CASE WHEN ${conversations.clientId} = ${userId} THEN ${conversations.techId} ELSE ${conversations.clientId} END`,
      lastAt: conversations.lastMessageAt,
    })
    .from(conversations)
    .where(or(eq(conversations.clientId, userId), eq(conversations.techId, userId)))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(50);

  const partnerIds = Array.from(new Set(convRows.map((r) => r.partnerId)));
  if (partnerIds.length === 0) return [];

  const partnerUsers = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, partnerIds));

  return partnerIds.map((pid) => {
    const u = partnerUsers.find((p) => p.id === pid);
    const row = convRows.find((r) => r.partnerId === pid);
    return {
      id: pid,
      name: u?.name ?? null,
      avatarUrl: u?.avatarUrl ?? null,
      lastInteractionAt: row?.lastAt ?? new Date(0),
    };
  });
}

// ─── Settings: Subscription ───────────────────────────────────────────────────

export async function getTechSubscriptionStatus(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.id, userId));
  const user = rows[0];
  if (!user) return null;
  const now = new Date();
  const trialEnd = user.subscriptionTrialEndsAt;
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;
  return {
    status: user.subscriptionStatus ?? "trial",
    subscriptionStartedAt: user.subscriptionStartedAt,
    trialEndsAt: trialEnd,
    trialDaysLeft,
  };
}

export async function initTechSubscription(userId: number) {
  const db = await getDb();
  if (!db) return;
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 60); // 2 months
  await db
    .update(users)
    .set({
      subscriptionStatus: "trial",
      subscriptionStartedAt: new Date(),
      subscriptionTrialEndsAt: trialEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

// ─── Account Deactivation & Permanent Deletion ───────────────────────────────

/**
 * Returns all upcoming (pending/confirmed) bookings for a user,
 * whether they are the client or the tech.
 */
export async function getUpcomingBookingsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db
    .select()
    .from(bookings)
    .where(
      and(
        or(eq(bookings.clientId, userId), eq(bookings.techId, userId)),
        or(eq(bookings.status, "pending"), eq(bookings.status, "confirmed")),
        gt(bookings.scheduledAt, now)
      )
    );
}

/**
 * Full deactivation:
 * - Cancels all upcoming bookings (client pays fee if they are the client-side party)
 * - Hides all tech posts
 * - Sets deactivatedAt on the user
 * - Sends in-app notification to the other party on each cancelled booking
 */
export async function deactivateAccountFull(userId: number) {
  const db = await getDb();
  if (!db) return { cancelledCount: 0 };

  const upcomingBookings = await getUpcomingBookingsForUser(userId);
  let cancelledCount = 0;

  for (const booking of upcomingBookings) {
    const isClient = booking.clientId === userId;
    const cancelledBy: "client" | "tech" = isClient ? "client" : "tech";
    const otherPartyId = isClient ? booking.techId : booking.clientId;

    // Resolve fee: only clients pay
    let feeStatus: "none" | "pending" = "none";
    let feeAmountDollars = 0;
    if (isClient) {
      const policy = await getCancellationPolicy(booking.techId);
      if (policy) {
        const resolved = resolveCancellationFee(
          { scheduledAt: booking.scheduledAt, createdAt: booking.createdAt },
          policy,
          null // servicePrice not stored on booking row; fee calc uses flat/percent of policy
        );
        if (resolved.isLateCancellation && resolved.feeAmountDollars > 0) {
          feeStatus = "pending";
          feeAmountDollars = resolved.feeAmountDollars;
        }
      }
    }

    await cancelBooking(booking.id, cancelledBy, feeStatus, feeAmountDollars);
    cancelledCount++;

    // Notify the other party
    const feeNote = feeStatus === "pending" ? ` A cancellation fee of $${feeAmountDollars.toFixed(2)} applies.` : "";
    await createNotification({
      userId: otherPartyId,
      type: "booking_cancelled",
      title: "Booking Cancelled",
      body: `A booking on ${booking.scheduledAt.toLocaleDateString()} was cancelled because the other party deactivated their account.${feeNote}`,
      relatedId: booking.id,
    });
  }

  // Hide all tech posts
  await db
    .update(posts)
    .set({ status: "hidden" })
    .where(and(eq(posts.techId, userId), eq(posts.status, "published")));

  // Set deactivatedAt
  await db.update(users).set({ deactivatedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));

  return { cancelledCount };
}

/**
 * Reactivation: clears deactivatedAt and restores hidden posts to published.
 */
export async function reactivateAccount(userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ deactivatedAt: null, updatedAt: new Date() }).where(eq(users.id, userId));

  // Restore hidden posts (only those hidden by the tech themselves, not by admin/report)
  await db
    .update(posts)
    .set({ status: "published" })
    .where(and(eq(posts.techId, userId), eq(posts.status, "hidden")));
}

/**
 * Permanent deletion:
 * - Cancels upcoming bookings (same fee logic as deactivation)
 * - Notifies the other party
 * - Hard-deletes all user data
 * - Deletes the user row
 */
export async function permanentDeleteAccount(userId: number) {
  const db = await getDb();
  if (!db) return { cancelledCount: 0 };

  // Cancel upcoming bookings and notify other party (same logic as deactivation)
  const upcomingBookings = await getUpcomingBookingsForUser(userId);
  let cancelledCount = 0;

  for (const booking of upcomingBookings) {
    const isClient = booking.clientId === userId;
    const cancelledBy: "client" | "tech" = isClient ? "client" : "tech";
    const otherPartyId = isClient ? booking.techId : booking.clientId;

    let feeStatus: "none" | "pending" = "none";
    let feeAmountDollars = 0;
    if (isClient) {
      const policy = await getCancellationPolicy(booking.techId);
      if (policy) {
        const resolved = resolveCancellationFee(
          { scheduledAt: booking.scheduledAt, createdAt: booking.createdAt },
          policy,
          null
        );
        if (resolved.isLateCancellation && resolved.feeAmountDollars > 0) {
          feeStatus = "pending";
          feeAmountDollars = resolved.feeAmountDollars;
        }
      }
    }

    await cancelBooking(booking.id, cancelledBy, feeStatus, feeAmountDollars);
    cancelledCount++;

    const feeNote = feeStatus === "pending" ? ` A cancellation fee of $${feeAmountDollars.toFixed(2)} applies.` : "";
    await createNotification({
      userId: otherPartyId,
      type: "booking_cancelled",
      title: "Booking Cancelled",
      body: `A booking on ${booking.scheduledAt.toLocaleDateString()} was cancelled because the other party deleted their account.${feeNote}`,
      relatedId: booking.id,
    });
  }

  // Hard-delete all user data (order matters for FK constraints)
  await db.delete(notifications).where(eq(notifications.userId, userId));
  await db.delete(techFollows).where(or(eq(techFollows.clientId, userId), eq(techFollows.techId, userId)));
  await db.delete(savedPosts).where(eq(savedPosts.userId, userId));
  await db.delete(likes).where(eq(likes.userId, userId));
  await db.delete(postReports).where(eq(postReports.reporterId, userId));
  await db.delete(reviews).where(or(eq(reviews.clientId, userId), eq(reviews.techId, userId)));
  await db.delete(messages).where(or(eq(messages.senderId, userId)));
  await db.delete(conversations).where(or(eq(conversations.clientId, userId), eq(conversations.techId, userId)));
  // Delete postAnalytics for this tech's posts (two-step: fetch IDs first)
  const techPostIds = await db.select({ id: posts.id }).from(posts).where(eq(posts.techId, userId));
  if (techPostIds.length > 0) {
    await db.delete(postAnalytics).where(inArray(postAnalytics.postId, techPostIds.map(p => p.id)));
    await db.delete(savedPosts).where(inArray(savedPosts.postId, techPostIds.map(p => p.id)));
    await db.delete(postReports).where(inArray(postReports.postId, techPostIds.map(p => p.id)));
  }
  await db.delete(posts).where(eq(posts.techId, userId));
  await db.delete(techServices).where(eq(techServices.techId, userId));
  await db.delete(availability).where(eq(availability.techId, userId));
  await db.delete(scheduleBlocks).where(eq(scheduleBlocks.techId, userId));
  await db.delete(bookings).where(or(eq(bookings.clientId, userId), eq(bookings.techId, userId)));
  await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
  await db.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  await db.delete(privacySettings).where(eq(privacySettings.userId, userId));
  await db.delete(blockedUsers).where(or(eq(blockedUsers.blockerId, userId), eq(blockedUsers.blockedId, userId)));
  await db.delete(cancellationPolicies).where(eq(cancellationPolicies.techId, userId));
  await db.delete(collections).where(eq(collections.userId, userId));

  // Finally delete the user row
  await db.delete(users).where(eq(users.id, userId));

  return { cancelledCount };
}
