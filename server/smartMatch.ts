/**
 * Smart Service Match — seed data, evaluation engine, and DB helpers.
 * Outcome types: match | recommend | addon | review | bundle
 */
import { getDb } from "./db";
import { smartMatchConfigs, smartMatchResponses, bookings, techServices, users } from "../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";

export interface SMQuestion {
  id: string;
  text: string;
  options: string[];
  allowsPhoto?: boolean;
}
export interface SMRule {
  if: string[];
  recommend: string;
  outcome: "match" | "recommend" | "addon" | "review" | "bundle";
  message?: string;
}
export interface SMConfig {
  serviceCategory: string;
  questions: SMQuestion[];
  rules: SMRule[];
  supportsPhotoUpload?: boolean;
}
export interface SMEvalResult {
  outcome: "match" | "recommend" | "addon" | "review" | "bundle";
  recommendedService: string | null;
  message: string | null;
}

export const SYSTEM_DEFAULTS: SMConfig[] = [
  {
    serviceCategory: "Gel Manicure",
    questions: [
      { id: "q1", text: "Do you currently have anything on your nails that needs to be removed?", options: ["No, my nails are bare", "Yes, regular polish", "Yes, gel polish", "Yes, acrylic, dip, or extensions", "I'm not sure"] },
      { id: "q2", text: "Are you wanting to add length?", options: ["No, natural nail only", "Maybe a little", "Yes, I want extensions", "I'm not sure"] },
      { id: "q3", text: "What type of design are you wanting?", options: ["One solid color", "Simple design, French, or chrome", "Detailed nail art", "I'm not sure yet"] },
    ],
    rules: [
      { if: ["Yes, acrylic, dip, or extensions"], recommend: "Removal / Soak-Off", outcome: "addon", message: "It looks like you'll need a removal first. Would you like to add Removal / Soak-Off to your booking?" },
      { if: ["Yes, I want extensions"], recommend: "Gel-X / Soft Gel Extensions", outcome: "recommend", message: "Since you want added length, Gel-X / Soft Gel Extensions might be a better fit for you." },
      { if: ["Detailed nail art"], recommend: "Nail Art / Add-Ons", outcome: "addon", message: "For detailed nail art, we recommend adding a Nail Art / Add-Ons service to your booking." },
    ],
  },
  {
    serviceCategory: "Structured Gel / Builder Gel",
    questions: [
      { id: "q1", text: "Do you currently have any product on your nails?", options: ["No, my nails are bare", "Yes, gel polish only", "Yes, structured gel or builder gel", "Yes, acrylic or dip", "I'm not sure"] },
      { id: "q2", text: "What is your main goal for this appointment?", options: ["Strengthen and protect my natural nails", "Add a little length", "Add significant length with extensions", "Fill in grown-out structured gel", "I'm not sure"] },
      { id: "q3", text: "What type of finish are you going for?", options: ["Solid color or nude", "Simple design or French", "Detailed nail art", "I'm not sure yet"] },
    ],
    rules: [
      { if: ["Add significant length with extensions"], recommend: "Gel-X / Soft Gel Extensions", outcome: "recommend", message: "For significant length, Gel-X / Soft Gel Extensions would be a better fit." },
      { if: ["Yes, acrylic or dip"], recommend: "Removal / Soak-Off", outcome: "addon", message: "You'll need a removal before your structured gel. Would you like to add Removal / Soak-Off?" },
      { if: ["Fill in grown-out structured gel"], recommend: "Structured Gel / Builder Gel Fill", outcome: "recommend", message: "Since you have grown-out structured gel, a Structured Gel Fill would be the right service." },
      { if: ["Detailed nail art"], recommend: "Nail Art / Add-Ons", outcome: "addon", message: "For detailed nail art, we recommend adding a Nail Art / Add-Ons service." },
    ],
  },
  {
    serviceCategory: "Structured Gel / Builder Gel Fill",
    questions: [
      { id: "q1", text: "How long ago was your last structured gel appointment?", options: ["Less than 3 weeks", "3–4 weeks", "5 weeks or more", "I'm not sure"] },
      { id: "q2", text: "How is the current condition of your structured gel?", options: ["Mostly intact with minor grow-out", "Some lifting or chips", "Significant lifting or damage", "I'm not sure"] },
      { id: "q3", text: "Are you wanting to change your length or shape significantly?", options: ["No, keeping the same", "Minor adjustment", "Yes, significant change", "I'm not sure"] },
    ],
    rules: [
      { if: ["5 weeks or more"], recommend: "Structured Gel / Builder Gel", outcome: "recommend", message: "Since it's been 5+ weeks, a full Structured Gel set would give you the best results." },
      { if: ["Significant lifting or damage"], recommend: "Structured Gel / Builder Gel", outcome: "review", message: "Due to significant lifting or damage, your tech will review your nails before confirming the service." },
      { if: ["Yes, significant change"], recommend: "Structured Gel / Builder Gel", outcome: "review", message: "A significant shape or length change may require a full set. Your tech will review before confirming." },
    ],
  },
  {
    serviceCategory: "Acrylic Full Set",
    questions: [
      { id: "q1", text: "Do you currently have any product on your nails?", options: ["No, starting fresh with bare nails", "Yes, grown-out acrylics that need a fill", "Yes, I need removal before a new set", "Yes, gel or dip powder", "I'm not sure"] },
      { id: "q2", text: "How much length are you looking for?", options: ["Short / natural looking", "Medium length", "Long / dramatic", "I'm not sure"] },
      { id: "q3", text: "What type of finish are you going for?", options: ["Solid color", "French tip", "Detailed nail art", "I'm not sure yet"] },
    ],
    rules: [
      { if: ["Yes, grown-out acrylics that need a fill"], recommend: "Acrylic Fill", outcome: "recommend", message: "It sounds like an Acrylic Fill would be the right service for you rather than a full new set." },
      { if: ["Yes, I need removal before a new set"], recommend: "Removal / Soak-Off", outcome: "addon", message: "You'll need a removal before your new set. Would you like to add Removal / Soak-Off?" },
      { if: ["Yes, gel or dip powder"], recommend: "Removal / Soak-Off", outcome: "addon", message: "You'll need a removal before your new set. Would you like to add Removal / Soak-Off?" },
      { if: ["Short / natural looking"], recommend: "Structured Gel / Builder Gel", outcome: "recommend", message: "For a short, natural look, Structured Gel / Builder Gel might be a better fit than acrylics." },
      { if: ["Detailed nail art"], recommend: "Nail Art / Add-Ons", outcome: "addon", message: "For detailed nail art, we recommend adding a Nail Art / Add-Ons service to your booking." },
    ],
  },
  {
    serviceCategory: "Acrylic Fill",
    questions: [
      { id: "q1", text: "How long ago was your last acrylic fill?", options: ["Less than 3 weeks", "3–4 weeks", "5 weeks or more", "I'm not sure"] },
      { id: "q2", text: "How many nails are broken, lifted, or missing?", options: ["None — all nails are intact", "1–2 nails", "3 or more nails", "I'm not sure"] },
      { id: "q3", text: "Are you wanting a major shape or length change?", options: ["No, keeping the same shape and length", "Minor adjustment", "Yes, significant change", "I'm not sure"] },
    ],
    rules: [
      { if: ["5 weeks or more"], recommend: "Acrylic Full Set", outcome: "recommend", message: "Since it's been 5+ weeks, a full Acrylic Set would give you the best results." },
      { if: ["3 or more nails"], recommend: "Acrylic Full Set", outcome: "recommend", message: "With 3 or more broken or missing nails, a full Acrylic Set is recommended." },
      { if: ["Yes, significant change"], recommend: "Extended Fill", outcome: "recommend", message: "A significant shape or length change may require an Extended Fill or full set. Your tech will confirm." },
    ],
  },
  {
    serviceCategory: "Extended Fill",
    questions: [
      { id: "q1", text: "How long ago was your last fill?", options: ["3–4 weeks", "5–6 weeks", "More than 6 weeks", "I'm not sure"] },
      { id: "q2", text: "What is the main reason you need an extended fill?", options: ["Significant grow-out", "Major shape or length change", "Multiple broken nails", "My tech recommended it", "I'm not sure"] },
      { id: "q3", text: "What product do you currently have on your nails?", options: ["Acrylic", "Structured gel / builder gel", "I'm not sure"] },
    ],
    rules: [
      { if: ["More than 6 weeks"], recommend: "Acrylic Full Set", outcome: "recommend", message: "With more than 6 weeks of grow-out, a full new set may be a better option." },
      { if: ["Multiple broken nails"], recommend: "Acrylic Full Set", outcome: "review", message: "Your tech will review the condition of your nails to determine if a full set is needed." },
    ],
  },
  {
    serviceCategory: "Gel-X / Soft Gel Extensions",
    questions: [
      { id: "q1", text: "Are you looking to add length with extensions?", options: ["Yes, I want Gel-X or soft gel extensions", "No, I just want to strengthen my natural nails", "I'm not sure"] },
      { id: "q2", text: "Do you have any existing product on your nails?", options: ["No, bare nails", "Yes, gel polish only", "Yes, acrylic or hard gel", "Yes, dip powder", "I'm not sure"] },
      { id: "q3", text: "What type of design are you wanting?", options: ["Solid color", "Simple design or French", "Detailed nail art", "I'm not sure yet"] },
    ],
    rules: [
      { if: ["No, I just want to strengthen my natural nails"], recommend: "Structured Gel / Builder Gel", outcome: "recommend", message: "For strengthening without added length, Structured Gel / Builder Gel is a better fit." },
      { if: ["Yes, acrylic or hard gel"], recommend: "Removal / Soak-Off", outcome: "addon", message: "You'll need a removal before your Gel-X. Would you like to add Removal / Soak-Off?" },
      { if: ["Yes, dip powder"], recommend: "Removal / Soak-Off", outcome: "addon", message: "You'll need a removal before your Gel-X. Would you like to add Removal / Soak-Off?" },
      { if: ["Detailed nail art"], recommend: "Nail Art / Add-Ons", outcome: "addon", message: "For detailed nail art, we recommend adding a Nail Art / Add-Ons service to your booking." },
    ],
  },
  {
    serviceCategory: "Dip Powder",
    questions: [
      { id: "q1", text: "Do you currently have any product on your nails?", options: ["No, bare nails", "Yes, dip powder", "Yes, acrylic or extensions", "Yes, gel polish", "I'm not sure"] },
      { id: "q2", text: "Are you looking to add any length?", options: ["No, keeping my natural nail length", "Yes, a little extra length", "Yes, significant length", "I'm not sure"] },
      { id: "q3", text: "What type of finish are you going for?", options: ["Solid color", "Ombré or gradient", "French tip", "I'm not sure yet"] },
    ],
    rules: [
      { if: ["Yes, acrylic or extensions"], recommend: "Removal / Soak-Off", outcome: "addon", message: "You'll need a removal before your dip powder. Would you like to add Removal / Soak-Off?" },
      { if: ["Yes, significant length"], recommend: "Acrylic Full Set", outcome: "recommend", message: "For significant added length, an Acrylic Full Set or Gel-X Extensions would give better results." },
    ],
  },
  {
    serviceCategory: "Manicure",
    questions: [
      { id: "q1", text: "What type of finish are you looking for?", options: ["Regular polish", "Gel polish (longer lasting)", "No polish, just shaping and cuticle care", "I'm not sure"] },
      { id: "q2", text: "Do you currently have any product on your nails?", options: ["No, bare nails", "Yes, regular polish", "Yes, acrylic or extensions", "Yes, gel or dip", "I'm not sure"] },
      { id: "q3", text: "Are you looking to add any length?", options: ["No, natural nail only", "Yes, I'd like extensions", "I'm not sure"] },
    ],
    rules: [
      { if: ["Gel polish (longer lasting)"], recommend: "Gel Manicure", outcome: "recommend", message: "For gel polish, a Gel Manicure would be the right service." },
      { if: ["Yes, acrylic or extensions"], recommend: "Removal / Soak-Off", outcome: "addon", message: "You'll need a removal before your manicure. Would you like to add Removal / Soak-Off?" },
      { if: ["Yes, I'd like extensions"], recommend: "Gel-X / Soft Gel Extensions", outcome: "recommend", message: "For added length, Gel-X / Soft Gel Extensions would be a better fit." },
    ],
  },
  {
    serviceCategory: "Pedicure",
    questions: [
      { id: "q1", text: "What type of pedicure are you looking for?", options: ["Basic pedicure with regular polish", "Gel pedicure (longer lasting polish)", "Spa pedicure with callus treatment", "I'm not sure"] },
      { id: "q2", text: "Do you have any gel polish on your toenails that needs to be removed?", options: ["No, bare nails", "Yes, gel polish", "Yes, regular polish", "I'm not sure"] },
      { id: "q3", text: "Would you like any nail art on your toes?", options: ["No, just a solid color", "Yes, a simple design or accent nail", "Yes, detailed nail art", "I'm not sure"] },
    ],
    rules: [
      { if: ["Yes, gel polish"], recommend: "Removal / Soak-Off", outcome: "addon", message: "Gel removal will be needed before your pedicure. Would you like to add Removal / Soak-Off?" },
      { if: ["Spa pedicure with callus treatment"], recommend: "Spa Pedicure Upgrade", outcome: "review", message: "Your tech will confirm the spa upgrade pricing and availability before confirming." },
      { if: ["Yes, detailed nail art"], recommend: "Nail Art / Add-Ons", outcome: "addon", message: "For detailed nail art on your toes, we recommend adding a Nail Art / Add-Ons service." },
    ],
  },
  {
    serviceCategory: "Nail Art / Add-Ons",
    supportsPhotoUpload: true,
    questions: [
      { id: "q1", text: "Do you already have a base service booked or completed?", options: ["Yes, I have a base service", "No, I only want nail art", "I'm not sure"] },
      { id: "q2", text: "How complex is the design you have in mind?", options: ["Simple — one or two accent nails", "Moderate — pattern, gradient, or chrome", "Complex / detailed artwork", "I want to show a reference photo"] },
      { id: "q3", text: "Do you have an inspiration photo?", options: ["Yes, I'll upload one", "No, I'll describe it", "I'm flexible / open to suggestions"], allowsPhoto: true },
    ],
    rules: [
      { if: ["No, I only want nail art"], recommend: "Gel Manicure", outcome: "review", message: "Nail art is typically added on top of a base service. Your tech will review and confirm what's needed." },
      { if: ["Complex / detailed artwork", "I want to show a reference photo"], recommend: "Tech Review for Pricing", outcome: "review", message: "Complex designs require custom pricing. Your tech will review your request before confirming." },
    ],
  },
  {
    serviceCategory: "Removal / Soak-Off",
    questions: [
      { id: "q1", text: "What product are you having removed?", options: ["Gel polish", "Acrylic nails", "Dip powder", "Hard gel / builder gel", "I'm not sure"] },
      { id: "q2", text: "Are you booking another service after the removal?", options: ["Yes, a new set or manicure", "No, just the removal", "I'm not sure yet"] },
      { id: "q3", text: "Are your nails experiencing any pain, significant lifting, or damage?", options: ["No, they look fine", "Some minor lifting", "Pain or significant damage", "I'm not sure"] },
    ],
    rules: [
      { if: ["Yes, a new set or manicure"], recommend: "Bundle Removal + New Service", outcome: "bundle", message: "Great — we can bundle your removal with your next service. Your tech will confirm the combined pricing." },
      { if: ["Pain or significant damage"], recommend: "Tech Review", outcome: "review", message: "Due to pain or damage, your tech will review your nails before proceeding. We want to make sure your nails are healthy." },
    ],
  },
  {
    serviceCategory: "Repair",
    questions: [
      { id: "q1", text: "How many nails need to be repaired?", options: ["Just one nail", "2 nails", "3 or more nails", "I'm not sure"] },
      { id: "q2", text: "How long ago was your last fill or full set?", options: ["Less than 3 weeks", "3–4 weeks", "5 weeks or more", "I'm not sure"] },
      { id: "q3", text: "What type of product is currently on your nails?", options: ["Acrylic", "Structured gel / builder gel", "Dip powder", "I'm not sure"] },
    ],
    rules: [
      { if: ["3 or more nails"], recommend: "Acrylic Fill", outcome: "recommend", message: "With 3 or more nails needing repair, an Acrylic Fill or Full Set would be more efficient." },
      { if: ["5 weeks or more"], recommend: "Acrylic Full Set", outcome: "review", message: "Since it's been 5+ weeks, your tech will review whether a fill or full set is the better option." },
    ],
  },
  {
    serviceCategory: "Press-On Nails",
    questions: [
      { id: "q1", text: "Do you know your nail sizes?", options: ["Yes, I have my measurements", "No, I need a sizing kit or consultation", "I'm not sure"] },
      { id: "q2", text: "What type of design are you looking for?", options: ["Solid color or simple design", "Custom artwork", "Detailed / intricate design", "I'm not sure"] },
      { id: "q3", text: "When do you need the press-ons by?", options: ["Within a week", "1–2 weeks out", "Flexible timeline", "I'm not sure"] },
    ],
    rules: [
      { if: ["No, I need a sizing kit or consultation"], recommend: "Sizing Kit / Consultation", outcome: "review", message: "Your tech will need to size your nails first. They'll confirm the appointment details before proceeding." },
      { if: ["Custom artwork", "Detailed / intricate design"], recommend: "Custom Quote Approval", outcome: "review", message: "Custom press-on designs require a quote. Your tech will review your request and confirm pricing." },
    ],
  },
  {
    serviceCategory: "Custom / Not Sure",
    supportsPhotoUpload: true,
    questions: [
      { id: "q1", text: "What is the main thing you'd like done at this appointment?", options: ["A brand new set of nails", "Fill or maintenance on existing nails", "Remove my existing nails", "Nail art or design only", "I'm not sure — I need help deciding"] },
      { id: "q2", text: "Do you currently have any product on your nails?", options: ["No, bare nails", "Yes, acrylic", "Yes, gel or dip", "I'm not sure"] },
      { id: "q3", text: "Are you looking to add length?", options: ["No, I want to keep my natural nail length", "Yes, a little extra length", "Yes, I want full extensions", "I'm not sure"] },
      { id: "q4", text: "What finish are you going for?", options: ["Gel (shiny, long-lasting)", "Acrylic (strong, customizable length)", "Dip powder (durable, no UV lamp)", "Natural / no product", "I'm not sure"] },
      { id: "q5", text: "Do you have an inspiration photo?", options: ["Yes, I'll upload one", "No, I'll describe it", "I'm flexible"], allowsPhoto: true },
    ],
    rules: [
      { if: ["Remove my existing nails"], recommend: "Removal / Soak-Off", outcome: "recommend", message: "It sounds like you need a Removal / Soak-Off service." },
      { if: ["Yes, I want full extensions", "Acrylic (strong, customizable length)"], recommend: "Acrylic Full Set", outcome: "recommend", message: "For full extensions with acrylic, an Acrylic Full Set would be the right choice." },
      { if: ["Yes, I want full extensions", "Gel (shiny, long-lasting)"], recommend: "Gel-X / Soft Gel Extensions", outcome: "recommend", message: "For gel extensions, Gel-X / Soft Gel Extensions would be a great fit." },
      { if: ["Fill or maintenance on existing nails", "Yes, acrylic"], recommend: "Acrylic Fill", outcome: "recommend", message: "It sounds like an Acrylic Fill is what you need." },
      { if: ["Fill or maintenance on existing nails", "Yes, gel or dip"], recommend: "Structured Gel / Builder Gel Fill", outcome: "recommend", message: "It sounds like a Structured Gel Fill would be the right service." },
      { if: ["Nail art or design only"], recommend: "Nail Art / Add-Ons", outcome: "recommend", message: "For nail art only, the Nail Art / Add-Ons service is what you're looking for." },
      { if: ["Dip powder (durable, no UV lamp)"], recommend: "Dip Powder", outcome: "recommend", message: "Dip Powder sounds like the right fit for you." },
      { if: ["Natural / no product"], recommend: "Manicure", outcome: "recommend", message: "A classic Manicure would be the right service for you." },
      { if: ["I'm not sure — I need help deciding"], recommend: "Tech Review", outcome: "review", message: "No problem! Your tech will review your answers and help you choose the best service." },
    ],
  },
];

