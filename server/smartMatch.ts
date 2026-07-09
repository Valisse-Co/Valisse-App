/**
 * Smart Service Match — seed data, evaluation engine, and DB helpers.
 *
 * System defaults (techId = null) are seeded once.  Techs can create per-tech
 * overrides that shadow the system default for their profile.
 */

import { getDb } from "./db";
import { smartMatchConfigs, smartMatchResponses, bookings, techServices, users } from "../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SMQuestion {
  id: string;
  text: string;
  options: string[];
}

export interface SMRule {
  if: string[];          // answer option substrings that trigger this rule
  recommend: string;     // recommended service name
  outcome: "match" | "recommend" | "review";
}

export interface SMConfig {
  serviceCategory: string;
  questions: SMQuestion[];
  rules: SMRule[];
}

// ─── System Default Questionnaires ───────────────────────────────────────────

export const SYSTEM_DEFAULTS: SMConfig[] = [
  {
    serviceCategory: "Gel Manicure",
    questions: [
      {
        id: "q1",
        text: "Do you currently have anything on your nails that needs to be removed?",
        options: ["No, my nails are bare", "Yes, regular polish", "Yes, gel polish", "Yes, acrylic/dip/extensions", "I'm not sure"],
      },
      {
        id: "q2",
        text: "Are you wanting to add length?",
        options: ["No, natural nail only", "Maybe a little", "Yes, I want extensions", "I'm not sure"],
      },
      {
        id: "q3",
        text: "What type of design are you wanting?",
        options: ["One solid color", "Simple design/French/chrome", "Detailed nail art", "I'm not sure yet"],
      },
    ],
    rules: [
      { if: ["Yes, acrylic/dip/extensions"], recommend: "Removal / Soak-Off", outcome: "recommend" },
      { if: ["Yes, I want extensions"], recommend: "Gel-X / Soft Gel Extensions", outcome: "recommend" },
      { if: ["Detailed nail art"], recommend: "Nail Art / Add-Ons", outcome: "recommend" },
    ],
  },
  {
    serviceCategory: "Structured Gel / Builder Gel",
    questions: [
      {
        id: "q1",
        text: "Do you currently have any product on your nails?",
        options: ["No, bare nails", "Yes, gel polish", "Yes, acrylic or dip", "I'm not sure"],
      },
      {
        id: "q2",
        text: "What is your main goal for this appointment?",
        options: ["Strengthen my natural nails", "Add length with extensions", "Just a color change", "I'm not sure"],
      },
      {
        id: "q3",
        text: "How long has it been since your last nail appointment?",
        options: ["Less than 3 weeks", "3–5 weeks", "More than 5 weeks", "First time / not sure"],
      },
    ],
    rules: [
      { if: ["Just a color change"], recommend: "Gel Manicure", outcome: "recommend" },
      { if: ["Add length with extensions"], recommend: "Gel-X / Extensions", outcome: "recommend" },
      { if: ["acrylic or dip"], recommend: "Removal", outcome: "recommend" },
      { if: ["More than 5 weeks"], recommend: "Full Set", outcome: "review" },
    ],
  },
  {
    serviceCategory: "Acrylic Full Set",
    questions: [
      {
        id: "q1",
        text: "Do you currently have acrylic nails?",
        options: ["No, starting fresh", "Yes, grown out and need a fill", "Yes, need removal first", "I'm not sure"],
      },
      {
        id: "q2",
        text: "How much length are you looking for?",
        options: ["Short / natural looking", "Medium length", "Long / dramatic", "I'm not sure"],
      },
      {
        id: "q3",
        text: "What type of finish are you going for?",
        options: ["Solid color", "French tip", "Detailed nail art", "I'm not sure yet"],
      },
    ],
    rules: [
      { if: ["grown out and need a fill"], recommend: "Acrylic Fill", outcome: "recommend" },
      { if: ["need removal first"], recommend: "Removal", outcome: "recommend" },
      { if: ["Short / natural looking"], recommend: "Structured Gel / Builder Gel", outcome: "recommend" },
      { if: ["Detailed nail art"], recommend: "Nail Art Add-On", outcome: "recommend" },
    ],
  },
  {
    serviceCategory: "Acrylic Fill",
    questions: [
      {
        id: "q1",
        text: "How long ago was your last acrylic fill?",
        options: ["Less than 3 weeks", "3–4 weeks", "5 weeks or more", "I'm not sure"],
      },
      {
        id: "q2",
        text: "How many nails are broken or missing?",
        options: ["None", "1–2 nails", "3 or more nails", "I'm not sure"],
      },
      {
        id: "q3",
        text: "Are you wanting a major shape or length change?",
        options: ["No, keeping the same", "Minor adjustment", "Yes, significant change", "I'm not sure"],
      },
    ],
    rules: [
      { if: ["5 weeks or more"], recommend: "Acrylic Full Set", outcome: "recommend" },
      { if: ["3 or more nails"], recommend: "Acrylic Full Set", outcome: "recommend" },
      { if: ["Yes, significant change"], recommend: "Acrylic Full Set", outcome: "review" },
    ],
  },
  {
    serviceCategory: "Gel-X / Soft Gel Extensions",
    questions: [
      {
        id: "q1",
        text: "Are you looking to add length?",
        options: ["Yes, I want extensions", "No, just strengthen natural nails", "I'm not sure"],
      },
      {
        id: "q2",
        text: "Do you have any existing product on your nails?",
        options: ["No, bare nails", "Yes, gel polish", "Yes, acrylic or hard gel", "I'm not sure"],
      },
      {
        id: "q3",
        text: "What type of design are you wanting?",
        options: ["Solid color", "Simple design", "Detailed nail art", "I'm not sure yet"],
      },
    ],
    rules: [
      { if: ["No, just strengthen natural nails"], recommend: "Gel Manicure", outcome: "recommend" },
      { if: ["acrylic or hard gel"], recommend: "Removal", outcome: "recommend" },
      { if: ["Detailed nail art"], recommend: "Nail Art Add-On", outcome: "recommend" },
    ],
  },
  {
    serviceCategory: "Dip Powder",
    questions: [
      {
        id: "q1",
        text: "Do you have any existing product on your nails?",
        options: ["No, bare nails", "Yes, gel polish", "Yes, acrylic or extensions", "Yes, dip powder", "I'm not sure"],
      },
      {
        id: "q2",
        text: "Are you looking to add length?",
        options: ["No, natural length only", "Yes, with tips", "Yes, significant length", "I'm not sure"],
      },
      {
        id: "q3",
        text: "How would you describe your nail health?",
        options: ["Healthy and strong", "Thin or damaged", "Peeling or breaking", "I'm not sure"],
      },
    ],
    rules: [
      { if: ["acrylic or extensions"], recommend: "Removal", outcome: "recommend" },
      { if: ["Yes, significant length"], recommend: "Acrylic Full Set", outcome: "recommend" },
      { if: ["Peeling or breaking"], recommend: "Tech Review", outcome: "review" },
    ],
  },
  {
    serviceCategory: "Manicure",
    questions: [
      {
        id: "q1",
        text: "What type of finish are you looking for?",
        options: ["Regular polish", "Gel polish", "No polish / just shape and clean", "I'm not sure"],
      },
      {
        id: "q2",
        text: "Do you have any existing product on your nails?",
        options: ["No, bare nails", "Yes, regular polish", "Yes, acrylic or gel extensions", "I'm not sure"],
      },
      {
        id: "q3",
        text: "Are you looking to add length?",
        options: ["No, natural length only", "Yes, with extensions", "I'm not sure"],
      },
    ],
    rules: [
      { if: ["Gel polish"], recommend: "Gel Manicure", outcome: "recommend" },
      { if: ["acrylic or gel extensions"], recommend: "Removal", outcome: "recommend" },
      { if: ["Yes, with extensions"], recommend: "Gel-X / Extensions", outcome: "recommend" },
    ],
  },
  {
    serviceCategory: "Pedicure",
    questions: [
      {
        id: "q1",
        text: "Do you have gel polish on your toenails that needs to be removed?",
        options: ["No, bare nails", "Yes, gel polish", "Yes, regular polish", "I'm not sure"],
      },
      {
        id: "q2",
        text: "Are you looking for any extra foot care?",
        options: ["Standard pedicure is fine", "Yes, callus treatment", "Yes, spa/luxury upgrade", "I'm not sure"],
      },
      {
        id: "q3",
        text: "Would you like nail art on your toes?",
        options: ["No, solid color only", "Simple design", "Detailed nail art", "I'm not sure"],
      },
    ],
    rules: [
      { if: ["Yes, gel polish"], recommend: "Gel Removal Add-On", outcome: "recommend" },
      { if: ["callus treatment", "spa/luxury upgrade"], recommend: "Spa Pedicure Upgrade", outcome: "recommend" },
      { if: ["Detailed nail art"], recommend: "Nail Art Add-On", outcome: "recommend" },
    ],
  },
  {
    serviceCategory: "Nail Art / Add-Ons",
    questions: [
      {
        id: "q1",
        text: "Do you already have a base service booked or completed?",
        options: ["Yes, I have a base service", "No, I only want nail art", "I'm not sure"],
      },
      {
        id: "q2",
        text: "How complex is the design you have in mind?",
        options: ["Simple (one or two accents)", "Moderate (pattern or gradient)", "Complex / detailed artwork", "I want to show a reference photo"],
      },
      {
        id: "q3",
        text: "Do you have an inspiration photo?",
        options: ["Yes, I'll upload one", "No, I'll describe it", "I'm flexible / open to suggestions"],
      },
    ],
    rules: [
      { if: ["No, I only want nail art"], recommend: "Gel Manicure + Nail Art", outcome: "review" },
      { if: ["Complex / detailed artwork", "I want to show a reference photo"], recommend: "Tech Review for Pricing", outcome: "review" },
    ],
  },
  {
    serviceCategory: "Removal / Soak-Off",
    questions: [
      {
        id: "q1",
        text: "What product are you having removed?",
        options: ["Gel polish", "Acrylic nails", "Dip powder", "Hard gel / builder gel", "I'm not sure"],
      },
      {
        id: "q2",
        text: "Are you booking another service after the removal?",
        options: ["Yes, a new set or manicure", "No, just removal", "I'm not sure yet"],
      },
      {
        id: "q3",
        text: "Are your nails experiencing any pain, lifting, or damage?",
        options: ["No, they look fine", "Some lifting", "Pain or significant damage", "I'm not sure"],
      },
    ],
    rules: [
      { if: ["Yes, a new set or manicure"], recommend: "Bundle Removal + New Service", outcome: "recommend" },
      { if: ["Pain or significant damage"], recommend: "Tech Review", outcome: "review" },
    ],
  },
  {
    serviceCategory: "Repair",
    questions: [
      {
        id: "q1",
        text: "How many nails need to be repaired?",
        options: ["Just one nail", "2 nails", "3 or more nails", "I'm not sure"],
      },
      {
        id: "q2",
        text: "How long ago was your last fill or full set?",
        options: ["Less than 3 weeks", "3–4 weeks", "5 weeks or more", "I'm not sure"],
      },
      {
        id: "q3",
        text: "What type of product is on your nails?",
        options: ["Acrylic", "Gel / Builder Gel", "Dip powder", "I'm not sure"],
      },
    ],
    rules: [
      { if: ["3 or more nails"], recommend: "Acrylic Fill or Full Set", outcome: "recommend" },
      { if: ["5 weeks or more"], recommend: "Full Set", outcome: "review" },
    ],
  },
  {
    serviceCategory: "Press-On Nails",
    questions: [
      {
        id: "q1",
        text: "Do you know your nail sizes?",
        options: ["Yes, I have my measurements", "No, I need a sizing kit", "I'm not sure"],
      },
      {
        id: "q2",
        text: "What type of design are you looking for?",
        options: ["Solid color / simple", "Custom artwork", "Detailed / intricate design", "I'm not sure"],
      },
      {
        id: "q3",
        text: "When do you need the press-ons by?",
        options: ["Within a week", "1–2 weeks", "Flexible timeline", "I'm not sure"],
      },
    ],
    rules: [
      { if: ["No, I need a sizing kit"], recommend: "Sizing Kit / Consultation", outcome: "recommend" },
      { if: ["Custom artwork", "Detailed / intricate design"], recommend: "Custom Quote Approval", outcome: "review" },
    ],
  },
  {
    serviceCategory: "Custom / Not Sure",
    questions: [
      {
        id: "q1",
        text: "What is the main thing you'd like done at this appointment?",
        options: ["New set of nails", "Fill or maintenance", "Remove existing nails", "Nail art or design only", "I'm not sure"],
      },
      {
        id: "q2",
        text: "Do you currently have any product on your nails?",
        options: ["No, bare nails", "Yes, acrylic", "Yes, gel or dip", "I'm not sure"],
      },
      {
        id: "q3",
        text: "How would you describe your nail goals?",
        options: ["Natural and low-maintenance", "Trendy and expressive", "Long and dramatic", "I'm open to suggestions"],
      },
    ],
    rules: [
      { if: ["New set of nails", "Long and dramatic"], recommend: "Acrylic Full Set or Gel-X", outcome: "review" },
      { if: ["Fill or maintenance"], recommend: "Acrylic Fill", outcome: "recommend" },
      { if: ["Remove existing nails"], recommend: "Removal / Soak-Off", outcome: "recommend" },
      { if: ["Nail art or design only"], recommend: "Nail Art / Add-Ons", outcome: "recommend" },
      { if: ["I'm not sure", "I'm open to suggestions"], recommend: "Tech Review", outcome: "review" },
    ],
  },
];

