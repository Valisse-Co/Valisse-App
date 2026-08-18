export type SmartServiceMatchOutcome = "match" | "recommendation" | "review";

export type SmartServiceQuestion = {
  id: string;
  text: string;
  options: string[];
  allowsPhoto?: boolean;
};

type SmartServiceRule = {
  /** Higher numbers take precedence when more than one rule applies. */
  priority: number;
  whenAll?: string[];
  whenAny?: string[];
  action: "review" | "recommend_service" | "add_service";
  service?: string;
  explanation: string;
};

export type SmartServiceMatchConfig = {
  serviceCategory: string;
  questions: SmartServiceQuestion[];
  rules: SmartServiceRule[];
};

export type SmartServiceMatchResult = {
  outcome: SmartServiceMatchOutcome;
  recommendedService: string | null;
  recommendedAddOns: string[];
  explanation: string;
  needsReview: boolean;
};

const q = (id: string, text: string, options: string[], allowsPhoto = false): SmartServiceQuestion => ({ id, text, options, allowsPhoto });

/**
 * System-owned questionnaires. Technicians may enable a questionnaire for a
 * service, but cannot change the questions or matching logic.
 */
export const SMART_SERVICE_MATCH_CONFIGS: SmartServiceMatchConfig[] = [
  {
    serviceCategory: "Gel Manicure",
    questions: [
      q("removal", "Do you currently have anything on your nails that needs to be removed?", ["No, my nails are bare", "Yes, regular polish", "Yes, gel polish", "Yes, acrylic/dip/extensions", "I'm not sure"]),
      q("length", "Are you wanting to add length?", ["No, natural nail only", "Maybe a little", "Yes, I want extensions", "I'm not sure"]),
      q("design", "What type of design are you wanting?", ["One solid color", "Simple design/French/chrome", "Detailed nail art", "I'm not sure yet"]),
    ],
    rules: [
      { priority: 700, whenAll: ["Yes, I want extensions"], action: "recommend_service", service: "Gel-X / Soft Gel Extensions", explanation: "Added length is better supported by extensions than a gel manicure." },
      { priority: 500, whenAny: ["Yes, gel polish", "Yes, acrylic/dip/extensions"], action: "add_service", service: "Removal / Soak-Off", explanation: "Removal time may be needed before your new service." },
      { priority: 500, whenAll: ["Detailed nail art"], action: "add_service", service: "Nail Art / Add-Ons", explanation: "Detailed art may need additional time and pricing." },
    ],
  },
  {
    serviceCategory: "Structured Gel / Builder Gel",
    questions: [
      q("strength", "Are you wanting extra strength on your natural nails?", ["Yes, I want added strength", "No, just regular gel polish", "I want to add length", "I'm not sure"]),
      q("length", "What is your current nail length?", ["Short natural nails", "Medium natural nails", "Long natural nails", "I currently have extensions/acrylic/dip on"]),
      q("maintenance", "Are you needing a new set or maintenance on existing builder gel?", ["New set", "Fill/maintenance", "Removal and new set", "I'm not sure"]),
    ],
    rules: [
      { priority: 700, whenAll: ["No, just regular gel polish"], action: "recommend_service", service: "Gel Manicure", explanation: "A gel manicure is likely the better fit when added strength is not needed." },
      { priority: 700, whenAny: ["I want to add length"], action: "recommend_service", service: "Gel-X / Soft Gel Extensions", explanation: "Extensions are a better fit when you want added length." },
      { priority: 700, whenAll: ["Fill/maintenance"], action: "recommend_service", service: "Structured Gel / Builder Gel Fill", explanation: "A structured gel fill is likely the right maintenance service." },
      { priority: 500, whenAny: ["I currently have extensions/acrylic/dip on", "Removal and new set"], action: "add_service", service: "Removal / Soak-Off", explanation: "Existing product may need to be removed before your new set." },
    ],
  },
  {
    serviceCategory: "Structured Gel / Builder Gel Fill",
    questions: [
      q("lastAppointment", "How long has it been since your last structured gel appointment?", ["1–2 weeks", "3–4 weeks", "5+ weeks", "I'm not sure"]),
      q("condition", "Do you have lifting, cracks, broken nails, or missing product?", ["No", "1–2 nails", "3+ nails", "I'm not sure"]),
      q("change", "Are you changing the length, shape, or design significantly?", ["No, keeping it similar", "Small change", "Big change", "I'm not sure"]),
    ],
    rules: [
      { priority: 1000, whenAny: ["3+ nails"], action: "review", service: "Structured Gel / Builder Gel", explanation: "Several repairs may require a different service and a technician assessment." },
      { priority: 900, whenAny: ["5+ weeks", "Big change"], action: "review", service: "Structured Gel / Builder Gel", explanation: "The amount of grow-out or the requested change may require a full structured gel set." },
    ],
  },
  {
    serviceCategory: "Acrylic Full Set",
    questions: [
      q("currentProduct", "Do you currently have acrylic, dip, gel-x, or builder gel on your nails?", ["No, my nails are bare", "Yes, I need it removed first", "Yes, but I want to fill it", "I'm not sure"]),
      q("length", "Are you wanting length added with tips/forms?", ["Yes", "No, natural nail only", "Maybe a little", "I'm not sure"]),
      q("design", "What kind of design are you wanting?", ["Solid color", "French/chrome/simple design", "Detailed nail art/gems/3D art", "I'm not sure"]),
    ],
    rules: [
      { priority: 700, whenAll: ["Yes, but I want to fill it"], action: "recommend_service", service: "Acrylic Fill", explanation: "A fill may be a better fit when you are maintaining existing acrylic." },
      { priority: 700, whenAll: ["No, natural nail only"], action: "recommend_service", service: "Structured Gel / Builder Gel", explanation: "Structured gel or a gel manicure may be a better fit for natural nails without added length." },
      { priority: 500, whenAll: ["Yes, I need it removed first"], action: "add_service", service: "Removal / Soak-Off", explanation: "Removal time may be needed before a new acrylic set." },
      { priority: 500, whenAll: ["Detailed nail art/gems/3D art"], action: "add_service", service: "Nail Art / Add-Ons", explanation: "Detailed art can require additional time and pricing." },
    ],
  },
  {
    serviceCategory: "Acrylic Fill",
    questions: [
      q("lastAppointment", "How long has it been since your last acrylic appointment?", ["1–2 weeks", "3–4 weeks", "5+ weeks", "I'm not sure"]),
      q("condition", "Do you have any missing, lifted, cracked, or broken nails?", ["No", "1–2 nails", "3+ nails", "I'm not sure"]),
      q("change", "Are you changing the length, shape, or design significantly?", ["No, keeping it similar", "Small change", "Big change", "I'm not sure"]),
    ],
    rules: [
      { priority: 1000, whenAny: ["3+ nails"], action: "review", service: "Repair", explanation: "Several broken or missing nails need technician review before the appointment is confirmed." },
      { priority: 900, whenAny: ["5+ weeks", "Big change"], action: "review", service: "Extended Fill", explanation: "The grow-out or requested change may need an extended fill or a full set." },
    ],
  },
  {
    serviceCategory: "Extended Fill",
    questions: [
      q("lastAppointment", "How long has it been since your last acrylic appointment?", ["3–4 weeks", "5–6 weeks", "More than 6 weeks", "I'm not sure"]),
      q("condition", "Do you have any missing, lifted, cracked, or broken nails?", ["No", "1–2 nails", "3+ nails", "I'm not sure"]),
      q("change", "Are you changing the length, shape, or design significantly?", ["No, keeping it similar", "Small change", "Big change", "I'm not sure"]),
    ],
    rules: [
      { priority: 1000, whenAny: ["3+ nails"], action: "review", service: "Repair", explanation: "Several repairs need technician review before the appointment is confirmed." },
      { priority: 900, whenAny: ["More than 6 weeks"], action: "review", service: "Acrylic Full Set", explanation: "More than six weeks of grow-out may need a full new set." },
    ],
  },
  {
    serviceCategory: "Gel-X / Soft Gel Extensions",
    questions: [
      q("length", "Are you wanting length added?", ["Yes", "No", "Maybe a little", "I'm not sure"]),
      q("removal", "Do you currently have anything on your nails that needs removed?", ["No, bare nails", "Yes, gel polish", "Yes, acrylic/dip/builder gel/extensions", "I'm not sure"]),
      q("design", "What design level are you wanting?", ["Solid color", "Simple design/French/chrome", "Detailed nail art/gems/3D art", "I'm not sure yet"]),
    ],
    rules: [
      { priority: 700, whenAll: ["No"], action: "recommend_service", service: "Structured Gel / Builder Gel", explanation: "Structured gel or a gel manicure may be a better fit without added length." },
      { priority: 500, whenAny: ["Yes, gel polish", "Yes, acrylic/dip/builder gel/extensions"], action: "add_service", service: "Removal / Soak-Off", explanation: "Existing product may need removal before extensions." },
      { priority: 500, whenAll: ["Detailed nail art/gems/3D art"], action: "add_service", service: "Nail Art / Add-Ons", explanation: "Detailed art can require additional time and pricing." },
    ],
  },
  {
    serviceCategory: "Dip Powder",
    questions: [
      q("removal", "Are your nails currently bare or do you need something removed?", ["Bare nails", "Regular polish", "Gel polish", "Dip/acrylic/extensions", "I'm not sure"]),
      q("length", "Are you wanting to add length?", ["No, natural nail only", "Yes, I want tips/extensions", "Maybe", "I'm not sure"]),
      q("finish", "What finish/design are you wanting?", ["One color", "French/simple design", "Detailed nail art", "I'm not sure"]),
    ],
    rules: [
      { priority: 700, whenAll: ["Yes, I want tips/extensions"], action: "recommend_service", service: "Dip Powder with Tips", explanation: "Dip with tips is the better fit when you want added length." },
      { priority: 500, whenAny: ["Gel polish", "Dip/acrylic/extensions"], action: "add_service", service: "Removal / Soak-Off", explanation: "Existing product may need removal before your dip service." },
      { priority: 500, whenAll: ["Detailed nail art"], action: "add_service", service: "Nail Art / Add-Ons", explanation: "Detailed art can require additional time and pricing." },
    ],
  },
  {
    serviceCategory: "Manicure",
    questions: [
      q("polish", "Are you wanting polish with your manicure?", ["No polish", "Regular polish", "Gel polish", "I'm not sure"]),
      q("removal", "Do you currently have anything on your nails that needs removed?", ["No", "Regular polish", "Gel polish", "Acrylic/dip/extensions", "I'm not sure"]),
      q("extras", "Are you wanting nail art or added length?", ["No, basic manicure only", "Simple nail art", "Added length/extensions", "I'm not sure"]),
    ],
    rules: [
      { priority: 700, whenAll: ["Gel polish"], action: "recommend_service", service: "Gel Manicure", explanation: "A gel manicure is the right fit for gel polish." },
      { priority: 700, whenAll: ["Added length/extensions"], action: "recommend_service", service: "Gel-X / Soft Gel Extensions", explanation: "Extensions are the right fit when you want added length." },
      { priority: 500, whenAll: ["Acrylic/dip/extensions"], action: "add_service", service: "Removal / Soak-Off", explanation: "Existing product may need removal before your manicure." },
      { priority: 500, whenAll: ["Simple nail art"], action: "add_service", service: "Nail Art / Add-Ons", explanation: "Nail art may need additional time." },
    ],
  },
  {
    serviceCategory: "Pedicure",
    questions: [
      q("polish", "What type of polish are you wanting?", ["No polish", "Regular polish", "Gel polish", "I'm not sure"]),
      q("removal", "Do you currently have polish that needs removed?", ["No", "Regular polish", "Gel polish", "I'm not sure"]),
      q("upgrade", "Are you wanting anything beyond a basic pedicure?", ["No, basic pedicure", "Callus care/spa pedicure", "Nail art/French/chrome", "I'm not sure"]),
    ],
    rules: [
      { priority: 500, whenAll: ["Gel polish"], action: "add_service", service: "Removal / Soak-Off", explanation: "Gel removal may need extra time before your pedicure." },
      { priority: 500, whenAll: ["Callus care/spa pedicure"], action: "add_service", service: "Spa / Callus Pedicure Upgrade", explanation: "A spa or callus-care upgrade may need extra time and pricing." },
      { priority: 500, whenAll: ["Nail art/French/chrome"], action: "add_service", service: "Nail Art / Add-Ons", explanation: "Nail art may need extra time and pricing." },
    ],
  },
  {
    serviceCategory: "Nail Art / Add-Ons",
    questions: [
      q("base", "Are you booking nail art with another service?", ["Yes, with a manicure/full set/fill", "No, nail art only", "I already have an appointment booked", "I'm not sure"]),
      q("complexity", "What level of nail art are you wanting?", ["Simple: dots, lines, one accent nail", "Medium: French, chrome, aura, stickers", "Detailed: hand-painted, gems, 3D art, multiple designs", "I'm not sure"]),
      q("photo", "Do you have an inspiration photo?", ["Yes, I can upload it", "No, but I know what I want", "No, I want the tech to freestyle", "I'm not sure yet"], true),
    ],
    rules: [
      { priority: 900, whenAny: ["Detailed: hand-painted, gems, 3D art, multiple designs", "No, I want the tech to freestyle"], action: "review", service: "Nail Art / Add-Ons", explanation: "Detailed or freestyle nail art needs technician approval for time and price." },
      { priority: 700, whenAll: ["No, nail art only"], action: "review", service: "Gel Manicure", explanation: "Nail art usually needs a base service, so your technician will review the right appointment setup." },
    ],
  },
  {
    serviceCategory: "Removal / Soak-Off",
    questions: [
      q("product", "What needs to be removed?", ["Gel polish", "Dip powder", "Acrylic", "Gel-X/extensions", "Builder gel/structured gel", "I'm not sure"]),
      q("next", "Are you getting a new service after removal?", ["No, removal only", "Yes, gel manicure", "Yes, full set/extensions", "Yes, manicure/pedicure", "I'm not sure"]),
      q("damage", "Do you have lifting, pain, damage, or broken nails?", ["No", "Yes, lifting", "Yes, pain/damage", "Yes, broken/missing nails", "I'm not sure"]),
    ],
    rules: [
      { priority: 1000, whenAny: ["Yes, pain/damage", "Yes, broken/missing nails"], action: "review", service: "Removal / Soak-Off", explanation: "Your nail tech will review your nails before proceeding to make sure the appointment is appropriate." },
      { priority: 500, whenAll: ["Yes, gel manicure"], action: "add_service", service: "Gel Manicure", explanation: "Removal can be booked together with a gel manicure." },
      { priority: 500, whenAll: ["Yes, full set/extensions"], action: "add_service", service: "Acrylic Full Set", explanation: "Removal can be booked together with a new full set or extensions." },
      { priority: 500, whenAll: ["Yes, manicure/pedicure"], action: "add_service", service: "Manicure", explanation: "Removal can be booked together with a manicure or pedicure." },
    ],
  },
  {
    serviceCategory: "Repair",
    questions: [
      q("type", "What needs to be repaired?", ["One broken nail", "Multiple broken nails", "Lifted product", "Cracked natural nail", "Missing extension/acrylic", "I'm not sure"]),
      q("count", "How many nails need attention?", ["1 nail", "2 nails", "3+ nails", "I'm not sure"]),
      q("appointment", "Do you already have an upcoming appointment?", ["Yes", "No", "I need repair plus a new set/fill", "I'm not sure"]),
    ],
    rules: [
      { priority: 900, whenAll: ["3+ nails"], action: "review", service: "Acrylic Fill", explanation: "Multiple repairs may need a fill or new set, so a technician will review the appointment." },
      { priority: 500, whenAll: ["I need repair plus a new set/fill"], action: "add_service", service: "Acrylic Fill", explanation: "Repair can be booked with a fill or new set." },
    ],
  },
  {
    serviceCategory: "Press-On Nails",
    questions: [
      q("goal", "Are you wanting custom press-ons made for you?", ["Yes, custom set", "No, I need help applying press-ons", "I need sizing only", "I'm not sure"]),
      q("sizes", "Do you know your nail sizes?", ["Yes", "No", "I need a sizing kit", "I'm not sure"]),
      q("design", "What design level do you want?", ["Solid color/simple", "French/chrome/medium design", "Detailed art/gems/3D", "I want a custom/freestyle design"]),
    ],
    rules: [
      { priority: 900, whenAny: ["Detailed art/gems/3D", "I want a custom/freestyle design"], action: "review", service: "Press-On Nails", explanation: "Detailed custom press-ons need technician approval for time and price." },
      { priority: 500, whenAny: ["No", "I need a sizing kit", "I need sizing only"], action: "add_service", service: "Sizing Kit / Consultation", explanation: "A sizing kit or consultation may be needed before your custom press-ons." },
    ],
  },
  {
    serviceCategory: "Custom / Not Sure",
    questions: [
      q("goal", "What are you mainly trying to get done?", ["Natural nail manicure", "Add length/extensions", "Fill/maintenance", "Remove old product", "Nail art/design", "I'm not sure"]),
      q("current", "What do your nails currently have on them?", ["Nothing/bare nails", "Regular polish", "Gel polish", "Acrylic/dip/extensions/builder gel", "I'm not sure"]),
      q("idea", "Do you have an inspiration photo or idea?", ["Yes, I can upload a photo", "I have an idea but no photo", "I want the tech to recommend something", "I'm not sure yet"], true),
    ],
    rules: [
      { priority: 700, whenAll: ["Natural nail manicure"], action: "recommend_service", service: "Manicure", explanation: "A manicure is likely the best starting point for your natural nails." },
      { priority: 700, whenAll: ["Add length/extensions"], action: "recommend_service", service: "Gel-X / Soft Gel Extensions", explanation: "Extensions are likely the best fit when you want added length." },
      { priority: 700, whenAll: ["Fill/maintenance", "Acrylic/dip/extensions/builder gel"], action: "recommend_service", service: "Acrylic Fill", explanation: "A fill or maintenance appointment is likely the best match." },
      { priority: 700, whenAll: ["Remove old product"], action: "recommend_service", service: "Removal / Soak-Off", explanation: "A removal appointment is likely the best place to start." },
      { priority: 700, whenAll: ["Nail art/design"], action: "recommend_service", service: "Nail Art / Add-Ons", explanation: "Nail art is likely the best match for your request." },
      { priority: 200, whenAny: ["I'm not sure", "I want the tech to recommend something", "I'm not sure yet"], action: "review", service: "Custom / Not Sure", explanation: "Your nail tech will review your answers and help select the best service." },
    ],
  },
];

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function answersMatch(values: string[], rule: SmartServiceRule): boolean {
  const has = (needle: string) => values.some((value) => normalized(value) === normalized(needle));
  return (!rule.whenAll || rule.whenAll.every(has)) && (!rule.whenAny || rule.whenAny.some(has));
}

