export const OTA_COLORS: Record<string, string> = {
  "GoMMT":         "#E83F6F",
  "Booking.com":   "#003580",
  "Agoda":         "#5C2D91",
  "Expedia":       "#00355F",
  "Cleartrip":     "#E8460A",
  "Yatra":         "#E8232A",
  "Ixigo":         "#FF6B35",
  "Akbar Travels": "#1B4F72",
  "EaseMyTrip":    "#00B9F1",
  "Indigo":        "#6B2FA0",
  "Hotelbeds":     "#00A699",
  "GMB":           "#34A853",
};

export const OTAS = [
  "GoMMT",
  "Booking.com",
  "Agoda",
  "Expedia",
  "Cleartrip",
  "Yatra",
  "Ixigo",
  "Akbar Travels",
  "EaseMyTrip",
  "Indigo",
  "Hotelbeds",
];

export const RNS_OTAS = [
  "GoMMT",
  "Booking.com",
  "Agoda",
  "Expedia",
  "Cleartrip",
  "EaseMyTrip",
  "Yatra",
  "Ixigo",
  "Akbar Travels",
];

export const TEAM_COLORS = ["#6366F1", "#E83F6F", "#F59E0B", "#10B981", "#8B5CF6"];

export const SHEET_ID     = "1VkFA4keBAT3tG5NkZwmSNRbLZJgx2neOhZ7Zuj2z_98";
export const GMB_SHEET_ID = "16awDYKs1jdR0x5VDJTo8CokB_fqqjr7JRpmRY0tv4Fk";
export const RNS_SHEET_ID = "1xI0TjmZkmKwD27nNIhah7iaQtbpAmX5tfJYckbw2Jio";

export const SHEET_TABS = ["Listing Tracker", "Listing Summary", "RN Tracker"] as const;
export type SheetTab = typeof SHEET_TABS[number];
