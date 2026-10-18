import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { COOKIE_NAME, CURRENT_TOS_VERSION, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createBooking,
  createQaAppointmentRun,
  createQaTestClient,
  createCollection,
  createLastMinuteSlot,
  createNotification,
  createPost,
  createReview,
  deleteCollection,
  deleteQaAppointmentRunForAdmin,
  deleteLastMinuteSlot,
  deletePost,
  hardDeletePost,
  restorePost,
  getClientBookings,
  getAllUserBookings,
  getActiveQaAppointmentRunForAdmin,
  getConversationForParticipant,
  getConversationMessages,
  getDiscoverFeed,
  getFollowerCount,
  getOpenLastMinuteSlots,
  getActiveLastMinuteSlotById,
  getOrCreateConversation,
  getOrCreateSubscription,
  getPostById,
  getQaAppointmentRunById,
  getQaAppointmentRunForParticipant,
  getTechAnalytics,
  getTechAvailability,
  getTechBookings,
  getTechLastMinuteSlots,
  getTechPosts,
  getTechRatingStats,
  getTechReviews,
  getReviewByBookingId,
  getUserById,
  hasOutstandingAppointmentPayment,
  getUserCollections,
  getUserConversations,
  getUserLikes,
  getUserNotifications,
  getSavedPostIds,
  getSavedPostsForAlbum,
  getCollectionsWithMeta,
  getPostSaveState,
  savePost,
  unsavePost,
  setAlbumMemberships,
  incrementPostViews,
  markMessagesRead,
  markNotificationsRead,
  sendMessage,
  setTechAvailability,
  getTodayBookings,
  getTechBookingsTimeline,
  getTechPastBookings,
  getTechPayoutHistory,
  getWeeklySchedule,
  setWeeklySchedule,
  getScheduleBlocks,
  createScheduleBlock,
  deleteScheduleBlock,
  getTechnicianCalendar,
  createCalendarEvent,
  deleteCalendarEvent,
  getAvailabilityOverrideConflicts,
  applyCalendarAvailabilityOverride,
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
  createBookingRevision,
  isReturningClient,
  getBookingRulesForTech,
  getClientTierForSlot,
  createBookingRule,
  deleteBookingRule,
  updateBookingRule,
  setAvailabilityClientTier,
  followTech,
  unfollowTech,
  isTechFollowed,
  getTechFollowerCount,
  getFollowedTechIds,
  getUnreadNotificationCount,
  getUnreadSlotNotificationCount,
  markSingleNotificationRead,
  notifyTechFollowers,
  submitReport,
  hasUserReportedPost,
  getReportsForAdmin,
  getAdminUserIds,
  getDisputedBookingsForAdmin,
  dismissReport,
  hidePostByAdmin,
  deletePostByAdmin,
  getBookingById,
  getBookingMatchAssessments,
  getBookingServiceLines,
  getLatestBookingRevision,
  getCancellationPolicy,
  upsertCancellationPolicy,
  resolveCancellationFee,
  cancelBooking,
  waiveCancellationFee,
  createBookingFeeEvent,
  getAppointmentFeePolicy,
  getBookingFeeEvent,
  getBookingFeeEvents,
  getBookingServiceDurationMinutes,
  getDisputedFeeEventsForAdmin,
  getAttendanceFeeEligibilityCandidates,
  markBookingArrivedAndVoidPendingFees,
  markBookingNoShow,
  markBookingFeeEventNotified,
  setBookingFeePolicyAcknowledgement,
  updateBookingFeeEvent,
  upsertAppointmentFeeRules,
  getAlternativeTechs,
  // Settings helpers
  softDeactivateUser,
  deactivateAccountFull,
  reactivateAccount,
  permanentDeleteAccount,
  getUpcomingBookingsForUser,
  updateUserDarkMode,
  getTechServices,
  getSmartServiceSettings,
  replaceBookingServiceLines,
  resolveBookingRevision,
  saveBookingMatchAssessment,
  updateSmartServiceSettings,
  upsertTechService,
  deleteTechService,
  updateTechServicePhoto,
  getNotificationPreferences,
  upsertNotificationPreference,
  getPrivacySettings,
  upsertPrivacySettings,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getInteractedUsers,
  hasAppointmentRelationship,
  isDirectMessageBlocked,
  searchMarketplaceUsers,
  getTechSubscriptionStatus,
  initTechSubscription,
  getTechFollowerIds,
  getActiveSlotsForTech,
  getTechsNearMe,
  getUserByEmail,
  createEmailUser,
  updateUserStripeReferences,
  setBookingPaymentMethodState,
  setBookingAppointmentCode,
  recordAppointmentCodeFailure,
  startVerifiedAppointment,
  markAppointmentCompleted,
  markBookingPaymentResult,
  reportBookingIssue,
  getBookingServiceTotalInCents,
  getPayoutEligibleBookings,
  markBookingPayoutResult,
  setBookingTipPaymentIntent,
  declineBookingTip,
  resolveBookingIssue,
} from "./db";
import { storagePut } from "./storage";
import { isValidInspirationImageReference } from "../shared/inspirationImage";
import { getDirectMessageValidationError, isConversationParticipant, isSafeDirectMessageImageReference } from "../shared/directMessaging";
import { getConversationRole, isTechCapable } from "../shared/marketplaceAccess";
import { getReviewEligibility } from "../shared/reviewEligibility";
import { sendValisseTransactionalSms } from "./telnyx";
import {
  appointmentCodeVisibleAt,
  canStartVerifiedAppointment,
  deriveAppointmentCode,
  hashAppointmentCode,
  isValidAppointmentCodeInput,
  payoutEligibleAt,
} from "../shared/appointmentLifecycle";
import {
  getIssueResolutionAmounts,
  getStandardTipOptions,
  isTipFinal,
} from "../shared/paymentResolution";
import { isStripeObjectInConfiguredEnvironment, resolveStripeModeForBooking, type StripePaymentMode } from "../shared/stripeMode";
import {
  buildAppointmentFeePolicySnapshot,
  formatRuleFee,
  isCancellationFeeEligible,
  resolveAppointmentFeeAmountInCents,
  resolveAttendanceThresholdMinutes,
  type AppointmentFeeRuleInput,
  type AppointmentFeeType,
} from "../shared/appointmentFeePolicy";
import {
  QA_APPOINTMENT_DURATION_MINUTES,
  QA_APPOINTMENT_LABEL,
  createQaRunExpiry,
  createQaScheduledAt,
  isQaAppointmentLabEnabled,
} from "../shared/qaAppointment";
import {
  chargeSavedCard,
  chargeAppointmentFee,
  createBookingCardSetupIntent,
  createTipPaymentIntent,
  createBookingSetupIntent,
  createRecipientOnboardingLink,
  createRecipientConnectedAccount,
  createStripeCustomer,
  getConnectedAccountReadiness,
  getStripeIntegrationStatus,
  releaseBookingPayout,
  refundPaymentIntent,
  verifyBookingCardSetupIntent,
  verifyBookingSetupIntent,
  verifyTipPaymentIntent,
} from "./stripe";
import {
  evaluateSmartServiceMatch,
  getSystemSmartServiceMatchConfig,
  SMART_SERVICE_MATCH_CONFIGS,
} from "./smartServiceMatch";
import {
  getSmartMatchConfig,
  getAllSmartMatchConfigsForTech,
  upsertSmartMatchConfig,
  saveSmartMatchResponse,
  evaluateSmartMatchRules,
  isSmartMatchEnabled,
  applyTechReviewAction,
  SYSTEM_DEFAULTS,
  getSmartMatchGlobalEnabled,
  setSmartMatchGlobalEnabled,
} from "./smartMatch";
import { createEligibleAttendanceFee, createEligibleCancellationFee } from "./appointmentFees";

// ─── Auth ─────────────────────────────────────────────────────────────────────
const authRouter = router({
  me: publicProcedure.query(opts => {
    const user = opts.ctx.user;
    if (!user) return null;
    return {
      ...user,
      isDeactivated: user.deactivatedAt != null,
    };
  }),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  // ── Email + Password Registration ──────────────────────────────────────────
  register: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
      password: z.string().min(8).max(128),
      // Role is intentionally selected in onboarding after account creation.
      userType: z.enum(["client", "nail_tech"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await getUserByEmail(input.email.toLowerCase());
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists. Please sign in.",
        });
      }
      const hash = await bcrypt.hash(input.password, 12);
      // Generate a deterministic openId for email accounts
      const openId = `email_${Buffer.from(input.email.toLowerCase()).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)}`;
      const user = await createEmailUser({
        openId,
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: hash,
        userType: input.userType ?? "client",
      });
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create account" });
      // Issue session cookie
      const sessionToken = await sdk.createSessionToken(openId, { name: input.name, expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true };
    }),

  // ── Email + Password Login ──────────────────────────────────────────────────
  emailLogin: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email.toLowerCase());
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }
      // Update last signed in
      await updateUserProfile(user.id, { lastSignedIn: new Date() });
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return {
        success: true,
        onboardingCompleted: user.onboardingCompleted,
        userType: user.userType,
        activeMode: user.activeMode,
        hasDualRole: user.hasDualRole,
      };
    }),
});