/**
 * Evaluates every applicable rule, then resolves the result using the confirmed
 * global priority order instead of returning whichever rule happens to appear
 * first in a category configuration.
 */
export function evaluateSmartServiceMatch(
  answers: Record<string, string>,
  rules: SmartServiceRule[]
): SmartServiceMatchResult {
  const matches = rules.filter((rule) => answersMatch(Object.values(answers), rule));
  const safetyReview = matches.filter((rule) => rule.action === "review" && rule.priority >= 900).sort((a, b) => b.priority - a.priority)[0];
  if (safetyReview) {
    return { outcome: "review", recommendedService: safetyReview.service ?? null, recommendedAddOns: [], explanation: safetyReview.explanation, needsReview: true };
  }

  const recommendation = matches.filter((rule) => rule.action === "recommend_service").sort((a, b) => b.priority - a.priority)[0];
  const addOns = matches.filter((rule) => rule.action === "add_service" && rule.service).sort((a, b) => b.priority - a.priority);
  const uncertaintyReview = matches.filter((rule) => rule.action === "review").sort((a, b) => b.priority - a.priority)[0];

  if (recommendation) {
    return {
      outcome: "recommendation",
      recommendedService: recommendation.service ?? null,
      recommendedAddOns: addOns.map((rule) => rule.service!).filter((service, index, values) => values.indexOf(service) === index),
      explanation: recommendation.explanation,
      needsReview: false,
    };
  }
  if (addOns.length) {
    return {
      outcome: "recommendation",
      recommendedService: null,
      recommendedAddOns: addOns.map((rule) => rule.service!).filter((service, index, values) => values.indexOf(service) === index),
      explanation: addOns[0].explanation,
      needsReview: false,
    };
  }
  if (uncertaintyReview) {
    return { outcome: "review", recommendedService: uncertaintyReview.service ?? null, recommendedAddOns: [], explanation: uncertaintyReview.explanation, needsReview: true };
  }
  return { outcome: "match", recommendedService: null, recommendedAddOns: [], explanation: "Your selected service looks like a good match.", needsReview: false };
}

export function getSystemSmartServiceMatchConfig(serviceCategory: string): SmartServiceMatchConfig | null {
  return SMART_SERVICE_MATCH_CONFIGS.find((config) => config.serviceCategory === serviceCategory) ?? null;
}

export const OPTIONAL_STANDARDIZED_SERVICES = [
  "Spa / Callus Pedicure Upgrade",
  "Sizing Kit / Consultation",
  "Dip Powder with Tips",
] as const;
