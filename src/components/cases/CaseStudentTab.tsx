import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pencil, Save, X } from "lucide-react";

interface CaseStudentTabProps {
  caseData: any;
  submission: any;
  onRefresh: () => void;
}

export default function CaseStudentTab({
  caseData,
  submission,
  onRefresh,
}: CaseStudentTabProps) {
  const { t } = useTranslation("dashboard");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const extraData = submission?.extra_data || {};

  const handleEdit = (key: string, value: string) => {
    setEditingField(key);
    setEditValue(value);
  };

  const handleSave = async (key: string) => {
    // Save logic here
    setEditingField(null);
  };

  return (
    <CardContent className="space-y-6 pt-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-3">
            Personal Information
          </p>
          <div className="space-y-3">
            {caseData.full_name && (
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <p className="text-sm font-medium">{caseData.full_name}</p>
              </div>
            )}
            {caseData.phone_number && (
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <p className="text-sm font-medium">{caseData.phone_number}</p>
              </div>
            )}
            {extraData.student_email && (
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <p className="text-sm font-medium">{extraData.student_email}</p>
              </div>
            )}
            {extraData.date_of_birth && (
              <div>
                <label className="text-xs text-muted-foreground">
                  Date of Birth
                </label>
                <p className="text-sm font-medium">{extraData.date_of_birth}</p>
              </div>
            )}
          </div>
        </div>

        {/* Academic Information */}
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-3">
            Academic Background
          </p>
          <div className="space-y-3">
            {caseData.bagrut_score && (
              <div>
                <label className="text-xs text-muted-foreground">
                  Bagrut Score
                </label>
                <p className="text-sm font-medium">{caseData.bagrut_score}</p>
              </div>
            )}
            {caseData.english_units && (
              <div>
                <label className="text-xs text-muted-foreground">
                  English Units
                </label>
                <p className="text-sm font-medium">{caseData.english_units}</p>
              </div>
            )}
            {caseData.math_units && (
              <div>
                <label className="text-xs text-muted-foreground">
                  Math Units
                </label>
                <p className="text-sm font-medium">{caseData.math_units}</p>
              </div>
            )}
            {extraData.gender && (
              <div>
                <label className="text-xs text-muted-foreground">Gender</label>
                <p className="text-sm font-medium">
                  {String(extraData.gender).toUpperCase()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      {extraData.emergency_contact_name && (
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-3">
            Emergency Contact
          </p>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span>{" "}
              <span className="font-medium">{extraData.emergency_contact_name}</span>
            </p>
            {extraData.emergency_contact_phone && (
              <p>
                <span className="text-muted-foreground">Phone:</span>{" "}
                <span className="font-medium">
                  {extraData.emergency_contact_phone}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t">
        <Button variant="outline" size="sm" className="flex-1">
          Edit Profile
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          Send Checklist
        </Button>
      </div>
    </CardContent>
  );
}
