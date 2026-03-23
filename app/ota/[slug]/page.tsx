"use client";

import { useParams } from "next/navigation";
import OtaDetailView from "@/components/dashboard/OtaDetailView";

const SLUG_OTA_MAP: Record<string, string> = {
  "gommt":         "GoMMT",
  "booking-com":   "Booking.com",
  "agoda":         "Agoda",
  "expedia":       "Expedia",
  "cleartrip":     "Cleartrip",
  "yatra":         "Yatra",
  "ixigo":         "Ixigo",
  "akbar-travels": "Akbar Travels",
  "easemytrip":    "EaseMyTrip",
};

export default function OtaDetailPage() {
  const params = useParams();
  const slug   = typeof params.slug === "string" ? params.slug : Array.isArray(params.slug) ? (params.slug[0] ?? "") : "";
  const otaName = SLUG_OTA_MAP[slug] ?? "";

  return <OtaDetailView otaName={otaName} />;
}