// ─── Users / Profile ──────────────────────────────────────────────────────────
const usersRouter = router({
  getProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const techCapable = isTechCapable(user);
      if (!techCapable && ctx.user?.id !== user.id) {
        if (!ctx.user || !isTechCapable(ctx.user) || !(await hasAppointmentRelationship(ctx.user.id, user.id))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Client profiles are private to their appointment nail techs." });
        }
      }
      const ratingStats = techCapable ? await getTechRatingStats(user.id) : null;
      const followerCount = await getFollowerCount(user.id);
      return {
        user: {
          id: user.id,
          name: user.name,
          userType: user.userType,
          hasDualRole: user.hasDualRole,
          avatarUrl: user.avatarUrl,
          businessName: user.businessName,
          bio: user.bio,
          services: user.services,
          priceRange: user.priceRange,
          instagramHandle: user.instagramHandle,
          yearsExperience: user.yearsExperience,
          location: techCapable
            ? [user.addressCity, user.addressState].filter(Boolean).join(", ") || null
            : null,
          addressCity: techCapable ? user.addressCity : null,
          addressState: techCapable ? user.addressState : null,
          fuzzedLat: techCapable ? user.fuzzedLat : null,
          fuzzedLng: techCapable ? user.fuzzedLng : null,
        },
        ratingStats,
        followerCount,
      };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(2).max(100) }))
    .query(async ({ ctx, input }) => searchMarketplaceUsers(ctx.user.id, input.query)),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        bio: z.string().optional(),
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
        name: z.string().trim().min(2, "Please enter your full name."),
        phone: z.string().trim().refine(
          (value) => value.replace(/\D/g, "").length >= 10,
          "Please enter a valid mobile number."
        ),
        locationPlaceId: z.string().trim().min(1, "Choose a verified location from the suggestions."),
        // client fields
        stylePreferences: z.array(z.string()).optional(),
        colorPreferences: z.array(z.string()).optional(),
        // tech fields
        businessName: z.string().optional(),
        bio: z.string().optional(),
        services: z.array(z.string()).optional(),
        priceRange: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "An email address is required before completing onboarding." });
      }
      const { geocodePlaceId, generateFuzzedCoords, isVerifiedStreetAddress } = await import("./geocoding");
      const geo = await geocodePlaceId(input.locationPlaceId);
      if (!geo) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a verified location from the suggestions." });
      const { locationPlaceId: _locationPlaceId, ...profileInput } = input;
      const now = new Date();
      const locationData = input.userType === "nail_tech"
        ? (() => {
            if (!isVerifiedStreetAddress(geo)) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a complete business street address, including postal code." });
            }
            const { fuzzedLat, fuzzedLng } = generateFuzzedCoords(geo.lat, geo.lng);
            return {
              fullAddress: geo.fullAddress,
              addressLine1: geo.addressLine1,
              addressCity: geo.city,
              addressState: geo.state,
              addressPostalCode: geo.postalCode,
              addressCountry: geo.country,
              addressVerifiedAt: now,
              lat: geo.lat,
              lng: geo.lng,
              fuzzedLat,
              fuzzedLng,
              location: `${geo.city}, ${geo.state}`,
            };
          })()
        : {
            clientCity: geo.city,
            clientState: geo.state,
            clientPostalCode: geo.postalCode || null,
            clientCountry: geo.country,
            clientLat: geo.lat,
            clientLng: geo.lng,
            clientLocationVerifiedAt: now,
            location: `${geo.city}, ${geo.state}`,
          };
      await updateUserProfile(ctx.user.id, { ...profileInput, ...locationData, onboardingCompleted: true } as any);
      if (input.userType === "nail_tech") {
        await getOrCreateSubscription(ctx.user.id);
      }
      return { success: true };
    }),

  /** Geocode and store a tech's full address; returns city+state for confirmation */
  updateTechAddress: protectedProcedure
    .input(z.object({ placeId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!isTechCapable(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const { geocodePlaceId, generateFuzzedCoords, isVerifiedStreetAddress } = await import("./geocoding");
      const geo = await geocodePlaceId(input.placeId);
      if (!geo || !isVerifiedStreetAddress(geo)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a complete business street address, including postal code." });
      const { fuzzedLat, fuzzedLng } = generateFuzzedCoords(geo.lat, geo.lng);
      await updateUserProfile(ctx.user.id, {
        fullAddress: geo.fullAddress,
        addressLine1: geo.addressLine1,
        lat: geo.lat,
        lng: geo.lng,
        addressCity: geo.city,
        addressState: geo.state,
        addressPostalCode: geo.postalCode,
        addressCountry: geo.country,
        addressVerifiedAt: new Date(),
        fuzzedLat,
        fuzzedLng,
        location: `${geo.city}, ${geo.state}`,
      } as any);
      return { city: geo.city, state: geo.state, formattedAddress: geo.fullAddress };
    }),

  updateClientLocation: protectedProcedure
    .input(z.object({ placeId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { geocodePlaceId } = await import("./geocoding");
      const geo = await geocodePlaceId(input.placeId);
      if (!geo) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a verified city from the suggestions." });
      await updateUserProfile(ctx.user.id, {
        clientCity: geo.city,
        clientState: geo.state,
        clientPostalCode: geo.postalCode || null,
        clientCountry: geo.country,
        clientLat: geo.lat,
        clientLng: geo.lng,
        clientLocationVerifiedAt: new Date(),
        location: `${geo.city}, ${geo.state}`,
      } as any);
      return { city: geo.city, state: geo.state, formattedLocation: `${geo.city}, ${geo.state}` };
    }),

  updateClientLocationFromQuery: publicProcedure
    .input(z.object({ query: z.string().trim().min(2).max(160) }))
    .mutation(async ({ ctx, input }) => {
      const { geocodeAddress } = await import("./geocoding");
      const geo = await geocodeAddress(input.query);
      if (!geo) throw new TRPCError({ code: "BAD_REQUEST", message: "We could not verify that city or ZIP code." });
      if (ctx.user) {
        await updateUserProfile(ctx.user.id, {
          clientCity: geo.city,
          clientState: geo.state,
          clientPostalCode: geo.postalCode || null,
          clientCountry: geo.country,
          clientLat: geo.lat,
          clientLng: geo.lng,
          clientLocationVerifiedAt: new Date(),
          location: `${geo.city}, ${geo.state}`,
        } as any);
      }
      return { city: geo.city, state: geo.state, lat: geo.lat, lng: geo.lng };
    }),

  /** Autocomplete address suggestions using Google Places */
  addressSuggestions: protectedProcedure
    .input(z.object({ input: z.string().min(3), kind: z.enum(["city", "address"]).default("address") }))
    .query(async ({ input }) => {
      const { makeRequest } = await import("./_core/map");
      const data = await makeRequest("/maps/api/place/autocomplete/json", {
        input: input.input,
        types: input.kind === "city" ? "(cities)" : "address",
        components: "country:us",
      }) as any;
      if (!data || data.status !== "OK") return [];
      return (data.predictions ?? []).map((p: any) => ({
        placeId: p.place_id,
        description: p.description,
      }));
    }),

  // Returns whether the user needs to accept (or re-accept) legal consents
  getConsentStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user as any;
    const needsConsent = !user.tosAcceptedAt || (user.tosVersion ?? 0) < CURRENT_TOS_VERSION;
    return {
      needsConsent,
      currentVersion: CURRENT_TOS_VERSION,
      userVersion: user.tosVersion ?? 0,
      smsConsent: user.smsConsent ?? false,
    };
  }),

  // Records acceptance of ToS, Privacy Policy, and optional SMS consent
  acceptConsents: protectedProcedure
    .input(z.object({ smsConsent: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      await updateUserProfile(ctx.user.id, {
        tosVersion: CURRENT_TOS_VERSION,
        tosAcceptedAt: now,
        privacyAcceptedAt: now,
        smsConsent: input.smsConsent,
        smsConsentAt: input.smsConsent ? now : undefined,
      } as any);
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
        services: z.array(z.object({
          category: z.string().min(1),
          priceInCents: z.number().int().positive(),
          durationMinutes: z.number().int().min(5).max(360),
        })).min(1, "Add at least one service with its price and duration."),
        priceRange: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { services, ...profile } = input;
      await updateUserProfile(ctx.user.id, {
        ...profile,
        services: services.map((service) => service.category),
        userType: "nail_tech",
        hasDualRole: true,
        activeMode: "nail_tech",
      } as any);
      await Promise.all(services.map((service, sortOrder) => upsertTechService({
        techId: ctx.user.id,
        category: service.category,
        priceInCents: service.priceInCents,
        durationMinutes: service.durationMinutes,
        sortOrder,
      })));
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
        style: z.string().optional(),           // legacy single-style compat
        styles: z.array(z.string()).optional(),  // multi-select styles
        shape: z.string().optional(),
        color: z.string().optional(),            // legacy single color
        colors: z.array(z.string()).optional(),  // multi-select colors
        multiColor: z.boolean().optional(),      // filter for multi-color posts only
        distanceMiles: z.number().optional(),    // defaults to 10mi in db layer
        userLat: z.number().optional(),
        userLng: z.number().optional(),
        soonestAvailable: z.boolean().optional(),
        subscriptionsOnly: z.boolean().optional(),
        nearestFirst: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const styles = input.styles && input.styles.length > 0
        ? input.styles
        : input.style ? [input.style] : undefined;
      const colors = input.colors && input.colors.length > 0
        ? input.colors
        : input.color ? [input.color] : undefined;
      return getDiscoverFeed(input.limit, input.offset, {
        styles,
        shape: input.shape,
        colors,
        multiColor: input.multiColor,
        distanceMiles: input.distanceMiles,
        userLat: input.userLat,
        userLng: input.userLng,
        soonestAvailable: input.soonestAvailable,
        subscriptionsOnly: input.subscriptionsOnly,
        nearestFirst: input.nearestFirst,
      }, ctx.user?.id);
    }),

  techsNearMe: publicProcedure
    .input(z.object({
      userLat: z.number(),
      userLng: z.number(),
      radiusMiles: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return getTechsNearMe(input.userLat, input.userLng, input.radiusMiles ?? 25);
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
        styles: z.array(z.string()).optional(),  // multi-select style tags
        shape: z.string().optional(),
        color: z.string().optional(),
        colors: z.array(z.string()).optional(),  // multi-select colors
        location: z.string().optional(),
        serviceId: z.number().int().positive(),  // required: every post links to a service
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      // Serialize arrays as JSON strings for storage
      const styleJson = input.styles && input.styles.length > 0
        ? JSON.stringify(input.styles)
        : input.style ?? null;
      const colorsJson = input.colors && input.colors.length > 0
        ? JSON.stringify(input.colors)
        : input.color ? JSON.stringify([input.color]) : null;
      const postId = await createPost({
        ...input,
        style: styleJson,
        colors: colorsJson,
        techId: ctx.user.id,
      } as any);
      const techName = ctx.user.businessName || ctx.user.name || "Your nail tech";
      notifyTechFollowers(ctx.user.id, postId, techName).catch(() => {});
      return { postId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        caption: z.string().optional(),
        style: z.string().optional(),
        styles: z.array(z.string()).optional(),
        shape: z.string().optional(),
        color: z.string().optional(),
        colors: z.array(z.string()).optional(),
        location: z.string().optional(),
        status: z.enum(["published", "draft", "hidden"]).optional(),
        serviceId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { postId, styles, colors, ...rest } = input;
      const styleJson = styles && styles.length > 0 ? JSON.stringify(styles) : rest.style;
      const colorsJson = colors && colors.length > 0 ? JSON.stringify(colors) : rest.color ? JSON.stringify([rest.color]) : undefined;
      await updatePost(postId, ctx.user.id, { ...rest, style: styleJson, colors: colorsJson } as any);
      return { success: true };
    }),

  /** Soft-hide: hides from public feed, recoverable via restore. */
  hide: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deletePost(input.postId, ctx.user.id);
      return { success: true };
    }),

  /** Hard delete: permanently removes the post. Cannot be undone. */
  deletePermanently: protectedProcedure
    .input(z.object({ postId: z.number(), confirm: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      await hardDeletePost(input.postId, ctx.user.id);
      return { success: true };
    }),

  /** Restore a hidden post back to published. */
  restore: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await restorePost(input.postId, ctx.user.id);
      return { success: true };
    }),

  /** @deprecated use hide instead */
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

  /** Save a post (idempotent — always ends up saved) */
  save: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => savePost(ctx.user.id, input.postId)),

  /** Unsave a post and remove all album memberships */
  unsave: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => unsavePost(ctx.user.id, input.postId)),

  /** Get save state + album membership for a single post */
  saveState: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ ctx, input }) => getPostSaveState(ctx.user.id, input.postId)),

  /** Replace album memberships for a post (must already be saved) */
  setAlbumMemberships: protectedProcedure
    .input(z.object({ postId: z.number(), collectionIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      await setAlbumMemberships(ctx.user.id, input.postId, input.collectionIds);
      return { success: true };
    }),

  userLikes: protectedProcedure
    .input(z.object({ postIds: z.array(z.number()) }))
    .query(async ({ ctx, input }) => getUserLikes(ctx.user.id, input.postIds)),

  uploadImage: protectedProcedure
    .input(z.object({
      base64: z.string().min(1).max(9_000_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      filename: z.string().max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      if (!buffer.length || buffer.length > 6 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Post images must be 6 MB or smaller." });
      }
      const extension = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
      const key = `posts/${ctx.user.id}/${Date.now()}.${extension}`;
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
  /** All custom albums with post count + cover image for the Saved tab grid */
  listWithMeta: protectedProcedure.query(async ({ ctx }) => getCollectionsWithMeta(ctx.user.id)),

  /** Legacy list — kept for any existing callers */
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

  /** Posts in a specific album (collectionId=null means All Saved) */
  postsInAlbum: protectedProcedure
    .input(z.object({ collectionId: z.number().nullable() }))
    .query(async ({ ctx, input }) => getSavedPostsForAlbum(ctx.user.id, input.collectionId)),

  /** Batch saved post IDs for feed icon state */
  savedPostIds: protectedProcedure.query(async ({ ctx }) => getSavedPostIds(ctx.user.id)),

  /** Legacy savedPosts — kept for any remaining callers */
  savedPosts: protectedProcedure.query(async ({ ctx }) => getSavedPostsForAlbum(ctx.user.id, null)),
});

// ─── Bookings ─────────────────────────────────────────────────────────────────
const bookingsRouter = router({
  availableSlots: publicProcedure
    .input(
      z.object({
        techId: z.number(),
        date: z.string(), // "YYYY-MM-DD"
        duration: z.number().default(60),
        serviceIds: z.array(z.number().int().positive()).max(100).optional(),
      })
    )
    .query(async ({ ctx, input }) =>
      getAvailableSlots(input.techId, input.date, input.duration, ctx.user?.id, input.serviceIds ?? [])
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
        serviceIds: z.array(z.number().int().positive()).max(100).optional(),
      })
    )
    .query(async ({ input }) =>
      getMonthBookableStatus(input.techId, input.year, input.month, input.duration, input.serviceIds ?? [])
    ),

  createWithServiceLines: protectedProcedure
    .input(z.object({
      techId: z.number(),
      postId: z.number().optional(),
      inspirationImageUrl: z.string().max(2000).refine((value) => isValidInspirationImageReference(value), {
        message: "Use a secure image URL or a Valisse storage image path.",
      }).optional(),
      scheduledAt: z.number(),
      notes: z.string().max(2000).optional(),
      setupIntentId: z.string().min(1, "Save a payment method before requesting this booking."),
      feePolicyAcknowledgementVersion: z.string().max(1024).optional(),
      serviceLines: z.array(z.object({
        techServiceId: z.number(),
        lineType: z.enum(["primary", "addon", "upgrade"]),
      })).min(1),
      smartServiceMatches: z.array(z.object({
        serviceCategory: z.string(),
        answers: z.record(z.string(), z.string()),
        outcome: z.enum(["match", "recommendation", "review"]),
        recommendedService: z.string().nullable(),
        recommendedAddOns: z.array(z.string()).max(5),
        explanation: z.string().max(1000),
        photoUrls: z.array(z.string()).max(5),
      })).max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (await hasOutstandingAppointmentPayment(ctx.user.id)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Resolve your outstanding appointment payment before creating another booking request." });
      }
      const stripeMode = getConfiguredStripeModeOrThrow();
      if (!ctx.user.stripeCustomerId || !isStripeObjectInConfiguredEnvironment(ctx.user.stripeCustomerMode, stripeMode)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Save a payment method for the active Stripe environment before requesting this booking." });
      }
      try {
        await verifyBookingCardSetupIntent({
          setupIntentId: input.setupIntentId,
          customerId: ctx.user.stripeCustomerId,
          clientId: ctx.user.id,
          mode: stripeMode,
        });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Your card could not be verified for this booking." });
      }
      const offeredServices = await getTechServices(input.techId);
      const serviceIds = new Set(input.serviceLines.map((line) => line.techServiceId));
      if (serviceIds.size !== input.serviceLines.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Each service can only be added once." });
      }
      const lines = input.serviceLines.map((requestedLine, position) => {
        const service = offeredServices.find((candidate) => candidate.id === requestedLine.techServiceId);
        if (!service) throw new TRPCError({ code: "BAD_REQUEST", message: "One of the selected services is no longer offered by this nail tech." });
        return {
          techServiceId: service.id,
          serviceName: service.customName || service.category,
          lineType: requestedLine.lineType,
          priceInCents: service.priceInCents,
          durationMinutes: service.durationMinutes,
          position,
        } as const;
      });
      const primary = lines.find((line) => line.lineType === "primary");
      if (!primary) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose one primary service for this booking." });
      const totalDuration = lines.reduce((sum, line) => sum + line.durationMinutes, 0);
      const feePolicy = await getAppointmentFeePolicy(input.techId);
      const hasActiveFeeRules = feePolicy.rules.some((rule) => rule.enabled);
      if (hasActiveFeeRules && input.feePolicyAcknowledgementVersion !== feePolicy.version) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Review and acknowledge the current appointment fee policy before requesting this booking." });
      }
      const bookingId = await createBookingWithConflictCheck({
        clientId: ctx.user.id,
        techId: input.techId,
        postId: input.postId ?? null,
        inspirationImageUrl: input.inspirationImageUrl ?? null,
        serviceType: primary.serviceName,
        scheduledAt: new Date(input.scheduledAt),
        duration: totalDuration,
        notes: input.notes ?? null,
      } as any, lines.map((line) => line.techServiceId));
      await setBookingPaymentMethodState(bookingId, { stripeSetupIntentId: input.setupIntentId, paymentMethodStatus: "saved" });
      await replaceBookingServiceLines(bookingId, lines);
      // Even an all-disabled policy is frozen so a later settings change cannot
      // add fees to an appointment the client already requested.
      await setBookingFeePolicyAcknowledgement(bookingId, feePolicy);
      if (input.smartServiceMatches?.length) {
        await Promise.all(input.smartServiceMatches.map((assessment) => saveBookingMatchAssessment({ bookingId, ...assessment })));
      }
      await createNotification({
        userId: input.techId,
        type: "new_booking",
        title: "New Booking Request",
        body: `${ctx.user.name ?? "A client"} requested a booking`,
        relatedId: bookingId,
      });
      return { bookingId };
    }),

  myBookings: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.userType === "nail_tech") return getTechBookings(ctx.user.id);
    return getClientBookings(ctx.user.id);
  }),

  allBookings: protectedProcedure.query(async ({ ctx }) => getAllUserBookings(ctx.user.id)),

  clientBookings: protectedProcedure.query(async ({ ctx }) => getClientBookings(ctx.user.id)),
  techBookings: protectedProcedure.query(async ({ ctx }) => getTechBookings(ctx.user.id)),
  todayBookings: protectedProcedure.query(async ({ ctx }) => getTodayBookings(ctx.user.id)),
  timeline: protectedProcedure.query(async ({ ctx }) => getTechBookingsTimeline(ctx.user.id)),
  pastBookings: protectedProcedure.query(async ({ ctx }) => getTechPastBookings(ctx.user.id)),

  updateStatus: protectedProcedure
    .input(
      z.object({
        bookingId: z.number(),
        status: z.enum(["confirmed", "declined"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.techId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the assigned nail tech can update this booking request." });
      }
      if (booking.revisionStatus === "pending" && input.status === "confirmed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Wait for the client to accept the revised quote before confirming this booking." });
      }
      if (input.status === "confirmed" && booking.paymentMethodStatus !== "saved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The client must save a payment method before this booking can be confirmed." });
      }
      await updateBookingStatus(input.bookingId, input.status, ctx.user.id);
      if (input.status === "confirmed") {
        const code = deriveAppointmentCode(booking.id, booking.scheduledAt, ENV.cookieSecret);
        await setBookingAppointmentCode(
          booking.id,
          hashAppointmentCode(booking.id, code, ENV.cookieSecret),
          appointmentCodeVisibleAt(booking.scheduledAt)
        );
      }
      if (!booking.isQaTest) {
        await createNotification({
          userId: booking.clientId,
          type: input.status === "confirmed" ? "booking_confirmed" : "booking_declined",
          title: input.status === "confirmed" ? "Booking confirmed" : "Booking declined",
          body: input.status === "confirmed"
            ? "Your nail tech confirmed this appointment."
            : "Your nail tech was unable to accept this appointment.",
          relatedId: booking.id,
        });
      }
      return { success: true };
    }),
});