export function evaluateSmartMatchRules(
  answers: Record<string, string>,
  rules: SMRule[]
): SMEvalResult {
  const answerValues = Object.values(answers);
  for (const rule of rules) {
    const allMatch = rule.if.every((condition) =>
      answerValues.some((answer) =>
        answer.toLowerCase().includes(condition.toLowerCase())
      )
    );
    if (allMatch) {
      return {
        outcome: rule.outcome,
        recommendedService: rule.recommend,
        message: rule.message ?? null,
      };
    }
  }
  return { outcome: "match", recommendedService: null, message: null };
}

export async function seedSystemDefaults() {
  const db = await getDb();
  if (!db) return;
  for (const config of SYSTEM_DEFAULTS) {
    const existing = await db.select({ id: smartMatchConfigs.id }).from(smartMatchConfigs)
      .where(and(isNull(smartMatchConfigs.techId), eq(smartMatchConfigs.serviceCategory, config.serviceCategory))).limit(1);
    if (existing.length > 0) {
      await db.update(smartMatchConfigs).set({ questions: config.questions, rules: config.rules, isEnabled: true }).where(eq(smartMatchConfigs.id, existing[0].id));
    } else {
      await db.insert(smartMatchConfigs).values({ techId: null, serviceCategory: config.serviceCategory, questions: config.questions, rules: config.rules, isEnabled: true });
    }
  }
}

