import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createBooking,
  createCollection,
  createLastMinuteSlot,
  createNotification,
  createPost,
  createReview,
  deleteCollection,
  deleteLastMinuteSlot,
  deletePost,
  getClientBookings,
  getConversationMessages,
  getDiscoverFeed,
  getFollowerCount,
  getOpenLastMinuteSlots,
  getOrCreateConversation,
  getOrCreateSubscription,
  getPostById,
  getTechAnalytics,
  getTechAvailability,
  getTechBookings,
  getTechLastMinuteSlots,
  getTechPosts,
  getTechRatingStats,
  getTechReviews,
  getUserById,
  getUserCollections,
  getUserConversations,
  getUserLikes,
  getUserNotifications,
  getUserSavedPosts,
  incrementPostViews,
  markMessagesRead,
  markNotificationsRead,
  sendMessage,
  setTechAvailability,
  getTodayBookings,
  getWeeklySchedule,
  setWeeklySchedule,
  getScheduleBlocks,
  createScheduleBlock,
  deleteScheduleBlock,
  toggleFollow,
  toggleLike,
  toggleSave,
  updateBookingStatus,
  updateCollection,
  updatePost,
  updateSubscription,
  updateUserProfile,
  getAvailableSlots,
  getMonthBookableStatus,
  createBookingWithConflictCheck,
  isReturningClient,
  getBookingRulesForTech,
  getClientTierForSlot,
  createBookingRule,
  deleteBookingRule,
  setAvailabilityClientTier,
} from "./db";
import { storagePut } from "./storage";

// ─── Auth ─────────────────────────────────────────────────────────────────────
const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// ─── Users / Profile ──────────────────────────────────────────────────────────
const usersRouter = router({
  getProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const user = await getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const ratingStats = user.userType === "nail_tech" ? await getTechRatingStats(user.id) : null;
      const followerCount = await getFollowerCount(user.id);
      return { user, ratingStats, followerCount };
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        bio: z.string().optional(),
        location: z.string().optional(),
        phone: z.string().optional(),
        businessName: z.string().optional(),
        services: z.array(z.string()).optional(),
        priceRange: z.string().optional(),
        instagramHandle: z.string().optional(),
        stylePreferences: z.array(z.string()).optional(),
        colorPreferences: z.array(z.string()).optional(),
        userType: z.enum(["client", "nail_tech"]).optional(),
        onboardingCompleted: z.boolean().optional(),
        avatarUrl: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, input as any);
      return { success: true };
    }),

  completeOnboarding: protectedProcedure
    .input(
      z.object({
        userType: z.enum(["client", "nail_tech"]),
        // client fields
        stylePreferences: z.array(z.string()).optional(),
        colorPreferences: z.array(z.string()).optional(),
        location: z.string().optional(),
        // tech fields
        businessName: z.string().optional(),
        bio: z.string().optional(),
        services: z.array(z.string()).optional(),
        priceRange: z.string().optional(),
        phone: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, { ...input, onboardingCompleted: true } as any);
      if (input.userType === "nail_tech") {
        await getOrCreateSubscription(ctx.user.id);
      }
      return { success: true };
    }),

  follow: protectedProcedure
    .input(z.object({ targetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return toggleFollow(ctx.user.id, input.targetId);
    }),

  getFollowerCount: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => getFollowerCount(input.userId)),

  // Dual-role: switch between client and nail_tech mode
  switchMode: protectedProcedure
    .input(z.object({ mode: z.enum(["client", "nail_tech"]) }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      // Can only switch to nail_tech if they have dual role or are already a nail_tech
      if (input.mode === "nail_tech" && user.userType !== "nail_tech" && !user.hasDualRole) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You need a nail tech account to switch to this mode." });
      }
      await updateUserProfile(user.id, { activeMode: input.mode } as any);
      return { success: true, activeMode: input.mode };
    }),

  // Dual-role: upgrade a client account to also have a nail tech profile
  becomeNailTech: protectedProcedure
    .input(
      z.object({
        businessName: z.string().optional(),
        bio: z.string().optional(),
        services: z.array(z.string()).optional(),
        priceRange: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, {
        ...input,
        userType: "nail_tech",
        hasDualRole: true,
        activeMode: "nail_tech",
      } as any);
      await getOrCreateSubscription(ctx.user.id);
      return { success: true };
    }),
});