// ─── Preview-only QA Appointment Lab ─────────────────────────────────────────

function isQaLabEnabled() {
  return isQaAppointmentLabEnabled({
    isProduction: ENV.isProduction,
    stripeTestSecretKey: ENV.stripeTestSecretKey,
  });
}

function assertQaLabAdministrator(user: { id: number; role: string }) {
  if (!isQaLabEnabled()) {
    throw new TRPCError({ code: "NOT_FOUND", message: "The QA Appointment Lab is available only in preview with Stripe test mode." });
  }
  if (user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only a Valisse administrator can manage QA appointment runs." });
  }
}

async function issueQaSessionForUser(params: {
  openId: string;
  name: string | null;
  ctx: { req: any; res: any };
}) {
  const sessionToken = await sdk.createSessionToken(params.openId, {
    name: params.name ?? "QA test user",
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(params.ctx.req);
  params.ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

const qaAppointmentRouter = router({
  availability: protectedProcedure.query(({ ctx }) => ({
    enabled: ctx.user.role === "admin" && isQaLabEnabled(),
  })),

  current: protectedProcedure.query(async ({ ctx }) => {
    if (!isQaLabEnabled()) return { enabled: false, canManage: false, run: null, booking: null };

    const isAdmin = ctx.user.role === "admin";
    const run = isAdmin
      ? await getActiveQaAppointmentRunForAdmin(ctx.user.id)
      : await getQaAppointmentRunForParticipant(ctx.user.id);
    if (!run) return { enabled: isAdmin, canManage: isAdmin, run: null, booking: null };
    const booking = await getBookingById(run.bookingId);
    if (!booking?.isQaTest) return { enabled: isAdmin, canManage: isAdmin, run: null, booking: null };
    return {
      enabled: true,
      canManage: isAdmin && run.adminId === ctx.user.id,
      run: { id: run.id, clientId: run.clientId, techId: run.techId, bookingId: run.bookingId, expiresAt: run.expiresAt },
      booking,
      testPayout: isAdmin && run.adminId === ctx.user.id
        ? { connected: Boolean(ctx.user.stripeTestConnectedAccountId), ready: ctx.user.stripeTestConnectedAccountReady }
        : null,
    };
  }),

  start: protectedProcedure.mutation(async ({ ctx }) => {
    assertQaLabAdministrator(ctx.user);
    const existing = await getActiveQaAppointmentRunForAdmin(ctx.user.id);
    if (existing) return { runId: existing.id, bookingId: existing.bookingId, reused: true };

    const services = await getTechServices(ctx.user.id);
    const primaryService = services[0];
    if (!primaryService) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add at least one active technician service before starting a QA appointment." });
    }

    const client = await createQaTestClient();
    const scheduledAt = createQaScheduledAt();
    const bookingId = await createBooking({
      clientId: client.id,
      techId: ctx.user.id,
      serviceType: QA_APPOINTMENT_LABEL,
      scheduledAt,
      duration: QA_APPOINTMENT_DURATION_MINUTES,
      status: "pending",
      paymentMethodStatus: "none",
      paymentStatus: "unpaid",
      payoutStatus: "not_ready",
      notes: "Preview-only QA test. No customer messaging is sent.",
      isQaTest: true,
    });
    await replaceBookingServiceLines(bookingId, [{
      techServiceId: primaryService.id,
      serviceName: primaryService.customName || primaryService.category,
      lineType: "primary",
      priceInCents: primaryService.priceInCents,
      durationMinutes: QA_APPOINTMENT_DURATION_MINUTES,
      position: 0,
    }]);
    const runId = await createQaAppointmentRun({
      adminId: ctx.user.id,
      clientId: client.id,
      techId: ctx.user.id,
      bookingId,
      expiresAt: createQaRunExpiry(),
    });
    return { runId, bookingId, reused: false };
  }),

  enterClient: protectedProcedure
    .input(z.object({ runId: z.number().int().positive(), view: z.enum(["payment", "bookings"]) }))
    .mutation(async ({ ctx, input }) => {
      assertQaLabAdministrator(ctx.user);
      const run = await getQaAppointmentRunById(input.runId);
      if (!run || run.adminId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      const client = await getUserById(run.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "The QA client could not be found." });
      await issueQaSessionForUser({ openId: client.openId, name: client.name, ctx });
      return { destination: input.view === "payment" ? "/qa/appointment-payment" : `/bookings?qaRun=${run.id}` };
    }),

  returnToAdmin: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isQaLabEnabled()) throw new TRPCError({ code: "NOT_FOUND" });
    const run = await getQaAppointmentRunForParticipant(ctx.user.id);
    if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "No active QA appointment run is associated with this account." });
    const administrator = await getUserById(run.adminId);
    if (!administrator || administrator.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    await issueQaSessionForUser({ openId: administrator.openId, name: administrator.name, ctx });
    return { destination: "/admin/qa-appointments" };
  }),

  prepareTestPayout: protectedProcedure
    .input(z.object({ runId: z.number().int().positive(), origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      assertQaLabAdministrator(ctx.user);
      const run = await getQaAppointmentRunById(input.runId);
      if (!run || run.adminId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      const requestedOrigin = new URL(input.origin).origin;
      const browserOrigin = typeof ctx.req.headers.origin === "string" ? ctx.req.headers.origin : null;
      if (browserOrigin && requestedOrigin !== browserOrigin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Stripe test onboarding must return to the Valisse preview session that started it." });
      }
      let accountId = ctx.user.stripeTestConnectedAccountId;
      if (!accountId) {
        const account = await createRecipientConnectedAccount({
          techId: ctx.user.id,
          email: ctx.user.email,
          displayName: ctx.user.businessName || ctx.user.name,
          mode: "test",
        });
        accountId = account.id;
        await updateUserStripeReferences(ctx.user.id, { stripeTestConnectedAccountId: accountId, stripeTestConnectedAccountReady: false });
      }
      const readiness = await getConnectedAccountReadiness(accountId, "test");
      await updateUserStripeReferences(ctx.user.id, { stripeTestConnectedAccountReady: readiness.ready });
      if (readiness.ready) return { ready: true, onboardingUrl: null };
      const link = await createRecipientOnboardingLink({
        accountId,
        refreshUrl: `${requestedOrigin}/admin/qa-appointments`,
        returnUrl: `${requestedOrigin}/admin/qa-appointments`,
        mode: "test",
      });
      return { ready: false, onboardingUrl: link.url };
    }),

  releasePayoutNow: protectedProcedure
    .input(z.object({ runId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertQaLabAdministrator(ctx.user);
      const run = await getQaAppointmentRunById(input.runId);
      if (!run || run.adminId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      const booking = await getBookingById(run.bookingId);
      if (!booking?.isQaTest) throw new TRPCError({ code: "NOT_FOUND" });
      if (booking.paymentStatus !== "paid" || booking.payoutStatus !== "pending_dispute_window" || !booking.stripePaymentIntentId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Complete and successfully charge this QA appointment before releasing its test payout." });
      }
      const tech = await getUserById(run.techId);
      if (!tech?.stripeTestConnectedAccountId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Set up the technician's Stripe test payout account before releasing a QA payout." });
      const readiness = await getConnectedAccountReadiness(tech.stripeTestConnectedAccountId, "test");
      await updateUserStripeReferences(tech.id, { stripeTestConnectedAccountReady: readiness.ready });
      if (!readiness.ready) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The technician's Stripe test payout account is not ready yet. Complete sandbox onboarding and try again." });
      const serviceTotalInCents = await getBookingServiceTotalInCents(booking.id);
      const transfer = await releaseBookingPayout({
        bookingId: booking.id,
        techAccountId: tech.stripeTestConnectedAccountId,
        servicePaymentIntentId: booking.stripePaymentIntentId,
        serviceTotalInCents,
        tipPaymentIntentId: booking.stripeTipPaymentIntentId,
        mode: "test",
      });
      await markBookingPayoutResult(booking.id, "released", transfer.id);
      return { success: true };
    }),

  cleanup: protectedProcedure
    .input(z.object({ runId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertQaLabAdministrator(ctx.user);
      const deleted = await deleteQaAppointmentRunForAdmin(input.runId, ctx.user.id);
      return { deleted };
    }),
});

// ─── Verified appointment and deferred-payment lifecycle ──────────────────────
function getConfiguredStripeModeOrThrow(): "test" | "live" {
  const integration = getStripeIntegrationStatus();
  if (integration.mode !== "test" && integration.mode !== "live") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe is not configured with a valid test or live secret key." });
  }
  return integration.mode;
}
function getBookingStripeModeOrThrow(booking: { isQaTest: boolean }): StripePaymentMode {
  try {
    return resolveStripeModeForBooking({
      isQaTest: booking.isQaTest,
      configuredMode: getStripeIntegrationStatus().mode,
      testSecretKey: ENV.stripeTestSecretKey,
      isProduction: ENV.isProduction,
    });
  } catch (error) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: error instanceof Error ? error.message : "Stripe payment mode could not be selected for this booking.",
    });
  }
}
const appointmentRouter = router({
  prepareNewBookingCard: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Add an email address before saving a payment method." });
      const stripeMode = getConfiguredStripeModeOrThrow();
      let customerId = ctx.user.stripeCustomerId;
      if (!customerId || !isStripeObjectInConfiguredEnvironment(ctx.user.stripeCustomerMode, stripeMode)) {
        const customer = await createStripeCustomer({ userId: ctx.user.id, name: ctx.user.name, email: ctx.user.email, mode: stripeMode });
        customerId = customer.id;
        await updateUserStripeReferences(ctx.user.id, { stripeCustomerId: customerId, stripeCustomerMode: stripeMode });
      }
      const setupIntent = await createBookingCardSetupIntent({ clientId: ctx.user.id, customerId, mode: stripeMode });
      if (!setupIntent.client_secret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe could not prepare secure card verification. Please try again." });
      return { clientSecret: setupIntent.client_secret, stripeMode };
    }),

  paymentSetup: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.clientId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (!ctx.user.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Add an email address before saving a payment method." });

      const stripeMode = getBookingStripeModeOrThrow(booking);
      let customerId = ctx.user.stripeCustomerId;
      if (!customerId || !isStripeObjectInConfiguredEnvironment(ctx.user.stripeCustomerMode, stripeMode)) {
        const customer = await createStripeCustomer({ userId: ctx.user.id, name: ctx.user.name, email: ctx.user.email, mode: stripeMode });
        customerId = customer.id;
        await updateUserStripeReferences(ctx.user.id, { stripeCustomerId: customerId, stripeCustomerMode: stripeMode });
      }
      const setupIntent = await createBookingSetupIntent({ bookingId: booking.id, customerId, mode: stripeMode });
      await setBookingPaymentMethodState(booking.id, { stripeSetupIntentId: setupIntent.id, paymentMethodStatus: "required" });
      return { clientSecret: setupIntent.client_secret, stripeMode };
    }),

  paymentSetupComplete: protectedProcedure
    .input(z.object({ bookingId: z.number(), setupIntentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.clientId !== ctx.user.id || booking.stripeSetupIntentId !== input.setupIntentId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const stripeMode = getBookingStripeModeOrThrow(booking);
      if (!ctx.user.stripeCustomerId || !isStripeObjectInConfiguredEnvironment(ctx.user.stripeCustomerMode, stripeMode)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Stripe environment changed. Save your payment method again before continuing." });
      }
      try {
        await verifyBookingSetupIntent({ setupIntentId: input.setupIntentId, customerId: ctx.user.stripeCustomerId, bookingId: booking.id, mode: stripeMode });
      } catch (error) {
        await setBookingPaymentMethodState(booking.id, { stripeSetupIntentId: input.setupIntentId, paymentMethodStatus: "failed" });
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Payment method setup failed." });
      }
      await setBookingPaymentMethodState(booking.id, { stripeSetupIntentId: input.setupIntentId, paymentMethodStatus: "saved" });
      if (booking.status === "payment_due") {
        try {
          const totalInCents = await getBookingServiceTotalInCents(booking.id);
          const payment = await chargeSavedCard({ bookingId: booking.id, customerId: ctx.user.stripeCustomerId, amountInCents: totalInCents, kind: "service_completion", mode: stripeMode });
          if (payment.status !== "succeeded") throw new Error("Payment requires additional action.");
          const capturedAt = new Date();
          await markBookingPaymentResult(booking.id, {
            stripePaymentIntentId: payment.id,
            paymentStatus: "paid",
            paymentCapturedAt: capturedAt,
            status: "completed",
            payoutStatus: "pending_dispute_window",
          });
          await markAppointmentCompleted(booking.id, booking.completedAt ?? capturedAt, payoutEligibleAt(capturedAt));
        } catch {
          await markBookingPaymentResult(booking.id, { paymentStatus: "payment_due", status: "payment_due", payoutStatus: "not_ready" });
          throw new TRPCError({ code: "BAD_REQUEST", message: "The payment method was saved, but the appointment balance could not be collected. Please use a different card." });
        }
      }
      return { success: true };
    }),

  clientCode: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.clientId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (booking.status !== "confirmed" || !booking.appointmentCodeVisibleAt || booking.appointmentCodeVisibleAt > new Date()) {
        return { available: false, code: null };
      }
      return { available: true, code: deriveAppointmentCode(booking.id, booking.scheduledAt, ENV.cookieSecret) };
    }),

  start: protectedProcedure
    .input(z.object({ bookingId: z.number(), code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.techId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (booking.status !== "confirmed") throw new TRPCError({ code: "BAD_REQUEST", message: "Only confirmed appointments can be started." });
      if (!booking.appointmentCodeVisibleAt || booking.appointmentCodeVisibleAt > new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The appointment code is not available yet." });
      }
      if (!canStartVerifiedAppointment(booking.scheduledAt)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can verify the client code up to 30 minutes before the appointment starts." });
      }
      if (booking.appointmentCodeLockedUntil && booking.appointmentCodeLockedUntil > new Date()) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many incorrect code attempts. Try again shortly." });
      }
      if (!isValidAppointmentCodeInput(input.code)) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the six-digit appointment code." });
      const receivedHash = hashAppointmentCode(booking.id, input.code, ENV.cookieSecret);
      if (!booking.appointmentCodeHash || receivedHash !== booking.appointmentCodeHash) {
        const failures = booking.appointmentCodeFailures + 1;
        const lockedUntil = failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        await recordAppointmentCodeFailure(booking.id, failures, lockedUntil);
        throw new TRPCError({ code: "BAD_REQUEST", message: lockedUntil ? "Too many incorrect attempts. Try again in 15 minutes." : "That appointment code does not match." });
      }
      const arrivedAt = new Date();
      await markBookingArrivedAndVoidPendingFees(booking.id, arrivedAt);
      // This only creates an eligible, client-notified case after the verified
      // arrival timestamp is stored. It never charges; the tech makes a
      // separate deliberate confirm-or-waive decision.
      const arrivedBooking = await getBookingById(booking.id);
      if (arrivedBooking) await createEligibleAttendanceFee({ booking: arrivedBooking, feeType: "late_arrival", now: arrivedAt });
      if (!booking.isQaTest) {
        await createNotification({ userId: booking.clientId, type: "appointment_started", title: "Appointment started", body: "Your nail appointment is now in progress.", relatedId: booking.id });
        void sendValisseTransactionalSms({ userId: booking.clientId, category: "appointment_started", text: "Valisse: your nail appointment is now in progress. Reply STOP to opt out." }).catch((error) => console.warn("[Telnyx] Appointment-start SMS failed", error));
      }
      return { success: true };
    }),

  complete: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.techId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (booking.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "Start the verified appointment before completing it." });
      const client = await getUserById(booking.clientId);
      const stripeMode = getBookingStripeModeOrThrow(booking);
      if (!client?.stripeCustomerId || !isStripeObjectInConfiguredEnvironment(client.stripeCustomerMode, stripeMode) || booking.paymentMethodStatus !== "saved") {
        await markBookingPaymentResult(booking.id, { paymentStatus: "payment_due", status: "payment_due", payoutStatus: "not_ready" });
        throw new TRPCError({ code: "BAD_REQUEST", message: "The client has no verified payment method for the active Stripe environment. Payment is now due." });
      }
      const completedAt = new Date();
      const eligibleAt = payoutEligibleAt(completedAt);
      await markAppointmentCompleted(booking.id, completedAt, eligibleAt);
      const totalInCents = await getBookingServiceTotalInCents(booking.id);
      try {
        const payment = await chargeSavedCard({ bookingId: booking.id, customerId: client.stripeCustomerId, amountInCents: totalInCents, kind: "service_completion", mode: stripeMode });
        if (payment.status !== "succeeded") throw new Error("The service charge requires client action.");
        await markBookingPaymentResult(booking.id, { stripePaymentIntentId: payment.id, paymentStatus: "paid", paymentCapturedAt: completedAt, status: "completed", payoutStatus: "pending_dispute_window" });
        if (!booking.isQaTest) {
          await createNotification({ userId: booking.clientId, type: "booking_payment_captured", title: "Appointment complete", body: "Your service payment was processed. You can add an optional tip or report an issue within 24 hours.", relatedId: booking.id });
          await createNotification({ userId: booking.techId, type: "payout_pending", title: "Payout pending", body: "Your appointment payment is captured. Payout releases after the 24-hour issue window.", relatedId: booking.id });
          void sendValisseTransactionalSms({ userId: booking.clientId, category: "appointment_complete", text: "Valisse: your appointment is complete and your approved service payment was processed. You can add a tip or report an issue in the app within 24 hours. Reply STOP to opt out." }).catch((error) => console.warn("[Telnyx] Completion SMS failed", error));
        }
        return { success: true, paymentDue: false };
      } catch (error) {
        await markBookingPaymentResult(booking.id, { paymentStatus: "payment_due", status: "payment_due", payoutStatus: "not_ready" });
        if (!booking.isQaTest) {
          await createNotification({ userId: booking.clientId, type: "payment_due", title: "Payment needed", body: "Your appointment is complete. Please update your payment method to settle the booking.", relatedId: booking.id });
          void sendValisseTransactionalSms({ userId: booking.clientId, category: "payment_due", text: "Valisse: payment is needed for your completed appointment. Update your payment method in the app to settle the balance. Reply STOP to opt out." }).catch((error) => console.warn("[Telnyx] Payment-due SMS failed", error));
        }
        return { success: true, paymentDue: true };
      }
    }),

  reportIssue: protectedProcedure
    .input(z.object({ bookingId: z.number(), reason: z.string().trim().min(10).max(1500) }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.clientId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (booking.paymentStatus !== "paid" || booking.payoutStatus !== "pending_dispute_window") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This booking is not currently eligible for an issue report." });
      }
      await reportBookingIssue(booking.id, input.reason, new Date());
      if (!booking.isQaTest) {
        await createNotification({ userId: booking.techId, type: "booking_issue_reported", title: "Client reported an issue", body: "Payout is paused while the issue is reviewed.", relatedId: booking.id });
        void sendValisseTransactionalSms({ userId: booking.techId, category: "booking_issue", text: "Valisse: a client reported an issue with a completed appointment. Your payout is paused while it is reviewed. Reply STOP to opt out." }).catch((error) => console.warn("[Telnyx] Issue-report SMS failed", error));
        for (const adminId of await getAdminUserIds()) {
          await createNotification({ userId: adminId, type: "booking_issue_reported", title: "Booking issue reported", body: "A client reported an issue and the payout is on hold.", relatedId: booking.id });
        }
      }
      return { success: true };
    }),

  tipSummary: protectedProcedure
    .input(z.object({ bookingId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.clientId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const serviceTotalInCents = await getBookingServiceTotalInCents(booking.id);
      return {
        serviceTotalInCents,
        standardOptions: getStandardTipOptions(serviceTotalInCents).filter((option) => option.amountInCents >= 50),
        tipStatus: booking.tipStatus,
        tipAmountInCents: booking.tipAmountInCents,
        canChooseTip: booking.paymentStatus === "paid" && booking.payoutStatus === "pending_dispute_window" && !isTipFinal(booking.tipStatus),
      };
    }),

  createTip: protectedProcedure
    .input(z.object({ bookingId: z.number(), amountInCents: z.number().int().min(50).max(100_000) }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.clientId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (booking.paymentStatus !== "paid" || booking.payoutStatus !== "pending_dispute_window") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tips can be added only after a paid, completed appointment during the issue window." });
      }
      if (isTipFinal(booking.tipStatus)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A final tip choice has already been recorded for this appointment." });
      }
      const stripeMode = getBookingStripeModeOrThrow(booking);
      if (!ctx.user.stripeCustomerId || !isStripeObjectInConfiguredEnvironment(ctx.user.stripeCustomerMode, stripeMode)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe customer is available for the active payment environment." });
      }
      const intent = await createTipPaymentIntent({ bookingId: booking.id, customerId: ctx.user.stripeCustomerId, amountInCents: input.amountInCents, mode: stripeMode });
      return { clientSecret: intent.client_secret, paymentIntentId: intent.id, amountInCents: input.amountInCents, stripeMode };
    }),

  tipComplete: protectedProcedure
    .input(z.object({ bookingId: z.number(), paymentIntentId: z.string().min(1), amountInCents: z.number().int().min(50).max(100_000) }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.clientId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (booking.paymentStatus !== "paid" || booking.payoutStatus !== "pending_dispute_window" || isTipFinal(booking.tipStatus)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment is no longer eligible for a tip." });
      }
      const stripeMode = getBookingStripeModeOrThrow(booking);
      if (!ctx.user.stripeCustomerId || !isStripeObjectInConfiguredEnvironment(ctx.user.stripeCustomerMode, stripeMode)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe customer is available for the active payment environment." });
      }
      try {
        await verifyTipPaymentIntent({
          paymentIntentId: input.paymentIntentId,
          bookingId: booking.id,
          customerId: ctx.user.stripeCustomerId,
          amountInCents: input.amountInCents,
          mode: stripeMode,
        });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The tip payment could not be verified." });
      }
      await setBookingTipPaymentIntent(booking.id, { stripeTipPaymentIntentId: input.paymentIntentId, amountInCents: input.amountInCents });
      if (!booking.isQaTest) {
        await createNotification({ userId: booking.techId, type: "tip_received", title: "A client added a tip", body: "The tip will be included with your payout after the issue window.", relatedId: booking.id });
      }
      return { success: true };
    }),

  declineTip: protectedProcedure
    .input(z.object({ bookingId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.clientId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (booking.paymentStatus !== "paid" || booking.payoutStatus !== "pending_dispute_window" || isTipFinal(booking.tipStatus)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment is no longer eligible for a tip choice." });
      }
      await declineBookingTip(booking.id);
      return { success: true };
    }),

  disputedBookings: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const disputed = await getDisputedBookingsForAdmin();
    return Promise.all(disputed.map(async (booking) => ({
      ...booking,
      serviceTotalInCents: await getBookingServiceTotalInCents(booking.id),
    })));
  }),

  resolveIssue: protectedProcedure
    .input(z.object({
      bookingId: z.number().int().positive(),
      action: z.enum(["release_payout", "refund_client"]),
      refundAmountInCents: z.number().int().positive().optional(),
      refundTip: z.boolean().default(false),
      resolutionNote: z.string().trim().min(10).max(1500),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.status !== "disputed" || booking.payoutStatus !== "on_hold" || booking.paymentStatus !== "paid" || !booking.stripePaymentIntentId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only a paid appointment with an active payout hold can be resolved." });
      }
      const serviceTotalInCents = await getBookingServiceTotalInCents(booking.id);
      let resolution: ReturnType<typeof getIssueResolutionAmounts>;
      try {
        resolution = getIssueResolutionAmounts({
          serviceTotalInCents,
          action: input.action,
          refundAmountInCents: input.refundAmountInCents,
        });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The issue resolution details are invalid." });
      }

      if (input.action === "release_payout") {
        const tech = await getUserById(booking.techId);
        const stripeMode = getBookingStripeModeOrThrow(booking);
        const payoutAccountId = booking.isQaTest ? tech?.stripeTestConnectedAccountId : tech?.stripeConnectedAccountId;
        const payoutReady = booking.isQaTest ? tech?.stripeTestConnectedAccountReady : tech?.stripeConnectedAccountReady;
        if (!tech || !payoutAccountId || !payoutReady || (!booking.isQaTest && !isStripeObjectInConfiguredEnvironment(tech.stripeConnectedAccountMode, stripeMode))) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The nail tech must complete Stripe payout onboarding before this held payout can be released." });
        }
        const currentReadiness = await getConnectedAccountReadiness(payoutAccountId, stripeMode);
        await updateUserStripeReferences(tech.id, booking.isQaTest
          ? { stripeTestConnectedAccountReady: currentReadiness.ready }
          : { stripeConnectedAccountReady: currentReadiness.ready, stripeConnectedAccountMode: stripeMode });
        if (!currentReadiness.ready) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The nail tech’s Stripe payout capability is no longer active. Ask them to complete Stripe onboarding again." });
        }
        const transfer = await releaseBookingPayout({
          bookingId: booking.id,
          techAccountId: payoutAccountId,
          servicePaymentIntentId: booking.stripePaymentIntentId,
          serviceTotalInCents,
          tipPaymentIntentId: booking.tipStatus === "paid" ? booking.stripeTipPaymentIntentId : null,
          mode: stripeMode,
        });
        await resolveBookingIssue({
          bookingId: booking.id,
          adminId: ctx.user.id,
          resolution: "payout_released",
          resolutionNote: input.resolutionNote,
          refundAmountInCents: 0,
          paymentStatus: "paid",
          payoutStatus: "released",
          stripeTransferId: transfer.id,
        });
        if (!booking.isQaTest) await createNotification({ userId: booking.techId, type: "payout_released", title: "Payout released after review", body: "An administrator resolved the client issue and released your appointment payout.", relatedId: booking.id });
        return { success: true, resolution: "payout_released" as const };
      }

      const payoutTech = resolution.payoutableServiceTotalInCents > 0 ? await getUserById(booking.techId) : null;
      const stripeMode = getBookingStripeModeOrThrow(booking);
      const payoutAccountId = booking.isQaTest ? payoutTech?.stripeTestConnectedAccountId : payoutTech?.stripeConnectedAccountId;
      const payoutReady = booking.isQaTest ? payoutTech?.stripeTestConnectedAccountReady : payoutTech?.stripeConnectedAccountReady;
      if (resolution.payoutableServiceTotalInCents > 0 && (!payoutTech || !payoutAccountId || !payoutReady || (!booking.isQaTest && !isStripeObjectInConfiguredEnvironment(payoutTech.stripeConnectedAccountMode, stripeMode)))) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The nail tech must complete Stripe payout onboarding before you can issue a partial refund and release the remaining payout." });
      }
      if (payoutTech && payoutAccountId) {
        const currentReadiness = await getConnectedAccountReadiness(payoutAccountId, stripeMode);
        await updateUserStripeReferences(payoutTech.id, booking.isQaTest
          ? { stripeTestConnectedAccountReady: currentReadiness.ready }
          : { stripeConnectedAccountReady: currentReadiness.ready, stripeConnectedAccountMode: stripeMode });
        if (!currentReadiness.ready) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The nail tech’s Stripe payout capability is no longer active. Ask them to complete Stripe onboarding again." });
        }
      }

      const serviceRefund = await refundPaymentIntent({
        paymentIntentId: booking.stripePaymentIntentId,
        amountInCents: resolution.refundAmountInCents,
        bookingId: booking.id,
        kind: "service_issue_refund",
        mode: stripeMode,
      });
      if (serviceRefund.status !== "succeeded") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Stripe has not completed the client refund. Try again after confirming the refund status in Stripe." });
      }

      const mustRefundTip = booking.tipStatus === "paid" && Boolean(booking.stripeTipPaymentIntentId) && (input.refundTip || resolution.isFullRefund);
      let tipRefundId: string | null = null;
      if (mustRefundTip && booking.stripeTipPaymentIntentId && booking.tipAmountInCents > 0) {
        const tipRefund = await refundPaymentIntent({
          paymentIntentId: booking.stripeTipPaymentIntentId,
          amountInCents: booking.tipAmountInCents,
          bookingId: booking.id,
          kind: "tip_issue_refund",
          mode: stripeMode,
        });
        if (tipRefund.status !== "succeeded") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The service refund succeeded, but Stripe has not completed the tip refund. Confirm its status in Stripe before retrying." });
        }
        tipRefundId = tipRefund.id;
      }

      let transferId: string | null = null;
      let payoutStatus: "not_ready" | "released" = "not_ready";
      if (resolution.payoutableServiceTotalInCents > 0) {
        const transfer = await releaseBookingPayout({
          bookingId: booking.id,
          techAccountId: payoutAccountId!,
          servicePaymentIntentId: booking.stripePaymentIntentId,
          serviceTotalInCents: resolution.payoutableServiceTotalInCents,
          tipPaymentIntentId: mustRefundTip ? null : booking.tipStatus === "paid" ? booking.stripeTipPaymentIntentId : null,
          mode: stripeMode,
        });
        transferId = transfer.id;
        payoutStatus = "released";
      }

      await resolveBookingIssue({
        bookingId: booking.id,
        adminId: ctx.user.id,
        resolution: resolution.isFullRefund ? "full_refund" : "partial_refund",
        resolutionNote: input.resolutionNote,
        refundAmountInCents: resolution.refundAmountInCents,
        paymentStatus: resolution.isFullRefund ? "refunded" : "paid",
        payoutStatus,
        stripeRefundId: serviceRefund.id,
        stripeTipRefundId: tipRefundId,
        stripeTransferId: transferId,
        ...(mustRefundTip ? { tipStatus: "refunded" as const } : {}),
      });
      if (!booking.isQaTest) {
        await createNotification({ userId: booking.clientId, type: "issue_resolved", title: "Appointment issue resolved", body: resolution.isFullRefund ? "Your service payment was refunded after administrator review." : "An administrator issued a partial service refund after reviewing your report.", relatedId: booking.id });
        await createNotification({ userId: booking.techId, type: "issue_resolved", title: "Appointment issue resolved", body: resolution.isFullRefund ? "The client received a full service refund after administrator review." : "An administrator issued a partial client refund and released the remaining payout.", relatedId: booking.id });
      }
      return { success: true, resolution: resolution.isFullRefund ? "full_refund" as const : "partial_refund" as const };
    }),

  connectTech: protectedProcedure
    .input(z.object({ origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech" && ctx.user.activeMode !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      const requestedOrigin = new URL(input.origin).origin;
      const browserOrigin = typeof ctx.req.headers.origin === "string" ? ctx.req.headers.origin : null;
      if (browserOrigin && requestedOrigin !== browserOrigin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Stripe onboarding must return to the Valisse session that started it." });
      }
      const stripeMode = getConfiguredStripeModeOrThrow();
      let accountId = isStripeObjectInConfiguredEnvironment(ctx.user.stripeConnectedAccountMode, stripeMode)
        ? ctx.user.stripeConnectedAccountId
        : null;
      if (!accountId) {
        const account = await createRecipientConnectedAccount({
          techId: ctx.user.id,
          email: ctx.user.email,
          displayName: ctx.user.businessName ?? ctx.user.name,
        });
        accountId = account.id;
        await updateUserStripeReferences(ctx.user.id, {
          stripeConnectedAccountId: accountId,
          stripeConnectedAccountMode: stripeMode,
          stripeConnectedAccountReady: false,
        });
      }
      const link = await createRecipientOnboardingLink({
        accountId,
        refreshUrl: `${requestedOrigin}/settings/payouts?refresh=1`,
        returnUrl: `${requestedOrigin}/settings/payouts?return=1`,
      });
      return { onboardingUrl: link.url };
    }),

  refreshTechConnection: protectedProcedure.query(async ({ ctx }) => {
    const integration = getStripeIntegrationStatus();
    if (integration.mode !== "test" && integration.mode !== "live") {
      return { connected: false, ready: false, ...integration };
    }
    if (!ctx.user.stripeConnectedAccountId || !isStripeObjectInConfiguredEnvironment(ctx.user.stripeConnectedAccountMode, integration.mode)) {
      return { connected: false, ready: false, requiresOnboarding: Boolean(ctx.user.stripeConnectedAccountId), ...integration };
    }
    const { ready, transferStatus } = await getConnectedAccountReadiness(ctx.user.stripeConnectedAccountId);
    await updateUserStripeReferences(ctx.user.id, {
      stripeConnectedAccountReady: ready,
      stripeConnectedAccountMode: integration.mode,
    });
    return { connected: true, ready, transferStatus, ...integration };
  }),

  payoutHistory: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.userType !== "nail_tech" && ctx.user.activeMode !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
    return getTechPayoutHistory(ctx.user.id);
  }),
});