export async function getSmartMatchConfig(techId: number, serviceCategory: string) {
  const db = await getDb();
  if (!db) return null;
  const techOverride = await db.select().from(smartMatchConfigs)
    .where(and(eq(smartMatchConfigs.techId, techId), eq(smartMatchConfigs.serviceCategory, serviceCategory))).limit(1);
  if (techOverride.length > 0) return techOverride[0];
  const systemDefault = await db.select().from(smartMatchConfigs)
    .where(and(isNull(smartMatchConfigs.techId), eq(smartMatchConfigs.serviceCategory, serviceCategory))).limit(1);
  return systemDefault[0] ?? null;
}

export async function getAllSmartMatchConfigsForTech(techId: number) {
  const db = await getDb();
  if (!db) return [];
  const defaults = await db.select().from(smartMatchConfigs).where(isNull(smartMatchConfigs.techId));
  const overrides = await db.select().from(smartMatchConfigs).where(eq(smartMatchConfigs.techId, techId));
  const overrideMap = new Map(overrides.map((o: typeof smartMatchConfigs.$inferSelect) => [o.serviceCategory, o]));
  return (defaults as (typeof smartMatchConfigs.$inferSelect)[]).map((d) => ({
    systemDefault: d,
    techOverride: overrideMap.get(d.serviceCategory) ?? null,
    effective: overrideMap.get(d.serviceCategory) ?? d,
  }));
}