// ─── Posts ────────────────────────────────────────────────────────────────────
const postsRouter = router({
  feed: publicProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
        style: z.string().optional(),          // legacy single-style compat
        styles: z.array(z.string()).optional(), // multi-select
        shape: z.string().optional(),
        color: z.string().optional(),
        distanceMiles: z.number().optional(),
        userLat: z.number().optional(),
        userLng: z.number().optional(),
        soonestAvailable: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      // Merge single and multi-select style inputs
      const styles = input.styles && input.styles.length > 0
        ? input.styles
        : input.style ? [input.style] : undefined;
      return getDiscoverFeed(input.limit, input.offset, {
        styles,
        shape: input.shape,
        color: input.color,
        distanceMiles: input.distanceMiles,
        userLat: input.userLat,
        userLng: input.userLng,
        soonestAvailable: input.soonestAvailable,
      });
    }),

  getById: publicProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ input, ctx }) => {
      const post = await getPostById(input.postId);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      const tech = await getUserById(post.techId);
      await incrementPostViews(input.postId);
      const ratingStats = tech ? await getTechRatingStats(tech.id) : null;
      return { post, tech, ratingStats };
    }),

  create: protectedProcedure
    .input(
      z.object({
        imageUrls: z.array(z.string()).min(1),
        caption: z.string().optional(),
        style: z.string().optional(),
        shape: z.string().optional(),
        color: z.string().optional(),
        location: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      const postId = await createPost({ ...input, techId: ctx.user.id });
      return { postId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        caption: z.string().optional(),
        style: z.string().optional(),
        shape: z.string().optional(),
        color: z.string().optional(),
        location: z.string().optional(),
        status: z.enum(["published", "draft", "hidden"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { postId, ...data } = input;
      await updatePost(postId, ctx.user.id, data as any);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deletePost(input.postId, ctx.user.id);
      return { success: true };
    }),

  myPosts: protectedProcedure.query(async ({ ctx }) => {
    return getTechPosts(ctx.user.id);
  }),

  techPosts: publicProcedure
    .input(z.object({ techId: z.number() }))
    .query(async ({ input }) => getTechPosts(input.techId)),

  toggleLike: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => toggleLike(ctx.user.id, input.postId)),

  toggleSave: protectedProcedure
    .input(z.object({ postId: z.number(), collectionId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => toggleSave(ctx.user.id, input.postId, input.collectionId)),

  userLikes: protectedProcedure
    .input(z.object({ postIds: z.array(z.number()) }))
    .query(async ({ ctx, input }) => getUserLikes(ctx.user.id, input.postIds)),

  uploadImage: protectedProcedure
    .input(z.object({ base64: z.string(), mimeType: z.string(), filename: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const key = `posts/${ctx.user.id}/${Date.now()}-${input.filename}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),

  uploadAvatar: protectedProcedure
    .input(z.object({ base64: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const key = `avatars/${ctx.user.id}-${Date.now()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),
});

// ─── Collections ──────────────────────────────────────────────────────────────
const collectionsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => getUserCollections(ctx.user.id)),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const id = await createCollection(ctx.user.id, input.name);
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), coverImageUrl: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateCollection(id, ctx.user.id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCollection(input.id, ctx.user.id);
      return { success: true };
    }),

  savedPosts: protectedProcedure.query(async ({ ctx }) => getUserSavedPosts(ctx.user.id)),
});

// ─── Bookings ─────────────────────────────────────────────────────────────────
const bookingsRouter = router({
  availableSlots: publicProcedure
    .input(
      z.object({
        techId: z.number(),
        date: z.string(), // "YYYY-MM-DD"
        duration: z.number().default(60),
      })
    )
    .query(async ({ ctx, input }) =>
      getAvailableSlots(input.techId, input.date, input.duration, ctx.user?.id)
    ),

  // Returns { "YYYY-MM-DD": true/false } for all working days in the given month.
  // true = has at least one open slot; false = working day but fully booked.
  monthBookableStatus: publicProcedure
    .input(
      z.object({
        techId: z.number(),
        year: z.number(),
        month: z.number(), // 1-indexed
        duration: z.number().default(60),
      })
    )
    .query(async ({ input }) =>
      getMonthBookableStatus(input.techId, input.year, input.month, input.duration)
    ),

  create: protectedProcedure
    .input(
      z.object({
        techId: z.number(),
        postId: z.number().optional(),
        serviceType: z.string().optional(),
        scheduledAt: z.number(), // timestamp ms
        duration: z.number().default(60),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bookingId = await createBookingWithConflictCheck({
        clientId: ctx.user.id,
        techId: input.techId,
        postId: input.postId ?? null,
        serviceType: input.serviceType ?? null,
        scheduledAt: new Date(input.scheduledAt),
        duration: input.duration,
        notes: input.notes ?? null,
      } as any);
      await createNotification(
        input.techId,
        "new_booking",
        "New Booking Request",
        `${ctx.user.name ?? "A client"} requested a booking`,
        bookingId
      );
      return { bookingId };
    }),

  myBookings: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.userType === "nail_tech") return getTechBookings(ctx.user.id);
    return getClientBookings(ctx.user.id);
  }),

  clientBookings: protectedProcedure.query(async ({ ctx }) => getClientBookings(ctx.user.id)),
  techBookings: protectedProcedure.query(async ({ ctx }) => getTechBookings(ctx.user.id)),
  todayBookings: protectedProcedure.query(async ({ ctx }) => getTodayBookings(ctx.user.id)),

  updateStatus: protectedProcedure
    .input(
      z.object({
        bookingId: z.number(),
        status: z.enum(["confirmed", "declined", "cancelled", "completed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateBookingStatus(input.bookingId, input.status, ctx.user.id);
      return { success: true };
    }),
});

// ─── Availability ─────────────────────────────────────────────────────────────
const availabilityRouter = router({
  get: publicProcedure
    .input(z.object({ techId: z.number() }))
    .query(async ({ input }) => getTechAvailability(input.techId)),

  set: protectedProcedure
    .input(
      z.object({
        slots: z.array(
          z.object({
            dayOfWeek: z.number().min(0).max(6),
            startTime: z.string(),
            endTime: z.string(),
            isActive: z.boolean(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await setTechAvailability(ctx.user.id, input.slots);
      return { success: true };
    }),

  weeklySchedule: protectedProcedure.query(async ({ ctx }) => getWeeklySchedule(ctx.user.id)),

  setWeeklySchedule: protectedProcedure
    .input(
      z.object({
        schedule: z.array(
          z.object({
            dayOfWeek: z.number().min(0).max(6),
            startTime: z.string(),
            endTime: z.string(),
            isActive: z.boolean(),
            breakStart: z.string().nullable().optional(),
            breakEnd: z.string().nullable().optional(),
            bufferMinutes: z.number().min(0).max(120).nullable().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await setWeeklySchedule(ctx.user.id, input.schedule);
      return { success: true };
    }),

  blocks: protectedProcedure.query(async ({ ctx }) => getScheduleBlocks(ctx.user.id)),

  addBlock: protectedProcedure
    .input(
      z.object({
        blockDate: z.number(), // UTC ms timestamp
        startTime: z.string(),
        endTime: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await createScheduleBlock(ctx.user.id, {
        blockDate: new Date(input.blockDate),
        startTime: input.startTime,
        endTime: input.endTime,
        reason: input.reason,
      });
      return { success: true };
    }),

  removeBlock: protectedProcedure
    .input(z.object({ blockId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteScheduleBlock(input.blockId, ctx.user.id);
      return { success: true };
    }),

  // ── Day-level client tier ──────────────────────────────────────────────────
  setDayTier: protectedProcedure
    .input(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        clientTier: z.enum(["open", "returning_only"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await setAvailabilityClientTier(ctx.user.id, input.dayOfWeek, input.clientTier);
      return { success: true };
    }),

  // ── Time-block booking rules ───────────────────────────────────────────────
  bookingRules: protectedProcedure.query(async ({ ctx }) =>
    getBookingRulesForTech(ctx.user.id)
  ),

  addBookingRule: protectedProcedure
    .input(
      z.object({
        dayOfWeek: z.number().min(0).max(6).nullable().optional(),
        specificDate: z.number().nullable().optional(), // UTC ms timestamp
        startTime: z.string(),
        endTime: z.string(),
        clientTier: z.enum(["open", "returning_only"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createBookingRule({
        techId: ctx.user.id,
        dayOfWeek: input.dayOfWeek ?? null,
        specificDate: input.specificDate ? new Date(input.specificDate) : null,
        startTime: input.startTime,
        endTime: input.endTime,
        clientTier: input.clientTier,
      });
      return { id };
    }),

  removeBookingRule: protectedProcedure
    .input(z.object({ ruleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteBookingRule(input.ruleId, ctx.user.id);
      return { success: true };
    }),
});

// ─── Last-Minute Slots ────────────────────────────────────────────────────────
const lastMinuteRouter = router({
  mySlots: protectedProcedure.query(async ({ ctx }) => getTechLastMinuteSlots(ctx.user.id)),

  openSlots: publicProcedure.query(async () => getOpenLastMinuteSlots()),

  create: protectedProcedure
    .input(
      z.object({
        slotDate: z.number(),
        duration: z.number().default(60),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createLastMinuteSlot(ctx.user.id, new Date(input.slotDate), input.duration, input.note);
      return { id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteLastMinuteSlot(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── Messaging ────────────────────────────────────────────────────────────────
const messagingRouter = router({
  getOrCreateConversation: protectedProcedure
    .input(z.object({ techId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const clientId = ctx.user.userType === "client" ? ctx.user.id : input.techId;
      const techId = ctx.user.userType === "nail_tech" ? ctx.user.id : input.techId;
      return getOrCreateConversation(clientId, techId);
    }),

  conversations: protectedProcedure.query(async ({ ctx }) => {
    const convs = await getUserConversations(ctx.user.id);
    // deduplicate by conversation id
    const seen = new Set<number>();
    return convs.filter(c => {
      if (seen.has(c.conversation.id)) return false;
      seen.add(c.conversation.id);
      return true;
    });
  }),

  messages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      await markMessagesRead(input.conversationId, ctx.user.id);
      const msgs = await getConversationMessages(input.conversationId);
      return msgs.reverse();
    }),

  send: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        content: z.string().optional(),
        imageUrl: z.string().optional(),
        bookingId: z.number().optional(),
        type: z.enum(["text", "image", "booking_request", "booking_card"]).default("text"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await sendMessage({
        conversationId: input.conversationId,
        senderId: ctx.user.id,
        content: input.content ?? null,
        imageUrl: input.imageUrl ?? null,
        bookingId: input.bookingId ?? null,
        type: input.type,
      } as any);
      return { id };
    }),
});

// ─── Reviews ──────────────────────────────────────────────────────────────────
const reviewsRouter = router({
  techReviews: publicProcedure
    .input(z.object({ techId: z.number() }))
    .query(async ({ input }) => getTechReviews(input.techId)),

  create: protectedProcedure
    .input(
      z.object({
        bookingId: z.number(),
        techId: z.number(),
        rating: z.number().min(1).max(5),
        text: z.string().optional(),
        photoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createReview({
        bookingId: input.bookingId,
        clientId: ctx.user.id,
        techId: input.techId,
        rating: input.rating,
        text: input.text ?? null,
        photoUrl: input.photoUrl ?? null,
      } as any);
      return { id };
    }),
});

// ─── Analytics ────────────────────────────────────────────────────────────────
const analyticsRouter = router({
  techAnalytics: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
    return getTechAnalytics(ctx.user.id);
  }),

  postAnalytics: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ ctx, input }) => {
      const post = await getPostById(input.postId);
      if (!post || post.techId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const postsWithAnalytics = await getTechPosts(ctx.user.id);
      return postsWithAnalytics.find(p => p.post.id === input.postId)?.analytics ?? null;
    }),
});

// ─── Subscriptions ────────────────────────────────────────────────────────────
const subscriptionsRouter = router({
  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    return getOrCreateSubscription(ctx.user.id);
  }),

  activate: protectedProcedure.input(z.object({ tier: z.enum(["monthly", "growth"]).default("monthly") })).mutation(async ({ ctx, input }) => {
    const now = new Date();
    const durationMs = input.tier === "growth"
      ? 365 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;
    const end = new Date(now.getTime() + durationMs);
    await updateSubscription(ctx.user.id, {
      status: "active",
      tier: input.tier,
      currentPeriodStart: now,
      currentPeriodEnd: end,
    });
    return { success: true };
  }),
});

// ─── Notifications ────────────────────────────────────────────────────────────
const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => getUserNotifications(ctx.user.id)),
  markRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markNotificationsRead(ctx.user.id);
    return { success: true };
  }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  users: usersRouter,
  posts: postsRouter,
  collections: collectionsRouter,
  bookings: bookingsRouter,
  availability: availabilityRouter,
  lastMinute: lastMinuteRouter,
  messaging: messagingRouter,
  reviews: reviewsRouter,
  analytics: analyticsRouter,
  subscriptions: subscriptionsRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
