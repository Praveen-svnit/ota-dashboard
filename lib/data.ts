// Unique properties live on FabHotels platform (out of 1,877 total)
export const FH_PLATFORM_LIVE = 1620;

export const OTA_STATUS = [
  { ota: "GoMMT",         live: 1724, notLive: 153  },
  { ota: "Booking.com",   live: 1258, notLive: 619  },
  { ota: "Agoda",         live: 1776, notLive: 101  },
  { ota: "Expedia",       live: 1678, notLive: 199  },
  { ota: "Cleartrip",     live: 1397, notLive: 480  },
  { ota: "Yatra",         live: 336,  notLive: 1541 },
  { ota: "Ixigo",         live: 342,  notLive: 1535 },
  { ota: "Akbar Travels", live: 758,  notLive: 1119 },
  { ota: "EaseMyTrip",    live: 966,  notLive: 911  },
  { ota: "Indigo",        live: 0,    notLive: 1877 },
  { ota: "Hotelbeds",     live: 0,    notLive: 1877 },
];

export const MTD_LISTINGS = [
  { ota: "GoMMT",         cmMTD: 50,  lmSameDay: 62,  lmTotal: 126 },
  { ota: "Booking.com",   cmMTD: 20,  lmSameDay: 28,  lmTotal: 62  },
  { ota: "Agoda",         cmMTD: 50,  lmSameDay: 70,  lmTotal: 154 },
  { ota: "Expedia",       cmMTD: 64,  lmSameDay: 15,  lmTotal: 34  },
  { ota: "Cleartrip",     cmMTD: 0,   lmSameDay: 98,  lmTotal: 279 },
  { ota: "Yatra",         cmMTD: 0,   lmSameDay: 120, lmTotal: 336 },
  { ota: "Ixigo",         cmMTD: 212, lmSameDay: 45,  lmTotal: 130 },
  { ota: "Akbar Travels", cmMTD: 204, lmSameDay: 197, lmTotal: 554 },
  { ota: "EaseMyTrip",    cmMTD: 0,   lmSameDay: 0,   lmTotal: 0   },
  { ota: "Indigo",        cmMTD: 0,   lmSameDay: 0,   lmTotal: 0   },
  { ota: "Hotelbeds",     cmMTD: 0,   lmSameDay: 0,   lmTotal: 0   },
];

export const RNS_MONTHLY: Record<string, Record<string, { lmMTD: number; cmMTD: number; lmTotal: number }>> = {
  "Jan-26": {
    "GoMMT":         { lmMTD: 380, cmMTD: 520, lmTotal: 880 },
    "Booking.com":   { lmMTD: 170, cmMTD: 210, lmTotal: 398 },
    "Agoda":         { lmMTD: 200, cmMTD: 290, lmTotal: 480 },
    "Expedia":       { lmMTD: 22,  cmMTD: 32,  lmTotal: 58  },
    "Cleartrip":     { lmMTD: 10,  cmMTD: 20,  lmTotal: 28  },
    "EaseMyTrip":    { lmMTD: 2,   cmMTD: 4,   lmTotal: 5   },
    "Yatra":         { lmMTD: 0,   cmMTD: 0,   lmTotal: 0   },
    "Ixigo":         { lmMTD: 0,   cmMTD: 0,   lmTotal: 0   },
    "Akbar Travels": { lmMTD: 0,   cmMTD: 0,   lmTotal: 0   },
  },
  "Feb-26": {
    "GoMMT":         { lmMTD: 410, cmMTD: 520, lmTotal: 955 },
    "Booking.com":   { lmMTD: 195, cmMTD: 210, lmTotal: 455 },
    "Agoda":         { lmMTD: 231, cmMTD: 290, lmTotal: 539 },
    "Expedia":       { lmMTD: 29,  cmMTD: 32,  lmTotal: 68  },
    "Cleartrip":     { lmMTD: 14,  cmMTD: 20,  lmTotal: 33  },
    "EaseMyTrip":    { lmMTD: 3,   cmMTD: 4,   lmTotal: 6   },
    "Yatra":         { lmMTD: 0,   cmMTD: 0,   lmTotal: 0   },
    "Ixigo":         { lmMTD: 0,   cmMTD: 0,   lmTotal: 0   },
    "Akbar Travels": { lmMTD: 0,   cmMTD: 0,   lmTotal: 0   },
  },
  "Mar-26": {
    "GoMMT":         { lmMTD: 410, cmMTD: 608, lmTotal: 955 },
    "Booking.com":   { lmMTD: 195, cmMTD: 226, lmTotal: 455 },
    "Agoda":         { lmMTD: 231, cmMTD: 354, lmTotal: 539 },
    "Expedia":       { lmMTD: 29,  cmMTD: 28,  lmTotal: 68  },
    "Cleartrip":     { lmMTD: 14,  cmMTD: 27,  lmTotal: 33  },
    "EaseMyTrip":    { lmMTD: 3,   cmMTD: 5,   lmTotal: 6   },
    "Yatra":         { lmMTD: 0,   cmMTD: 0,   lmTotal: 0   },
    "Ixigo":         { lmMTD: 0,   cmMTD: 0,   lmTotal: 0   },
    "Akbar Travels": { lmMTD: 0,   cmMTD: 0,   lmTotal: 0   },
  },
};

