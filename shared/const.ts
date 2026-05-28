export const COOKIE_NAME = "app_session_id";

// ─── Style Tag System ─────────────────────────────────────────────────────────
export const STYLE_TAG_GROUPS = [
  {
    group: "Everyday",
    tags: ["Minimalist", "Classic", "French", "Natural", "Nude", "Vintage", "Bold", "Glam", "Floral", "Geometric", "Abstract", "Marble", "Ombre", "Chrome", "Glitter", "Pastel", "Neon", "Boho"],
  },
  {
    group: "Themed",
    tags: ["Disney"],
  },
  {
    group: "Seasonal",
    tags: ["Seasonal Nails"],
  },
  {
    group: "Holidays",
    tags: ["Christmas", "Halloween", "Valentine's Day", "Fourth of July", "Thanksgiving", "New Year's", "Easter"],
  },
] as const;

export const STYLE_TAGS_FLAT: string[] = STYLE_TAG_GROUPS.flatMap(g => [...g.tags]);

export const MAX_STYLE_TAGS = 3;
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// ─── Legal Versioning ─────────────────────────────────────────────────────────
// Bump this number whenever ToS or Privacy Policy is updated to force re-consent
export const CURRENT_TOS_VERSION = 1;
