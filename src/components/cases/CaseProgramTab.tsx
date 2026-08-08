import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface CaseProgramTabProps {
  submission: any;
  onRefresh: () => void;
}

export default function CaseProgramTab({
  submission,
  onRefresh,
}: CaseProgramTabProps) {
  const { t } = useTranslation("dashboard");
  const [programName, setProgramName] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [accommodationName, setAccommodationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!submission) return;

      try {
        const [progRes, accomRes] = await Promise.all([
          submission.program_id
            ? supabase
                .from("programs")
                .select("name_en, school_id")
                .eq("id", submission.program_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          submission.accommodation_id
            ? supabase
                .from("accommodations")
                .select("name_en")
                .eq("id", submission.accommodation_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (progRes.data?.name_en) {
          setProgramName(progRes.data.name_en);

          // Fetch school name
          if (progRes.data.school_id) {
            const schoolRes = await supabase
              .from("schools")
              .select("name_en")
              .eq("id", progRes.data.school_id)
              .maybeSingle();
            if (schoolRes.data?.name_en) {
              setSchoolName(schoolRes.data.name_en);
            }
          }
        }

        if (accomRes.data?.name_en) {
          setAccommodationName(accomRes.data.name_en);
        }
      } catch (err) {
        console.error("Error fetching program details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [submission]);

  if (loading) {
    return (
      <CardContent className="space-y-6 pt-6">
        <Skeleton className="h-20" />
      </CardContent>
    );
  }

  return (
    <CardContent className="space-y-6 pt-6">
      {/* Program Details */}
      {programName && (
        <div className="border-l-4 border-blue-500 pl-4 py-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase">
            Program
          </p>
          <p className="text-lg font-semibold text-foreground">{programName}</p>
          {schoolName && (
            <p className="text-sm text-muted-foreground mt-1">@ {schoolName}</p>
          )}
        </div>
      )}

      {/* Program Dates */}
      {submission?.program_start_date && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-semibold">
              Start Date
            </p>
            <p className="text-sm font-medium">{submission.program_start_date}</p>
          </div>
          {submission?.program_end_date && (
            <div>
              <p className="text-xs text-muted-foreground font-semibold">
                End Date
              </p>
              <p className="text-sm font-medium">{submission.program_end_date}</p>
            </div>
          )}
        </div>
      )}

      {/* Accommodation */}
      {accommodationName && (
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">
            Accommodation
          </p>
          <p className="text-sm font-medium">{accommodationName}</p>
          {submission?.accommodation_price && (
            <p className="text-sm text-muted-foreground mt-1">
              €{submission.accommodation_price.toLocaleString()}/month
            </p>
          )}
        </div>
      )}

      {/* Insurance */}
      {submission?.insurance_price && (
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">
            Insurance
          </p>
          <p className="text-sm font-medium">
            €{submission.insurance_price.toLocaleString()}
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t">
        <Button variant="outline" size="sm" className="flex-1">
          Change Program
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          Update Dates
        </Button>
      </div>
    </CardContent>
  );
}
