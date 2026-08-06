import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * Partners and ambassadors share the same dashboard shell; only the role label
 * and the commission rate that applies to them differ.
 */
export default function PartnerDashboardLayout() {
  const { role } = useAuth();
  return <DashboardLayout role={role === "ambassador" ? "ambassador" : "social_media_partner"} />;
}
