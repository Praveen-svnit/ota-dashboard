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
  "GMB",
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

// Maps every DB ota_booking_source_desc value → canonical OTA display name.
// null = skip that channel.
export const CHANNEL_TO_OTA: Record<string, string | null> = {
  "Booking.com":   "Booking.com",
  "Agoda":         "Agoda",
  "AgodaYCS":      "Agoda",
  "AgodaB2B":      "Agoda",
  "Expedia":       "Expedia",
  "Cleartrip":     "Cleartrip",
  "EaseMyTrip":    "EaseMyTrip",
  "Goibibo":       "GoMMT",
  "MakeMyTrip":    "GoMMT",
  "Goibibo / MMT": "GoMMT",
  "MyBiz":         "GoMMT",
  "Yatra":         "Yatra",
  "YatraB2B":      "Yatra",
  "Travelguru":    "Yatra",
  "Ixigo":         "Ixigo",
  "ixigo":         "Ixigo",
  "Akbar Travels": "Akbar Travels",
  "AkbarTravel":   "Akbar Travels",
  // skip
  "RoomsTonite":   null,
  "Other":         null,
};

// Sub-channels to show when a canonical OTA is expanded.
export const OTA_CHANNELS: Record<string, string[]> = {
  "GoMMT":         ["Goibibo", "MakeMyTrip", "Goibibo / MMT", "MyBiz"],
  "Agoda":         ["Agoda", "AgodaYCS", "AgodaB2B"],
  "Yatra":         ["Yatra", "YatraB2B", "Travelguru"],
  "Ixigo":         ["Ixigo", "ixigo"],
  "Akbar Travels": ["Akbar Travels", "AkbarTravel"],
};

export const TEAM_COLORS = ["#6366F1", "#E83F6F", "#F59E0B", "#10B981", "#8B5CF6"];

// Sync-tool sheet IDs (used by admin sync routes only, not data-serving routes)
export const SHEET_ID     = "1VkFA4keBAT3tG5NkZwmSNRbLZJgx2neOhZ7Zuj2z_98";
export const INV_SHEET_ID  = "1VkFA4keBAT3tG5NkZwmSNRbLZJgx2neOhZ7Zuj2z_98";
export const INV_SHEET_TAB = "Inventory";
export const RNS_RAW_SHEET_ID  = "1xI0TjmZkmKwD27nNIhah7iaQtbpAmX5tfJYckbw2Jio";
export const RNS_RAW_TAB       = "Raw_Data_New";
export const GMB_SHEET_ID  = "16awDYKs1jdR0x5VDJTo8CokB_fqqjr7JRpmRY0tv4Fk";
export const GMB_SHEET_TAB = "new tracker";
