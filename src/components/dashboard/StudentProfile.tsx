import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Edit, Save, X, User, Trash2 } from "lucide-react";
import { Profile } from "@/types/profile";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

interface StudentProfileProps {
  profile: Profile;
  onProfileUpdate: (userId: string) => void;
  userId: string;
}

interface ExtendedProfile extends Profile {
  emergency_contact?: string;
  date_of_birth?: string;
  home_address?: string; // stored in profiles.country
  german_address?: string; // stored in profiles.german_address (add column via migration)
}

const StudentProfile: React.FC<StudentProfileProps> = ({ profile, onProfileUpdate, userId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<ExtendedProfile>({
    ...profile,
    home_address: (profile as any).country ?? "",
    german_address: (profile as any).german_address ?? "",
    date_of_birth: (profile as any).date_of_birth ?? "",
  } as ExtendedProfile);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();

  const set = (key: keyof ExtendedProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditedProfile((p) => ({ ...p, [key]: e.target.value }));

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          phone_number: editedProfile.phone_number,
          city: editedProfile.city, // city of birth
          country: editedProfile.home_address, // home address
          german_address: (editedProfile as any).german_address, // German address column
          date_of_birth: editedProfile.date_of_birth,
          emergency_contact: editedProfile.emergency_contact,
          arrival_date: editedProfile.arrival_date,
          gender: editedProfile.gender,
          intake_month: editedProfile.intake_month,
          university_name: editedProfile.university_name,
          notes: editedProfile.notes,
          updated_by_student_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;
      toast({
        title: t("profile.updateSuccess", "Saved"),
        description: t("profile.updateSuccessDesc", "Your profile has been updated."),
      });
      setIsEditing(false);
      onProfileUpdate(userId);
    } catch (error: any) {
      toast({ variant: "destructive", title: t("common.error", "Error"), description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed to delete account");
      await supabase.auth.signOut();
      toast({ title: t("profile.accountDeleted", "Account Deleted") });
      navigate("/");
    } catch (error: any) {
      toast({ variant: "destructive", description: error.message });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Personal Information ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t("profile.personalInfo", "Personal Information")}</CardTitle>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 me-1" /> {t("profile.edit", "Edit")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Read-only */}
              <Field label={t("profile.fullName", "Full Name")}>
                <Input value={editedProfile.full_name} disabled readOnly className="bg-muted cursor-not-allowed" />
              </Field>
              <Field label={t("profile.email", "Email")}>
                <Input value={editedProfile.email} disabled readOnly className="bg-muted cursor-not-allowed" />
              </Field>

              {/* Editable personal fields */}
              <Field label={t("profile.phone", "Phone Number")}>
                <Input
                  value={editedProfile.phone_number || ""}
                  onChange={set("phone_number")}
                  disabled={!isEditing}
                  placeholder="+972..."
                />
              </Field>
              <Field label={t("profile.dateOfBirth", "Date of Birth")}>
                <Input
                  type="date"
                  value={(editedProfile as any).date_of_birth || ""}
                  onChange={set("date_of_birth")}
                  disabled={!isEditing}
                />
              </Field>
              <Field label={t("profile.gender", "Gender")}>
                <Select
                  value={editedProfile.gender || ""}
                  onValueChange={(v) => setEditedProfile((p) => ({ ...p, gender: v }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("profile.selectGender", "Select gender")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("profile.genderMale", "Male")}</SelectItem>
                    <SelectItem value="female">{t("profile.genderFemale", "Female")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("profile.cityOfBirth", "City of Birth")}>
                <Input value={editedProfile.city || ""} onChange={set("city")} disabled={!isEditing} />
              </Field>
              <Field label={t("profile.homeAddress", "Home Address")}>
                <Input
                  value={(editedProfile as any).home_address || ""}
                  onChange={set("home_address")}
                  disabled={!isEditing}
                  placeholder={t("profile.homeAddressPlaceholder", "Street, City, Country")}
                />
              </Field>
              <Field label={t("profile.germanAddress", "Address in Germany")}>
                <Input
                  value={(editedProfile as any).german_address || ""}
                  onChange={set("german_address")}
                  disabled={!isEditing}
                  placeholder={t("profile.germanAddressPlaceholder", "Street, City, Postcode")}
                />
              </Field>
              <Field label={t("profile.emergencyContact", "Emergency Contact")}>
                <Input
                  value={(editedProfile as any).emergency_contact || ""}
                  onChange={set("emergency_contact")}
                  disabled={!isEditing}
                  placeholder="+972..."
                />
              </Field>
              <Field label={t("profile.arrivalDate", "Date of Arrival in Germany")}>
                <Input
                  type="date"
                  value={editedProfile.arrival_date || ""}
                  onChange={set("arrival_date")}
                  disabled={!isEditing}
                />
              </Field>
            </div>

            {/* Language School section */}
            <div className="mt-6 pt-4 border-t space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("profile.applicationInfo", "Language School & Application")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("profile.languageSchool", "Language School")}>
                  <Input
                    value={editedProfile.university_name || ""}
                    onChange={set("university_name")}
                    disabled={!isEditing}
                  />
                </Field>
                <Field label={t("profile.intakeMonth", "Intake Month")}>
                  <Input
                    value={editedProfile.intake_month || ""}
                    onChange={set("intake_month")}
                    disabled={!isEditing}
                  />
                </Field>
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end gap-2 mt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditedProfile({ ...profile } as ExtendedProfile);
                    setIsEditing(false);
                  }}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 me-1" /> {t("profile.cancel", "Cancel")}
                </Button>
                <Button type="submit" disabled={isLoading}>
                  <Save className="h-4 w-4 me-1" /> {t("profile.save", "Save")}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* ── Danger Zone ── */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-destructive flex items-center gap-2 text-sm">
            <Trash2 className="h-4 w-4" />
            {t("profile.dangerZone", "Danger Zone")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              "profile.deleteAccountWarning",
              "Permanently delete your account and all associated data. This cannot be undone.",
            )}
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setDeleteConfirmText("");
              setShowDeleteDialog(true);
            }}
          >
            <Trash2 className="h-4 w-4 me-2" />
            {t("profile.deleteAccount", "Delete Account Permanently")}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              {t("profile.deleteAccountTitle", "Delete Account Permanently")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{t("profile.deleteAccountDesc", "This will permanently delete your account and all data.")}</p>
                <p className="font-medium text-foreground">{t("profile.typeDelete", "Type DELETE to confirm:")}</p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("common.loading", "Loading...") : t("profile.confirmDelete", "Yes, Delete My Account")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentProfile;
