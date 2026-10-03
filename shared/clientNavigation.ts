export const CLIENT_BOTTOM_NAVIGATION = [
  { key: "discover", label: "Discover", href: "/discover" },
  { key: "messages", label: "Messages", href: "/messages" },
  { key: "bookings", label: "Bookings", href: "/bookings" },
  { key: "notifications", label: "Notifications", href: "/notifications" },
  { key: "profile", label: "Profile", href: "/profile" },
] as const;

export const CLIENT_PROFILE_SAVED_PATH = "/saved";

export type ClientBottomNavigationKey = (typeof CLIENT_BOTTOM_NAVIGATION)[number]["key"];