// ─── Availability ─────────────────────────────────────────────────────────────
const calendarEventInputSchema = z.object({
  kind: z.enum(["available", "unavailable"]),
  recurrence: z.enum(["once", "weekly"]),
  localDate: z.string().nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  startTime: z.string(),
  endTime: z.string(),
  clientTier: z.enum(["open", "returning_only"]).default("open"),
  title: z.string().trim().max(160).nullable().optional(),
  timeZone: z.string().min(1).max(64),
});

function assertTechnicianCalendarAccess(user: Parameters<typeof isTechCapable>[0]) {
  if (!isTechCapable(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Technician access is required." });
}

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
            clientTier: z.enum(["open", "returning_only"]).optional(),
            serviceIds: z.array(z.number().int().positive()).max(100).optional(),
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

  calendar: protectedProcedure
    .input(z.object({ fromLocalDate: z.string(), toLocalDate: z.string() }))
    .query(async ({ ctx, input }) => {
      assertTechnicianCalendarAccess(ctx.user);
      return getTechnicianCalendar(ctx.user.id, input);
    }),

  createCalendarEvent: protectedProcedure
    .input(calendarEventInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertTechnicianCalendarAccess(ctx.user);
      const id = await createCalendarEvent(ctx.user.id, input);
      return { id };
    }),

  removeCalendarEvent: protectedProcedure
    .input(z.object({ eventId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertTechnicianCalendarAccess(ctx.user);
      await deleteCalendarEvent(input.eventId, ctx.user.id);
      return { success: true };
    }),

  previewOverride: protectedProcedure
    .input(calendarEventInputSchema.extend({ kind: z.literal("unavailable"), recurrence: z.literal("once"), localDate: z.string().min(10) }))
    .query(async ({ ctx, input }) => {
      assertTechnicianCalendarAccess(ctx.user);
      const conflicts = await getAvailabilityOverrideConflicts(ctx.user.id, input);
      return conflicts.map(({ booking, client, addonService }) => ({
        booking: {
          id: booking.id,
          status: booking.status,
          scheduledAt: booking.scheduledAt,
          duration: booking.duration,
          serviceType: booking.serviceType,
        },
        client: client ? { name: client.name, avatarUrl: client.avatarUrl } : null,
        addonService: addonService ? { category: addonService.category, customName: addonService.customName } : null,
      }));
    }),

  applyOverride: protectedProcedure
    .input(calendarEventInputSchema.extend({
      kind: z.literal("unavailable"),
      recurrence: z.literal("once"),
      localDate: z.string().min(10),
      expectedBookingIds: z.array(z.number().int().positive()).max(100),
      cancellationReason: z.string().trim().max(500).optional(),
      confirmCancellation: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertTechnicianCalendarAccess(ctx.user);
      if (input.expectedBookingIds.length > 0 && !input.confirmCancellation) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm the affected appointment cancellations before applying this override." });
      }
      try {
        const result = await applyCalendarAvailabilityOverride({
          techId: ctx.user.id,
          event: input,
          expectedBookingIds: input.expectedBookingIds,
          cancellationReason: input.cancellationReason,
        });
        const publicDate = new Date(`${input.localDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const timeLabel = `${input.startTime}–${input.endTime}`;
        const cancellationReason = input.cancellationReason?.trim() || "Your nail tech is unavailable for this time.";
        for (const { booking } of result.conflicts) {
          if (booking.isQaTest) continue;
          await createNotification({
            userId: booking.clientId,
            type: "booking_cancelled_for_availability_override",
            title: "Your appointment needs to be rescheduled",
            body: `Your nail tech is unavailable ${publicDate}, ${timeLabel}. Reason: ${cancellationReason} Choose another time to book again.`,
            relatedId: booking.id,
          });
          const rescheduleUrl = `${ENV.publicAppUrl}/book/${booking.techId}?rescheduleFrom=${booking.id}`;
          void sendValisseTransactionalSms({
            userId: booking.clientId,
            category: "availability_override",
            text: `Valisse: your ${publicDate} appointment was cancelled. Reason: ${cancellationReason} Book another time: ${rescheduleUrl} Reply STOP to opt out.`,
          }).catch((error) => console.warn("[Telnyx] Availability-override SMS failed", error));
        }
        return { eventId: result.eventId, cancelledBookingIds: result.conflicts.map(({ booking }) => booking.id) };
      } catch (error) {
        if ((error as { code?: string }).code === "CONFLICT_SET_CHANGED") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: (error as Error).message });
        }
        throw error;
      }
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

  updateBookingRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.number(),
        dayOfWeek: z.number().min(0).max(6).nullable().optional(),
        specificDate: z.number().nullable().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        clientTier: z.enum(["open", "returning_only"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { ruleId, specificDate, ...rest } = input;
      await updateBookingRule(ruleId, ctx.user.id, {
        ...rest,
        specificDate: specificDate !== undefined
          ? (specificDate ? new Date(specificDate) : null)
          : undefined,
      });
      return { success: true };
    }),
});

// ─── Last-Minute Slots ────────────────────────────────────────────────────────
const lastMinuteRouter = router({
  mySlots: protectedProcedure.query(async ({ ctx }) => getTechLastMinuteSlots(ctx.user.id)),

  openSlots: publicProcedure.query(async () => getOpenLastMinuteSlots()),

  activeSlot: publicProcedure
    .input(z.object({ slotId: z.number().int().positive() }))
    .query(async ({ input }) => getActiveLastMinuteSlotById(input.slotId)),

  forTech: publicProcedure
    .input(z.object({ techId: z.number() }))
    .query(async ({ input }) => getActiveSlotsForTech(input.techId)),

  create: protectedProcedure
    .input(
      z.object({
        slotDate: z.string(),    // YYYY-MM-DD
        startTime: z.string(),   // HH:MM 24h
        endTime: z.string(),     // HH:MM 24h
        note: z.string().optional(),
        isPushed: z.boolean().default(false),
        timeZone: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createLastMinuteSlot(
        ctx.user.id,
        input.slotDate,
        input.startTime,
        input.endTime,
        input.note,
        input.isPushed,
        input.timeZone,
      );
      // Notify followers
      const followerIds = await getTechFollowerIds(ctx.user.id);
      const techName = ctx.user.businessName ?? ctx.user.name ?? "Your nail tech";
      const dateLabel = new Date(`${input.slotDate}T${input.startTime}:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const fmt12 = (t: string) => { const [h, m] = t.split(":").map(Number); const ampm = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`; };
      const timeLabel = `${fmt12(input.startTime)}–${fmt12(input.endTime)}`;
      for (const clientId of followerIds) {
        await createNotification({ userId: clientId, type: "last_minute_slot", title: `${techName} has a last-minute opening`, body: `${dateLabel} · ${timeLabel}`, relatedId: id });
      }
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
    .input(z.object({ targetUserId: z.number().optional(), techId: z.number().optional() }).refine(
      (input) => Boolean(input.targetUserId ?? input.techId),
      "Choose someone to message.",
    ))
    .mutation(async ({ ctx, input }) => {
      const targetUserId = input.targetUserId ?? input.techId!;
      if (targetUserId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot message yourself." });
      const target = await getUserById(targetUserId);
      if (!target || target.deactivatedAt) throw new TRPCError({ code: "NOT_FOUND", message: "That account is unavailable." });
      if (await isDirectMessageBlocked(ctx.user.id, target.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Messaging is unavailable for this account." });
      }

      const viewerIsTech = isTechCapable(ctx.user);
      const targetIsTech = isTechCapable(target);
      let conversationInput: {
        clientId: number;
        techId: number;
        clientRole: "client" | "nail_tech";
        techRole: "client" | "nail_tech";
      };

      if (!targetIsTech) {
        if (!viewerIsTech || !(await hasAppointmentRelationship(ctx.user.id, target.id))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Client profiles are available only to their appointment nail techs." });
        }
        conversationInput = { clientId: target.id, techId: ctx.user.id, clientRole: "client", techRole: "nail_tech" };
      } else if (viewerIsTech && ctx.user.activeMode === "nail_tech") {
        const [firstId, secondId] = [ctx.user.id, target.id].sort((a, b) => a - b);
        conversationInput = { clientId: firstId, techId: secondId, clientRole: "nail_tech", techRole: "nail_tech" };
      } else {
        conversationInput = { clientId: ctx.user.id, techId: target.id, clientRole: "client", techRole: "nail_tech" };
      }

      return getOrCreateConversation(conversationInput);
    }),

  conversations: protectedProcedure.query(async ({ ctx }) => getUserConversations(ctx.user.id)),

  messages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const conversation = await getConversationForParticipant(input.conversationId, ctx.user.id);
      if (!conversation || !isConversationParticipant(conversation, ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this conversation." });
      }
      const otherUserId = conversation.clientId === ctx.user.id ? conversation.techId : conversation.clientId;
      if (await isDirectMessageBlocked(ctx.user.id, otherUserId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Messaging is unavailable for this account." });
      }
      await markMessagesRead(input.conversationId, ctx.user.id);
      const msgs = await getConversationMessages(input.conversationId);
      return msgs.reverse();
    }),

  send: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      content: z.string().trim().max(2_000).optional(),
      imageUrl: z.string().optional(),
      bookingId: z.number().optional(),
      type: z.enum(["text", "image", "booking_request", "booking_card"]).default("text"),
    }).superRefine((data, issueCtx) => {
      if (!data.content && !data.imageUrl) {
        issueCtx.addIssue({ code: z.ZodIssueCode.custom, path: ["content"], message: "A message or image is required." });
      }
      if (data.type === "image" && !data.imageUrl) {
        issueCtx.addIssue({ code: z.ZodIssueCode.custom, path: ["imageUrl"], message: "An image is required for image messages." });
      }
    }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await getConversationForParticipant(input.conversationId, ctx.user.id);
      if (!conversation || !isConversationParticipant(conversation, ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this conversation." });
      }
      const otherUserId = conversation.clientId === ctx.user.id ? conversation.techId : conversation.clientId;
      if (await isDirectMessageBlocked(ctx.user.id, otherUserId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Messaging is unavailable for this account." });
      }
      const validationError = getDirectMessageValidationError(input);
      if (validationError) throw new TRPCError({ code: "BAD_REQUEST", message: validationError });
      if (input.imageUrl && !isSafeDirectMessageImageReference(input.imageUrl, ctx.user.id)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid message image reference." });
      }
      const id = await sendMessage({
        conversationId: input.conversationId,
        senderId: ctx.user.id,
        senderRole: getConversationRole(conversation, ctx.user.id) ?? "client",
        content: input.content ?? null,
        imageUrl: input.imageUrl ?? null,
        bookingId: input.bookingId ?? null,
        type: input.type,
      } as any);
      return { id };
    }),

  uploadImage: protectedProcedure
    .input(z.object({
      base64: z.string().min(1).max(7_000_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Images must be 5 MB or smaller." });
      }
      const extension = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
      const { url } = await storagePut(`messages/${ctx.user.id}/${Date.now()}.${extension}`, buffer, input.mimeType);
      return { url };
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
        text: z.string().trim().max(2000).optional(),
        photoUrls: z.array(z.string().startsWith("/manus-storage/reviews/")).max(5).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      const existingReview = await getReviewByBookingId(input.bookingId);
      const eligibility = getReviewEligibility({
        booking,
        reviewerId: ctx.user.id,
        techId: input.techId,
        alreadyReviewed: Boolean(existingReview),
      });
      if (!eligibility.eligible) {
        throw new TRPCError({ code: "BAD_REQUEST", message: eligibility.reason });
      }
      const id = await createReview({
        bookingId: input.bookingId,
        clientId: ctx.user.id,
        techId: input.techId,
        rating: input.rating,
        text: input.text ?? null,
        photoUrl: input.photoUrls[0] ?? null,
        photoUrls: input.photoUrls,
      } as any);
      return { id };
    }),

  uploadPhoto: protectedProcedure
    .input(z.object({
      base64: z.string().min(1).max(7_000_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Review photos must be 5 MB or smaller." });
      }
      const extension = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
      const { url } = await storagePut(`reviews/${ctx.user.id}/${Date.now()}.${extension}`, buffer, input.mimeType);
      return { url };
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

// ─── Tech Follows (client subscribes to tech page) ──────────────────────────
const techFollowsRouter = router({
  follow: protectedProcedure
    .input(z.object({ techId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await followTech(ctx.user.id, input.techId);
      return { success: true };
    }),

  unfollow: protectedProcedure
    .input(z.object({ techId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await unfollowTech(ctx.user.id, input.techId);
      return { success: true };
    }),

  isFollowing: protectedProcedure
    .input(z.object({ techId: z.number() }))
    .query(async ({ ctx, input }) => {
      const following = await isTechFollowed(ctx.user.id, input.techId);
      return { following };
    }),

  followerCount: publicProcedure
    .input(z.object({ techId: z.number() }))
    .query(async ({ input }) => {
      const count = await getTechFollowerCount(input.techId);
      return { count };
    }),

  myFollowedTechIds: protectedProcedure.query(async ({ ctx }) => {
    const ids = await getFollowedTechIds(ctx.user.id);
    return { ids };
  }),
});

// ─── Notifications ────────────────────────────────────────────────────────────
const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => getUserNotifications(ctx.user.id)),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await getUnreadNotificationCount(ctx.user.id);
    return { count };
  }),

  unreadSlotCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await getUnreadSlotNotificationCount(ctx.user.id);
    return { count };
  }),

  markRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markNotificationsRead(ctx.user.id);
    return { success: true };
  }),

  markOne: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markSingleNotificationRead(input.notificationId, ctx.user.id);
      return { success: true };
    }),
});

// ─── Reports Router ─────────────────────────────────────────────────────────
const reportsRouter = router({
  submit: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        reason: z.enum(["nudity", "stolen_content", "spam", "harassment", "violence", "other"]),
        note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await submitReport({
        postId: input.postId,
        reporterId: ctx.user.id,
        reason: input.reason,
        note: input.note,
      });
      if (result.alreadyReported) return { alreadyReported: true };

      // Notify the post's tech
      const post = await getPostById(input.postId);
      if (post) {
        await createNotification({
          userId: post.techId,
          type: "system",
          title: "Your post was reported",
          body: `A user reported your post for: ${input.reason.replace(/_/g, " ")}.`,
          relatedId: input.postId,
        });
        const adminIds = await getAdminUserIds();
        await Promise.all(
          adminIds
            .filter((adminId) => adminId !== post.techId)
            .map((adminId) =>
              createNotification({
                userId: adminId,
                type: "system",
                title: "New post report",
                body: `A post was reported for: ${input.reason.replace(/_/g, " ")}.`,
                relatedId: input.postId,
              })
            )
        );
        // Notify the platform owner/admin
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: "New post report",
          content: `Post #${input.postId} was reported for "${input.reason.replace(/_/g, " ")}" by user #${ctx.user.id}.${
            input.note ? ` Note: ${input.note}` : ""
          }`,
        });
      }
      return { alreadyReported: false };
    }),

  hasReported: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ ctx, input }) => {
      const reported = await hasUserReportedPost(ctx.user.id, input.postId);
      return { reported };
    }),

  // Admin-only procedures
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new Error("Forbidden");
    return getReportsForAdmin();
  }),

  dismiss: protectedProcedure
    .input(z.object({ reportId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      await dismissReport(input.reportId);
      return { success: true };
    }),

  hidePost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      await hidePostByAdmin(input.postId);
      return { success: true };
    }),

  deletePost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      await deletePostByAdmin(input.postId);
      return { success: true };
    }),
});

// ─── Cancellation Policy ─────────────────────────────────────────────────────
// Kept as a compatibility namespace for existing cancellation screens. The
// actual source of truth is the independently toggleable appointment fee policy.
const cancellationRouter = router({
  getPolicy: publicProcedure
    .input(z.object({ techId: z.number() }))
    .query(async ({ input }) => getAppointmentFeePolicy(input.techId)),

  setPolicy: protectedProcedure
    .input(z.object({
      windowHours: z.number().int().min(1).max(168),
      feeType: z.enum(["flat", "percent"]),
      feeAmount: z.number().min(0).max(10000),
      gracePeriodHours: z.number().int().min(0).max(24).default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech" && ctx.user.activeMode !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      const current = await getAppointmentFeePolicy(ctx.user.id);
      const rules = current.rules.map((rule) => rule.ruleType === "cancellation" ? {
        ...rule,
        enabled: input.feeAmount > 0,
        noticeHours: input.windowHours,
        gracePeriodMinutes: input.gracePeriodHours * 60,
        feeType: input.feeType === "percent" ? "percent_service_total" as const : "flat" as const,
        flatFeeInCents: input.feeType === "flat" ? Math.round(input.feeAmount * 100) : 0,
        feePercentBasisPoints: input.feeType === "percent" ? Math.round(input.feeAmount * 100) : 0,
      } : rule);
      const policy = await upsertAppointmentFeeRules(ctx.user.id, rules);
      return { success: true, policy };
    }),

  previewFee: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
      if (booking.clientId !== ctx.user.id && booking.techId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const snapshot = (booking.feePolicySnapshot as any)?.rules ? booking.feePolicySnapshot as any : await getAppointmentFeePolicy(booking.techId);
      const rule = snapshot.rules?.find((item: AppointmentFeeRuleInput) => item.ruleType === "cancellation") as AppointmentFeeRuleInput | undefined;
      const totalInCents = await getBookingServiceTotalInCents(booking.id);
      const isLateCancellation = Boolean(rule && isCancellationFeeEligible({ rule, scheduledAt: booking.scheduledAt, bookedAt: booking.createdAt }));
      const amountInCents = isLateCancellation && rule ? resolveAppointmentFeeAmountInCents(rule, totalInCents) : 0;
      return {
        isGrace: !isLateCancellation,
        isLateCancellation,
        feeAmountInCents: amountInCents,
        feeAmountDollars: amountInCents / 100,
        policy: snapshot,
      };
    }),

  cancel: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
      const isClient = booking.clientId === ctx.user.id;
      const isTech = booking.techId === ctx.user.id;
      if (!isClient && !isTech) throw new TRPCError({ code: "FORBIDDEN" });
      if (["cancelled", "completed", "no_show"].includes(booking.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Booking cannot be cancelled." });

      const event = isClient ? await createEligibleCancellationFee({ booking }) : null;
      if (!isClient && !booking.isQaTest) {
        await createNotification({ userId: booking.clientId, type: "booking_cancelled_by_tech", title: "Booking Cancelled", body: "Your appointment has been cancelled by the nail tech. We've found some alternatives for you.", relatedId: booking.id });
      }
      await cancelBooking(booking.id, isClient ? "client" : "tech", event ? "pending" : "none", event ? event.amountInCents / 100 : 0);
      return { success: true, feeStatus: event ? "pending" as const : "none" as const, feeAmountDollars: event ? event.amountInCents / 100 : 0, feeEventId: event?.id ?? null };
    }),

  waiveFee: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const events = await getBookingFeeEvents(input.bookingId);
      const event = events.find((item) => item.feeType === "cancellation" && item.status === "eligible_pending_tech");
      if (!event || event.techId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await updateBookingFeeEvent(event.id, { status: "waived", waivedAt: new Date(), waivedBy: ctx.user.id });
      await waiveCancellationFee(input.bookingId, ctx.user.id);
      return { success: true };
    }),

  // Get alternative techs after a tech-initiated cancellation
  alternativeTechs: protectedProcedure
    .input(
      z.object({
        bookingId: z.number(),
        clientLat: z.number().nullable().optional(),
        clientLng: z.number().nullable().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
      if (booking.clientId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return getAlternativeTechs({
        originalTechId: booking.techId,
        serviceType: booking.serviceType,
        scheduledAt: booking.scheduledAt,
        clientLat: input.clientLat,
        clientLng: input.clientLng,
      });
    }),
});

const appointmentFeeRuleInputSchema = z.object({
  ruleType: z.enum(["cancellation", "late_arrival", "no_show"]),
  enabled: z.boolean(),
  noticeHours: z.number().int().min(1).max(168),
  gracePeriodMinutes: z.number().int().min(0).max(1_440),
  thresholdMode: z.enum(["fixed_minutes", "percent_of_final_duration"]),
  thresholdValue: z.number().int().min(1).max(1_000),
  feeType: z.enum(["flat", "percent_service_total"]),
  flatFeeInCents: z.number().int().min(0).max(100_000),
  feePercentBasisPoints: z.number().int().min(0).max(10_000),
});

function readBookingFeePolicy(booking: { feePolicySnapshot: unknown; techId: number }) {
  const snapshot = booking.feePolicySnapshot as { version?: unknown; rules?: unknown } | null;
  if (snapshot && typeof snapshot.version === "string" && Array.isArray(snapshot.rules)) {
    return snapshot as { version: string; rules: AppointmentFeeRuleInput[] };
  }
  return null;
}

async function getEffectiveBookingFeePolicy(booking: { feePolicySnapshot: unknown; techId: number }) {
  return readBookingFeePolicy(booking) ?? getAppointmentFeePolicy(booking.techId);
}

async function getAttendanceFeeEligibilityForBooking(booking: Awaited<ReturnType<typeof getBookingById>>) {
  if (!booking) return { lateArrivalEligible: false, noShowEligible: false, lateThresholdMinutes: null, noShowThresholdMinutes: null };
  const [policy, duration] = await Promise.all([getEffectiveBookingFeePolicy(booking), getBookingServiceDurationMinutes(booking.id)]);
  const lateRule = policy.rules.find((rule) => rule.ruleType === "late_arrival");
  const noShowRule = policy.rules.find((rule) => rule.ruleType === "no_show");
  const totalDuration = duration || booking.duration;
  const lateThresholdMinutes = lateRule ? resolveAttendanceThresholdMinutes(lateRule, totalDuration) : null;
  const noShowThresholdMinutes = noShowRule ? resolveAttendanceThresholdMinutes(noShowRule, totalDuration) : null;
  const now = Date.now();
  return {
    lateArrivalEligible: Boolean(booking.status === "confirmed" && lateThresholdMinutes && now >= booking.scheduledAt.getTime() + lateThresholdMinutes * 60_000),
    noShowEligible: Boolean(booking.status === "confirmed" && noShowThresholdMinutes && now >= booking.scheduledAt.getTime() + noShowThresholdMinutes * 60_000),
    lateThresholdMinutes,
    noShowThresholdMinutes,
  };
}

// ─── Appointment Fee Rules + Cases ───────────────────────────────────────────
const appointmentFeesRouter = router({
  policy: publicProcedure
    .input(z.object({ techId: z.number() }))
    .query(async ({ input }) => getAppointmentFeePolicy(input.techId)),

  savePolicy: protectedProcedure
    .input(z.object({ rules: z.array(appointmentFeeRuleInputSchema).length(3) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech" && ctx.user.activeMode !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      const types = new Set(input.rules.map((rule) => rule.ruleType));
      if (types.size !== 3) throw new TRPCError({ code: "BAD_REQUEST", message: "Save one rule for cancellation, late arrival, and no-show." });
      for (const rule of input.rules) {
        if (rule.thresholdMode === "fixed_minutes" && rule.thresholdValue % 5 !== 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Minute thresholds must use 5-minute increments." });
        }
        if (rule.feeType === "percent_service_total" && rule.feePercentBasisPoints > 10_000) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A fee cannot exceed 100% of the final service total." });
        }
      }
      const policy = await upsertAppointmentFeeRules(ctx.user.id, input.rules);
      return { success: true, policy };
    }),

  forBooking: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || (booking.clientId !== ctx.user.id && booking.techId !== ctx.user.id && ctx.user.role !== "admin")) throw new TRPCError({ code: "FORBIDDEN" });
      const [events, policy, attendance] = await Promise.all([
        getBookingFeeEvents(booking.id),
        getEffectiveBookingFeePolicy(booking),
        getAttendanceFeeEligibilityForBooking(booking),
      ]);
      return { events, policy, attendance };
    }),

  markNoShow: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.techId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const eligibility = await getAttendanceFeeEligibilityForBooking(booking);
      if (!eligibility.noShowEligible) throw new TRPCError({ code: "BAD_REQUEST", message: "The no-show threshold has not been reached, or the client already checked in." });
      const event = await createEligibleAttendanceFee({ booking, feeType: "no_show" });
      await markBookingNoShow(booking.id, ctx.user.id);
      return { success: true, eventId: event?.id ?? null };
    }),

  confirm: protectedProcedure
    .input(z.object({ feeEventId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const event = await getBookingFeeEvent(input.feeEventId);
      if (!event || event.techId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (event.status !== "eligible_pending_tech" && event.status !== "charge_failed") throw new TRPCError({ code: "BAD_REQUEST", message: "This fee is no longer awaiting a technician decision." });
      const booking = await getBookingById(event.bookingId);
      const client = booking ? await getUserById(booking.clientId) : null;
      if (!booking || !client) throw new TRPCError({ code: "NOT_FOUND" });
      const mode = getBookingStripeModeOrThrow(booking);
      if (!client.stripeCustomerId || !isStripeObjectInConfiguredEnvironment(client.stripeCustomerMode, mode) || booking.paymentMethodStatus !== "saved") {
        await updateBookingFeeEvent(event.id, { status: "charge_failed", chargeFailureReason: "No verified saved card is available for this payment environment." });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The client has no verified saved card available for this fee." });
      }

      await updateBookingFeeEvent(event.id, { status: "charging", techConfirmedAt: new Date(), techConfirmedBy: ctx.user.id, chargeFailureReason: null });
      try {
        const payment = await chargeAppointmentFee({
          feeEventId: event.id,
          bookingId: booking.id,
          customerId: client.stripeCustomerId,
          amountInCents: event.amountInCents,
          feeType: event.feeType,
          mode,
        });
        if (payment.status !== "succeeded") throw new Error("The card requires additional action or was declined.");
        const chargedAt = new Date();
        await updateBookingFeeEvent(event.id, {
          status: "charged",
          stripePaymentIntentId: payment.id,
          chargedAt,
          payoutStatus: "pending_dispute_window",
          payoutEligibleAt: payoutEligibleAt(chargedAt),
        });
        if (!booking.isQaTest) {
          await createNotification({ userId: booking.clientId, type: "appointment_fee_charged", title: "Appointment fee charged", body: `${formatRuleFee((event.policySnapshot as any).rule ?? { feeType: "flat", flatFeeInCents: event.amountInCents })} was confirmed by your nail tech. You can report an issue from your booking details.`, relatedId: booking.id });
          await createNotification({ userId: booking.techId, type: "appointment_fee_charged", title: "Appointment fee charged", body: "The fee is held for 24 hours for a possible client issue before payout.", relatedId: booking.id });
          void sendValisseTransactionalSms({ userId: booking.clientId, category: "appointment_fee_charged", text: `Valisse: your ${event.feeType.replace("_", " ")} fee of $${(event.amountInCents / 100).toFixed(2)} was confirmed and charged. Report an issue from your booking in Valisse. Reply STOP to opt out.` }).catch((error) => console.warn("[Telnyx] Appointment-fee SMS failed", error));
        }
        return { success: true, status: "charged" as const };
      } catch (error) {
        await updateBookingFeeEvent(event.id, { status: "charge_failed", chargeFailureReason: error instanceof Error ? error.message.slice(0, 500) : "The saved card could not be charged." });
        throw new TRPCError({ code: "BAD_REQUEST", message: "The fee was not charged. The client may need to update their payment method." });
      }
    }),

  waive: protectedProcedure
    .input(z.object({ feeEventId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const event = await getBookingFeeEvent(input.feeEventId);
      if (!event || event.techId !== ctx.user.id || !["eligible_pending_tech", "charge_failed"].includes(event.status)) throw new TRPCError({ code: "FORBIDDEN" });
      await updateBookingFeeEvent(event.id, { status: "waived", waivedAt: new Date(), waivedBy: ctx.user.id });
      const booking = await getBookingById(event.bookingId);
      if (booking && !booking.isQaTest) await createNotification({ userId: booking.clientId, type: "appointment_fee_waived", title: "Appointment fee waived", body: "Your nail tech waived the pending appointment fee. No card charge was made.", relatedId: booking.id });
      return { success: true };
    }),

  dispute: protectedProcedure
    .input(z.object({ feeEventId: z.number(), reason: z.string().trim().min(5).max(2_000) }))
    .mutation(async ({ ctx, input }) => {
      const event = await getBookingFeeEvent(input.feeEventId);
      if (!event || event.clientId !== ctx.user.id || event.status !== "charged") throw new TRPCError({ code: "FORBIDDEN" });
      await updateBookingFeeEvent(event.id, { status: "disputed", payoutStatus: "on_hold", clientDisputedAt: new Date(), clientDisputeReason: input.reason });
      const booking = await getBookingById(event.bookingId);
      if (booking && !booking.isQaTest) {
        const admins = await getAdminUserIds();
        await Promise.all([
          createNotification({ userId: booking.techId, type: "appointment_fee_disputed", title: "Client reported an issue with an appointment fee", body: input.reason, relatedId: booking.id }),
          ...admins.map((userId) => createNotification({ userId, type: "appointment_fee_disputed", title: "Appointment fee dispute", body: input.reason, relatedId: booking.id })),
        ]);
      }
      return { success: true };
    }),

  disputedForAdmin: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return getDisputedFeeEventsForAdmin();
  }),

  resolveDispute: protectedProcedure
    .input(z.object({ feeEventId: z.number(), action: z.enum(["uphold", "refund"]), resolutionNote: z.string().trim().min(10).max(2_000) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const event = await getBookingFeeEvent(input.feeEventId);
      if (!event || event.status !== "disputed") throw new TRPCError({ code: "BAD_REQUEST", message: "This fee dispute is no longer awaiting review." });
      const booking = await getBookingById(event.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.action === "refund") {
        if (!event.stripePaymentIntentId) throw new TRPCError({ code: "BAD_REQUEST", message: "No payment is available to refund." });
        const refund = await refundPaymentIntent({ paymentIntentId: event.stripePaymentIntentId, amountInCents: event.amountInCents, bookingId: booking.id, feeEventId: event.id, kind: "appointment_fee_refund", mode: getBookingStripeModeOrThrow(booking) });
        await updateBookingFeeEvent(event.id, { status: "refunded", payoutStatus: "not_ready", stripeRefundId: refund.id, adminResolvedAt: new Date(), adminResolvedBy: ctx.user.id, adminResolutionNote: input.resolutionNote });
      } else {
        await updateBookingFeeEvent(event.id, { status: "upheld", payoutStatus: "pending_dispute_window", payoutEligibleAt: new Date(), adminResolvedAt: new Date(), adminResolvedBy: ctx.user.id, adminResolutionNote: input.resolutionNote });
      }
      if (!booking.isQaTest) {
        const summary = input.action === "refund" ? "The appointment fee was refunded to the client." : "The appointment fee was upheld and is eligible for technician payout.";
        await Promise.all([
          createNotification({ userId: booking.clientId, type: "appointment_fee_resolved", title: "Appointment fee review complete", body: summary, relatedId: booking.id }),
          createNotification({ userId: booking.techId, type: "appointment_fee_resolved", title: "Appointment fee review complete", body: summary, relatedId: booking.id }),
        ]);
      }
      return { success: true, resolution: input.action };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
// ─── Settings ───────────────────────────────────────────────────────────────
const settingsRouter = router({
  // Profile
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128).optional(),
      phone: z.string().max(32).optional(),
      email: z.string().email().optional(),
      bio: z.string().max(500).optional(),
      avatarUrl: z.string().optional(),
      avatarKey: z.string().optional(),
      // Tech-specific
      businessName: z.string().max(128).optional(),
      licenseNumber: z.string().max(64).optional(),
      yearsExperience: z.number().int().min(0).max(50).optional(),
      instagramHandle: z.string().max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, input);
      return { success: true };
    }),

  uploadAvatar: protectedProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const key = `avatars/${ctx.user.id}-${Date.now()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await updateUserProfile(ctx.user.id, { avatarUrl: url, avatarKey: key });
      return { url, key };
    }),

  deactivateAccount: protectedProcedure
    .mutation(async ({ ctx }) => {
      const result = await deactivateAccountFull(ctx.user.id);
      return { success: true, cancelledCount: result.cancelledCount };
    }),

  reactivateAccount: protectedProcedure
    .mutation(async ({ ctx }) => {
      await reactivateAccount(ctx.user.id);
      return { success: true };
    }),

  permanentDeleteAccount: protectedProcedure
    .mutation(async ({ ctx }) => {
      const result = await permanentDeleteAccount(ctx.user.id);
      return { success: true, cancelledCount: result.cancelledCount };
    }),

  getUpcomingBookings: protectedProcedure
    .query(async ({ ctx }) => {
      return getUpcomingBookingsForUser(ctx.user.id);
    }),

  setDarkMode: protectedProcedure
    .input(z.object({ darkMode: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await updateUserDarkMode(ctx.user.id, input.darkMode);
      return { success: true };
    }),

  // Services (nail tech only)
  getServices: protectedProcedure
    .query(async ({ ctx }) => {
      return getTechServices(ctx.user.id);
    }),

  getServicesByTechId: publicProcedure
    .input(z.object({ techId: z.number() }))
    .query(async ({ input }) => {
      return getTechServices(input.techId);
    }),

  upsertService: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      category: z.string().min(1).max(64),
      customName: z.string().max(128).optional(),
      photoKey: z.string().optional(),
      photoUrl: z.string().optional(),
      priceInCents: z.number().int().min(0),
      durationMinutes: z.number().int().min(5).max(360),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      const id = await upsertTechService({ ...input, techId: ctx.user.id });
      return { id };
    }),

  deleteService: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      await deleteTechService(input.serviceId, ctx.user.id);
      return { success: true };
    }),

  uploadServicePhoto: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      base64: z.string(),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      const buffer = Buffer.from(input.base64, "base64");
      const key = `service-photos/${ctx.user.id}-${input.serviceId}-${Date.now()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await updateTechServicePhoto(input.serviceId, ctx.user.id, key, url);
      return { url, key };
    }),

  // Notification preferences
  getNotificationPreferences: protectedProcedure
    .query(async ({ ctx }) => {
      return getNotificationPreferences(ctx.user.id, ctx.user.userType as "client" | "nail_tech");
    }),

  updateNotificationPreference: protectedProcedure
    .input(z.object({
      type: z.string(),
      inApp: z.boolean(),
      sms: z.boolean(),
      email: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await upsertNotificationPreference(ctx.user.id, input.type, {
        inApp: input.inApp,
        sms: input.sms,
        email: input.email,
      });
      return { success: true };
    }),

  // Privacy settings
  getPrivacySettings: protectedProcedure
    .query(async ({ ctx }) => {
      return getPrivacySettings(ctx.user.id);
    }),

  updatePrivacySettings: protectedProcedure
    .input(z.object({
      profilePrivate: z.boolean().optional(),
      hideBookingHistory: z.boolean().optional(),
      hideFromNearMe: z.boolean().optional(),
      discoverVisible: z.boolean().optional(),
      hideExactAddress: z.boolean().optional(),
      hideApproxLocation: z.boolean().optional(),
      messagePermission: z.enum(["anyone", "booked_only"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await upsertPrivacySettings(ctx.user.id, input);
      return { success: true };
    }),

  // Block users
  blockUser: protectedProcedure
    .input(z.object({ blockedId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (input.blockedId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot block yourself" });
      await blockUser(ctx.user.id, input.blockedId);
      return { success: true };
    }),

  unblockUser: protectedProcedure
    .input(z.object({ blockedId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await unblockUser(ctx.user.id, input.blockedId);
      return { success: true };
    }),

  getBlockedUsers: protectedProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return getBlockedUsers(ctx.user.id, input.search);
    }),

  getInteractedUsers: protectedProcedure
    .query(async ({ ctx }) => {
      return getInteractedUsers(ctx.user.id);
    }),

  // Subscription
  getSubscriptionStatus: protectedProcedure
    .query(async ({ ctx }) => {
      return getTechSubscriptionStatus(ctx.user.id);
    }),

  initSubscription: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      await initTechSubscription(ctx.user.id);
      return { success: true };
    }),
});

// ─── Replacement Smart Service Match ──────────────────────────────────────────
const smartServiceMatchRouter = router({
  getConfig: publicProcedure
    .input(z.object({ serviceCategory: z.string() }))
    .query(({ input }) => getSystemSmartServiceMatchConfig(input.serviceCategory)),

  getCategories: publicProcedure.query(() => SMART_SERVICE_MATCH_CONFIGS.map((config) => config.serviceCategory)),

  getPreviewConfigs: protectedProcedure
    .query(({ ctx }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      return SMART_SERVICE_MATCH_CONFIGS;
    }),

  publicSettings: publicProcedure
    .input(z.object({ techId: z.number() }))
    .query(async ({ input }) => {
      const settings = await getSmartServiceSettings(input.techId);
      return { globalEnabled: settings.globalEnabled };
    }),

  isEnabled: publicProcedure
    .input(z.object({ techId: z.number(), serviceId: z.number() }))
    .query(({ input }) => isSmartMatchEnabled(input.techId, input.serviceId)),

  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      return getSmartServiceSettings(ctx.user.id);
    }),

  updateSettings: protectedProcedure
    .input(z.object({
      globalEnabled: z.boolean().optional(),
      serviceId: z.number().optional(),
      serviceEnabled: z.boolean().optional(),
    }).refine((input) => input.globalEnabled !== undefined || (input.serviceId !== undefined && input.serviceEnabled !== undefined), {
      message: "Choose at least one Smart Service Match setting to update.",
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      if ((input.serviceId === undefined) !== (input.serviceEnabled === undefined)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A service toggle needs both a service and an enabled value." });
      }
      await updateSmartServiceSettings({ techId: ctx.user.id, ...input });
      return { success: true };
    }),

  evaluate: publicProcedure
    .input(z.object({
      techId: z.number(),
      serviceCategory: z.string(),
      answers: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ input }) => {
      const config = getSystemSmartServiceMatchConfig(input.serviceCategory);
      if (!config) {
        return { outcome: "match" as const, recommendedService: null, recommendedAddOns: [], explanation: "Your selected service looks like a good match.", needsReview: false };
      }
      const result = evaluateSmartServiceMatch(input.answers, config.rules);
      const offeredServices = await getTechServices(input.techId);
      const offeredNames = new Set(offeredServices.flatMap((service) => [service.category, service.customName].filter((name): name is string => Boolean(name))));
      const unavailable = [result.recommendedService, ...result.recommendedAddOns]
        .filter((service): service is string => Boolean(service))
        .find((service) => !offeredNames.has(service));
      if (unavailable) {
        return {
          outcome: "review" as const,
          recommendedService: result.recommendedService,
          recommendedAddOns: result.recommendedAddOns,
          explanation: `${unavailable} may be a better fit, but this nail tech does not currently offer it. Your tech will review your answers before confirming.`,
          needsReview: true,
        };
      }
      return result;
    }),

  uploadPhoto: protectedProcedure
    .input(z.object({
      base64: z.string().min(1).max(7_000_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Inspiration photos must be 5 MB or smaller." });
      }
      const extension = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
      const { url } = await storagePut(`smart-service-match/${ctx.user.id}/${Date.now()}.${extension}`, buffer, input.mimeType);
      return { url };
    }),

  proposeRevision: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
      serviceLines: z.array(z.object({
        techServiceId: z.number(),
        lineType: z.enum(["primary", "addon", "upgrade"]),
      })).min(1),
      techNote: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.techId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const offeredServices = await getTechServices(ctx.user.id);
      const lineIds = new Set(input.serviceLines.map((line) => line.techServiceId));
      if (lineIds.size !== input.serviceLines.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Each revised service can only be included once." });
      }
      const lines = input.serviceLines.map((line, position) => {
        const service = offeredServices.find((candidate) => candidate.id === line.techServiceId);
        if (!service) throw new TRPCError({ code: "BAD_REQUEST", message: "One of the revised services is no longer offered." });
        return {
          techServiceId: service.id,
          serviceName: service.customName || service.category,
          lineType: line.lineType,
          priceInCents: service.priceInCents,
          durationMinutes: service.durationMinutes,
          position,
        } as const;
      });
      if (!lines.some((line) => line.lineType === "primary")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A revised quote needs one primary service." });
      }
      const revisionId = await createBookingRevision({ bookingId: booking.id, techId: ctx.user.id, serviceLines: lines, techNote: input.techNote });
      await createNotification({
        userId: booking.clientId,
        type: "booking_revision",
        title: "Your nail tech updated your booking request",
        body: "Review the updated services, time, and quote before your appointment is confirmed.",
        relatedId: booking.id,
      });
      return { revisionId };
    }),

  latestRevision: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || (booking.clientId !== ctx.user.id && booking.techId !== ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getLatestBookingRevision(input.bookingId);
    }),

  bookingContext: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || (booking.clientId !== ctx.user.id && booking.techId !== ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const [serviceLines, assessments, latestRevision] = await Promise.all([
        getBookingServiceLines(input.bookingId),
        getBookingMatchAssessments(input.bookingId),
        getLatestBookingRevision(input.bookingId),
      ]);
      return { serviceLines, assessments, latestRevision };
    }),

  respondToRevision: protectedProcedure
    .input(z.object({ bookingId: z.number(), revisionId: z.number(), accepted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking || booking.clientId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await resolveBookingRevision({ ...input, clientId: ctx.user.id });
      await createNotification({
        userId: booking.techId,
        type: "booking_revision_response",
        title: input.accepted ? "Client accepted the revised booking" : "Client declined the revised booking",
        body: input.accepted ? "The booking has been confirmed with the revised services and quote." : "The client declined the revised booking request.",
        relatedId: input.bookingId,
      });
      return { success: true };
    }),
});

// ─── Legacy Smart Match (removed during UI cutover) ───────────────────────────
const smartMatchRouter = router({
  // Get the effective config (tech override or system default) for a category
  getConfig: publicProcedure
    .input(z.object({ techId: z.number(), serviceCategory: z.string() }))
    .query(async ({ input }) => {
      return await getSmartMatchConfig(input.techId, input.serviceCategory);
    }),

  // Check if smart match is enabled for a tech+service combo
  isEnabled: publicProcedure
    .input(z.object({ techId: z.number(), serviceId: z.number() }))
    .query(async ({ input }) => {
      return await isSmartMatchEnabled(input.techId, input.serviceId);
    }),

  // Get all category configs for a tech (dashboard editor)
  getAllConfigs: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      return await getAllSmartMatchConfigsForTech(ctx.user.id);
    }),

  // Evaluate answers against rules (client-side call before booking is created)
  evaluate: publicProcedure
    .input(z.object({
      techId: z.number(),
      serviceCategory: z.string(),
      answers: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ input }) => {
      const cfg = await getSmartMatchConfig(input.techId, input.serviceCategory);
      if (!cfg) return { outcome: "match" as const, recommendedService: null, message: null };
      const result = evaluateSmartMatchRules(input.answers, cfg.rules as { if: string[]; recommend: string; outcome: "match" | "recommend" | "addon" | "review" | "bundle"; message?: string }[]);
      if ((result.outcome === "recommend" || result.outcome === "addon") && result.recommendedService) {
        const offeredServices = await getTechServices(input.techId);
        const isOffered = offeredServices.some(service => service.category === result.recommendedService || service.customName === result.recommendedService);
        if (!isOffered) {
          return {
            outcome: "review" as const,
            recommendedService: result.recommendedService,
            message: `${result.recommendedService} may be a better fit, but this nail tech does not currently list it. Your tech will review your answers before confirming.`,
          };
        }
      }
      return result;
    }),

  // Save response + flag booking if needed
  saveResponse: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
      techId: z.number(),
      serviceCategory: z.string(),
      answers: z.record(z.string(), z.string()),
      outcome: z.enum(["match", "recommend", "addon", "review", "bundle"]),
      recommendedService: z.string().nullable(),
      photoUrls: z.array(z.string()).default([]),
    }))
    .mutation(async ({ input }) => {
      await saveSmartMatchResponse({
        bookingId: input.bookingId,
        techId: input.techId,
        serviceCategory: input.serviceCategory,
        answers: input.answers as Record<string, string>,
        outcome: input.outcome,
        recommendedService: input.recommendedService,
        photoUrls: input.photoUrls,
      });
      return { success: true };
    }),

  uploadPhoto: protectedProcedure
    .input(z.object({
      base64: z.string().min(1).max(7_000_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Inspiration photos must be 5 MB or smaller." });
      }
      const extension = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
      const { url } = await storagePut(`smart-match/${ctx.user.id}/${Date.now()}.${extension}`, buffer, input.mimeType);
      return { url };
    }),

  // Tech: upsert a config override
  upsertConfig: protectedProcedure
    .input(z.object({
      serviceCategory: z.string(),
      questions: z.array(z.object({
        id: z.string(),
        text: z.string(),
        options: z.array(z.string()),
        allowsPhoto: z.boolean().optional(),
      })).optional(),
      rules: z.array(z.object({
        if: z.array(z.string()),
        recommend: z.string(),
        outcome: z.enum(["match", "recommend", "addon", "review", "bundle"]),
        message: z.string().optional(),
      })).optional(),
      isEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      await upsertSmartMatchConfig(ctx.user.id, input.serviceCategory, {
        questions: input.questions,
        rules: input.rules,
        isEnabled: input.isEnabled,
      });
      return { success: true };
    }),

  // Tech: apply review action on a flagged booking
  reviewAction: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
      action: z.enum(["approve", "changeService", "requestInfo", "adjustPriceDuration"]),
      serviceType: z.string().optional(),
      techNotes: z.string().optional(),
      duration: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      await applyTechReviewAction(input.bookingId, input.action, {
        serviceType: input.serviceType,
        techNotes: input.techNotes,
        duration: input.duration,
      });
      return { success: true };
    }),

  // Get system default categories list (for UI dropdowns)
  getCategories: publicProcedure.query(() => {
    return SYSTEM_DEFAULTS.map((d) => d.serviceCategory);
  }),

  // Get global Smart Match toggle for the authenticated tech
  getGlobalEnabled: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.userType !== "nail_tech") return true;
    return await getSmartMatchGlobalEnabled(ctx.user.id);
  }),

  // Set global Smart Match toggle for the authenticated tech
  setGlobalEnabled: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.userType !== "nail_tech") throw new TRPCError({ code: "FORBIDDEN" });
      await setSmartMatchGlobalEnabled(ctx.user.id, input.enabled);
      return { success: true };
    }),
});

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
  techFollows: techFollowsRouter,
  reports: reportsRouter,
  cancellation: cancellationRouter,
  appointmentFees: appointmentFeesRouter,
  qaAppointment: qaAppointmentRouter,
  appointment: appointmentRouter,
  settings: settingsRouter,
  smartService: smartServiceMatchRouter,
});

export type AppRouter = typeof appRouter;