export async function upsertSmartMatchConfig(
  techId: number,
  serviceCategory: string,
  data: Partial<{ questions: SMQuestion[]; rules: SMRule[]; isEnabled: boolean }>
) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: smartMatchConfigs.id }).from(smartMatchConfigs)
    .where(and(eq(smartMatchConfigs.techId, techId), eq(smartMatchConfigs.serviceCategory, serviceCategory))).limit(1);
  if (existing.length > 0) {
    await db.update(smartMatchConfigs).set({ ...data }).where(eq(smartMatchConfigs.id, existing[0].id));
  } else {
    const sysCfg = await db.select().from(smartMatchConfigs)
      .where(and(isNull(smartMatchConfigs.techId), eq(smartMatchConfigs.serviceCategory, serviceCategory))).limit(1);
    const base = sysCfg[0];
    await db.insert(smartMatchConfigs).values({
      techId, serviceCategory,
      questions: data.questions ?? (base?.questions as SMQuestion[]) ?? [],
      rules: data.rules ?? (base?.rules as SMRule[]) ?? [],
      isEnabled: data.isEnabled ?? true,
    });
  }
}

export async function saveSmartMatchResponse(params: {
  bookingId: number; techId: number; serviceCategory: string;
  answers: Record<string, string>;
  outcome: "match" | "recommend" | "addon" | "review" | "bundle";
  recommendedService: string | null; photoUrls: string[];
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(smartMatchResponses).values({
    bookingId: params.bookingId, techId: params.techId, serviceCategory: params.serviceCategory,
    answers: params.answers, outcome: params.outcome,
    recommendedService: params.recommendedService ?? undefined, photoUrls: params.photoUrls,
  });
  if (params.outcome === "review" || params.outcome === "bundle") {
    await db.update(bookings).set({
      needsReview: true, reviewAnswers: params.answers,
      reviewRecommendedService: params.recommendedService ?? undefined, reviewPhotoUrls: params.photoUrls,
    }).where(eq(bookings.id, params.bookingId));
  }
}

export async function applyTechReviewAction(
  bookingId: number,
  action: "approve" | "changeService" | "requestInfo" | "adjustPriceDuration",
  payload?: { serviceType?: string; techNotes?: string; duration?: number }
) {
  const db = await getDb();
  if (!db) return;
  const updates: Partial<typeof bookings.$inferInsert> = { needsReview: false };
  if (action === "approve") { updates.status = "confirmed"; }
  else if (action === "changeService" && payload?.serviceType) { updates.serviceType = payload.serviceType; updates.status = "confirmed"; }
  else if (action === "requestInfo") { updates.needsReview = true; updates.techNotes = payload?.techNotes; }
  else if (action === "adjustPriceDuration") { if (payload?.duration) updates.duration = payload.duration; updates.techNotes = payload?.techNotes; updates.status = "confirmed"; }
  await db.update(bookings).set(updates).where(eq(bookings.id, bookingId));
}

export async function isSmartMatchEnabled(techId: number, serviceId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const techRow = await db.select({ smartMatchEnabled: users.smartMatchEnabled }).from(users).where(eq(users.id, techId)).limit(1);
  if (!techRow[0]?.smartMatchEnabled) return false;
  const svcRow = await db.select({ smartMatchEnabled: techServices.smartMatchEnabled }).from(techServices).where(eq(techServices.id, serviceId)).limit(1);
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
