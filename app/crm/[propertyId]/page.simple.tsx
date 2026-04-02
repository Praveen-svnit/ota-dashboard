"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import PropertyLeadsquaredView from "@/components/crm/PropertyLeadsquaredView.simple";

interface Listing {
  id: number; ota: string; status: string; subStatus: string;
  live极