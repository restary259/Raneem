import React from "react";
import ApplyForm from "@/components/apply/ApplyForm";

/**
 * Public apply page (the marketing-site /apply route). Delegates the entire
 * multi-step form to the shared `ApplyForm` (anon-key submission, full-screen
 * chrome with its own success screen). The in-dashboard partner apply page
 * reuses the same `ApplyForm` with the `embedded` + `useSessionAuth` flags.
 */
const ApplyPage: React.FC = () => {
  return <ApplyForm />;
};

export default ApplyPage;
