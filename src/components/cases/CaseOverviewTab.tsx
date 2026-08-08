import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, Phone, User, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface CaseOverviewTabProps {
  caseData: any;
  submission: any;
  documents: any[];
  appointments: any[];
  pendingAppt: any;
  onRefresh: () => void;
}

export default function CaseOverviewTab({
  caseData,
  submission,
  documents,
  appointments,
  pendingAppt,
  onRefresh,
}: CaseOverviewTabProps) {
  const { t } = useTranslation("dashboard");

  return (
    <CardContent className="space-y-6 pt-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1 p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground font-semibold">Documents</p>
          <p className="text-2xl font-bold text-foreground">{documents.length}</p>
          <p className="text-xs text-muted-foreground">
            {documents.filter((d) => d.category === "passport").length > 0
              ? "✓ Passport"
              : "⚠ Passport missing"}
          </p>
        </div>

        <div className="space-y-1 p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground font-semibold">
            Appointments
          </p>
          <p className="text-2xl font-bold text-foreground">
            {appointments.length}
          </p>
          <p className="text-xs text-muted-foreground">
            {pendingAppt ? "1 pending" : "All completed"}
          </p>
        </div>

        <div className="space-y-1 p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground font-semibold">
            Payment
          </p>
          <p className="text-2xl font-bold text-foreground">
            {submission?.payment_confirmed ? "✓" : "⏳"}
          </p>
          <p className="text-xs text-muted-foreground">
            {submission?.payment_confirmed ? "Confirmed" : "Pending"}
          </p>
        </div>

        <div className="space-y-1 p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground font-semibold">Created</p>
          <p className="text-2xl font-bold text-foreground">
            {Math.floor(
              (Date.now() - new Date(caseData.created_at).getTime()) / 86400000
            )}
          </p>
          <p className="text-xs text-muted-foreground">days ago</p>
        </div>
      </div>

      {/* Next Appointment */}
      {pendingAppt && (
        <div className="border-l-4 border-blue-500 pl-4 py-2">
          <p className="text-sm font-semibold text-foreground">Next Appointment</p>
          <p className="text-sm text-muted-foreground">
            {format(
              new Date(pendingAppt.scheduled_at),
              "MMM d, yyyy @ h:mm a"
            )}
          </p>
          {pendingAppt.notes && (
            <p className="text-xs text-muted-foreground mt-1">
              Notes: {pendingAppt.notes}
            </p>
          )}
        </div>
      )}

      {/* Case Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {caseData.city && (
          <div>
            <p className="text-xs text-muted-foreground font-semibold">City</p>
            <p className="text-sm font-medium text-foreground">
              {caseData.city}
            </p>
          </div>
        )}
        {caseData.education_level && (
          <div>
            <p className="text-xs text-muted-foreground font-semibold">
              Education
            </p>
            <p className="text-sm font-medium text-foreground">
              {caseData.education_level}
            </p>
          </div>
        )}
        {caseData.english_level && (
          <div>
            <p className="text-xs text-muted-foreground font-semibold">
              English Level
            </p>
            <p className="text-sm font-medium text-foreground">
              {caseData.english_level}
            </p>
          </div>
        )}
        {caseData.degree_interest && (
          <div>
            <p className="text-xs text-muted-foreground font-semibold">
              Degree Interest
            </p>
            <p className="text-sm font-medium text-foreground">
              {caseData.degree_interest}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <Button variant="outline" size="sm" className="flex-1">
          Edit Case
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          Mark Inactive
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive border-destructive hover:bg-destructive/10"
        >
          Delete
        </Button>
      </div>
    </CardContent>
  );
}