// ─── Seed helper ─────────────────────────────────────────────────────────────

export async function seedSmartMatchDefaults() {
  const db = await getDb();
  if (!db) return;
  for (const cfg of SYSTEM_DEFAULTS) {
    const existing = await db
      .select({ id: smartMatchConfigs.id })
      .from(smartMatchConfigs)
      .where(and(isNull(smartMatchConfigs.techId), eq(smartMatchConfigs.serviceCategory, cfg.serviceCategory)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(smartMatchConfigs).values({
        techId: null,
        serviceCategory: cfg.serviceCategory,
        questions: cfg.questions,
        rules: cfg.rules,
        isEnabled: true,
      });
    }
  }
}

// ─── Evaluation engine ───────────────────────────────────────────────────────

export function evaluateSmartMatch(
  answers: Record<string, string>,
  rules: SMRule[]
): { outcome: "match" | "recommend" | "review"; recommendedService: string | null } {
  const allAnswers = Object.values(answers).join(" ").toLowerCase();

  for (const rule of rules) {
    const triggered = rule.if.every((keyword) =>
      allAnswers.includes(keyword.toLowerCase())
    );
    if (triggered) {
      return { outcome: rule.outcome, recommendedService: rule.recommend };
    }
  }

  return { outcome: "match", recommendedService: null };
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

/** Returns the tech-specific config if one exists, otherwise the system default. */
export async function getSmartMatchConfig(techId: number, serviceCategory: string) {
  const db = await getDb();
  if (!db) return null;
  // 1. Try tech override
  const techCfg = await db
    .select()
    .from(smartMatchConfigs)
    .where(and(eq(smartMatchConfigs.techId, techId), eq(smartMatchConfigs.serviceCategory, serviceCategory)))
    .limit(1);
  if (techCfg.length > 0) return techCfg[0];

  // 2. Fall back to system default
  const sysCfg = await db
    .select()
    .from(smartMatchConfigs)
    .where(and(isNull(smartMatchConfigs.techId), eq(smartMatchConfigs.serviceCategory, serviceCategory)))
    .limit(1);
  return sysCfg[0] ?? null;
}

/** Returns all categories with their effective config for a tech (for the dashboard editor). */
export async function getAllSmartMatchConfigsForTech(techId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all system defaults
  const defaults = await db
    .select()
    .from(smartMatchConfigs)
    .where(isNull(smartMatchConfigs.techId));

  // Get all tech overrides
  const overrides = await db
    .select()
    .from(smartMatchConfigs)
    .where(eq(smartMatchConfigs.techId, techId));

  const overrideMap = new Map(overrides.map((o: typeof smartMatchConfigs.$inferSelect) => [o.serviceCategory, o]));

  return (defaults as (typeof smartMatchConfigs.$inferSelect)[]).map((d) => ({
    systemDefault: d,
    techOverride: overrideMap.get(d.serviceCategory) ?? null,
    effective: overrideMap.get(d.serviceCategory) ?? d,
  }));
}

/** Upsert a tech override config. */
export async function upsertSmartMatchConfig(
  techId: number,
  serviceCategory: string,
  data: Partial<{ questions: SMQuestion[]; rules: SMRule[]; isEnabled: boolean }>
) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select({ id: smartMatchConfigs.id })
    .from(smartMatchConfigs)
    .where(and(eq(smartMatchConfigs.techId, techId), eq(smartMatchConfigs.serviceCategory, serviceCategory)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(smartMatchConfigs)
      .set({ ...data })
      .where(eq(smartMatchConfigs.id, existing[0].id));
  } else {
    // Clone system default then apply overrides
    const sysCfg = await db
      .select()
      .from(smartMatchConfigs)
      .where(and(isNull(smartMatchConfigs.techId), eq(smartMatchConfigs.serviceCategory, serviceCategory)))
      .limit(1);

    const base = sysCfg[0];
    await db.insert(smartMatchConfigs).values({
      techId,
      serviceCategory,
      questions: data.questions ?? (base?.questions as SMQuestion[]) ?? [],
      rules: data.rules ?? (base?.rules as SMRule[]) ?? [],
      isEnabled: data.isEnabled ?? true,
    });
  }
}

/** Save a client's questionnaire response and flag the booking if needed. */
export async function saveSmartMatchResponse(params: {
  bookingId: number;
  techId: number;
  serviceCategory: string;
  answers: Record<string, string>;
  outcome: "match" | "recommend" | "review";
  recommendedService: string | null;
  photoUrls: string[];
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(smartMatchResponses).values({
    bookingId: params.bookingId,
    techId: params.techId,
    serviceCategory: params.serviceCategory,
    answers: params.answers,
    outcome: params.outcome,
    recommendedService: params.recommendedService ?? undefined,
    photoUrls: params.photoUrls,
  });

  if (params.outcome === "review") {
    await db
      .update(bookings)
      .set({
        needsReview: true,
        reviewAnswers: params.answers,
        reviewRecommendedService: params.recommendedService ?? undefined,
        reviewPhotoUrls: params.photoUrls,
      })
      .where(eq(bookings.id, params.bookingId));
  }
}

/** Tech review action on a flagged booking. */
export async function applyTechReviewAction(
  bookingId: number,
  action: "approve" | "changeService" | "requestInfo" | "adjustPriceDuration",
  payload?: { serviceType?: string; techNotes?: string; duration?: number }
) {
  const db = await getDb();
  if (!db) return;
  const updates: Partial<typeof bookings.$inferInsert> = {
    needsReview: false,
  };

  if (action === "approve") {
    updates.status = "confirmed";
  } else if (action === "changeService" && payload?.serviceType) {
    updates.serviceType = payload.serviceType;
    updates.status = "confirmed";
  } else if (action === "requestInfo") {
    updates.needsReview = true; // keep flagged
    updates.techNotes = payload?.techNotes;
  } else if (action === "adjustPriceDuration") {
    if (payload?.duration) updates.duration = payload.duration;
    updates.techNotes = payload?.techNotes;
    updates.status = "confirmed";
  }

  await db.update(bookings).set(updates).where(eq(bookings.id, bookingId));
}

/** Check if Smart Match is enabled for a given tech + service. */
export async function isSmartMatchEnabled(techId: number, serviceId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  // 1. Check global tech toggle
  const techRow = await db
    .select({ smartMatchEnabled: users.smartMatchEnabled })
    .from(users)
    .where(eq(users.id, techId))
    .limit(1);
  if (!techRow[0]?.smartMatchEnabled) return false;

  // 2. Check per-service toggle
  const svcRow = await db
    .select({ smartMatchEnabled: techServices.smartMatchEnabled })
    .from(techServices)
    .where(eq(techServices.id, serviceId))
    .limit(1);
  if (!svcRow[0]?.smartMatchEnabled) return false;

  return true;
}

export async function getSmartMatchGlobalEnabled(techId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  const rows = await db.select({ smartMatchEnabled: users.smartMatchEnabled }).from(users).where(eq(users.id, techId)).limit(1);
  return rows[0]?.smartMatchEnabled ?? true;
}

export async function setSmartMatchGlobalEnabled(techId: number, enabled: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ smartMatchEnabled: enabled }).where(eq(users.id, techId));
}