// RNPD source: D-1 cumulative room nights done (will be fed from GSheet D-1 row)
// cmRNs       = total RNs done this month up to yesterday
// lmSameDayRNs = total RNs done last month up to the same day count
// lmTotalRNs  = full last month RN total
export const RNPD_D1: Record<string, Record<string, { cmRNs: number; lmSameDayRNs: number; lmTotalRNs: number }>> = {
  "Jan-26": {
    "GoMMT":         { cmRNs: 16120, lmSameDayRNs: 11900, lmTotalRNs: 27280 },
    "Booking.com":   { cmRNs: 6110,  lmSameDayRNs: 4980,  lmTotalRNs: 11550 },
    "Agoda":         { cmRNs: 8400,  lmSameDayRNs: 5830,  lmTotalRNs: 13830 },
    "Expedia":       { cmRNs: 915,   lmSameDayRNs: 650,   lmTotalRNs: 1660  },
    "Cleartrip":     { cmRNs: 554,   lmSameDayRNs: 306,   lmTotalRNs: 819   },
    "EaseMyTrip":    { cmRNs: 134,   lmSameDayRNs: 77,    lmTotalRNs: 172   },
    "Yatra":         { cmRNs: 0,     lmSameDayRNs: 0,     lmTotalRNs: 0     },
    "Ixigo":         { cmRNs: 0,     lmSameDayRNs: 0,     lmTotalRNs: 0     },
    "Akbar Travels": { cmRNs: 0,     lmSameDayRNs: 0,     lmTotalRNs: 0     },
  },
  "Feb-26": {
    "GoMMT":         { cmRNs: 15080, lmSameDayRNs: 12710, lmTotalRNs: 29450 },
    "Booking.com":   { cmRNs: 5740,  lmSameDayRNs: 5340,  lmTotalRNs: 12710 },
    "Agoda":         { cmRNs: 7830,  lmSameDayRNs: 6380,  lmTotalRNs: 15530 },
    "Expedia":       { cmRNs: 850,   lmSameDayRNs: 720,   lmTotalRNs: 1950  },
    "Cleartrip":     { cmRNs: 504,   lmSameDayRNs: 374,   lmTotalRNs: 945   },
    "EaseMyTrip":    { cmRNs: 114,   lmSameDayRNs: 86,    lmTotalRNs: 210   },
    "Yatra":         { cmRNs: 0,     lmSameDayRNs: 0,     lmTotalRNs: 0     },
    "Ixigo":         { cmRNs: 0,     lmSameDayRNs: 0,     lmTotalRNs: 0     },
    "Akbar Travels": { cmRNs: 0,     lmSameDayRNs: 0,     lmTotalRNs: 0     },
  },
  "Mar-26": {
    "GoMMT":         { cmRNs: 17600, lmSameDayRNs: 15080, lmTotalRNs: 29450 },
    "Booking.com":   { cmRNs: 6580,  lmSameDayRNs: 5740,  lmTotalRNs: 12710 },
    "Agoda":         { cmRNs: 9620,  lmSameDayRNs: 7830,  lmTotalRNs: 15530 },
    "Expedia":       { cmRNs: 784,   lmSameDayRNs: 850,   lmTotalRNs: 1950  },
    "Cleartrip":     { cmRNs: 616,   lmSameDayRNs: 504,   lmTotalRNs: 945   },
    "EaseMyTrip":    { cmRNs: 144,   lmSameDayRNs: 114,   lmTotalRNs: 210   },
    "Yatra":         { cmRNs: 0,     lmSameDayRNs: 0,     lmTotalRNs: 0     },
    "Ixigo":         { cmRNs: 0,     lmSameDayRNs: 0,     lmTotalRNs: 0     },
    "Akbar Travels": { cmRNs: 0,     lmSameDayRNs: 0,     lmTotalRNs: 0     },
  },
};

export const L12M_MONTHS = [
  "Apr-25", "May-25", "Jun-25", "Jul-25", "Aug-25", "Sep-25",
  "Oct-25", "Nov-25", "Dec-25", "Jan-26", "Feb-26", "Mar-26",
];

export const L12M_ONBOARDED = [142, 118, 96, 130, 154, 109, 87, 163, 201, 178, 245, 87];

export const L12M_OTA_LIVE: Record<string, number[]> = {
  "GoMMT":         [98,  82, 60,  88, 110,  74, 52, 115, 140, 120, 126,  50],
  "Booking.com":   [45,  38, 30,  52,  68,  44, 28,  72,  88,  74,  62,  20],
  "Agoda":         [110, 90, 72, 100, 130,  88, 60, 120, 155, 138, 154,  50],
  "Expedia":       [30,  24, 18,  28,  40,  26, 16,  35,  50,  42,  34,  64],
  "Cleartrip":     [80,  66, 50,  76,  95,  65, 40,  90, 115,  98, 279,   0],
  "Yatra":         [42,  30, 22,  35,  50,  32, 20,  45,  60,  50, 336,   0],
  "Ixigo":         [38,  28, 18,  30,  44,  28, 16,  40,  55,  45, 130, 212],
  "Akbar Travels": [55,  44, 35,  55,  75,  50, 30,  60,  85,  70, 554, 204],
  "EaseMyTrip":    [0,    0,  0,   0,   0,   0,  0,   0,   0,   0,   0,   0],
  "Indigo":        [0,    0,  0,   0,   0,   0,  0,   0,   0,   0,   0,   0],
  "Hotelbeds":     [0,    0,  0,   0,   0,   0,  0,   0,   0,   0,   0,   0],
};
