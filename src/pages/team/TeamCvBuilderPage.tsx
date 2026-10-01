import LebenslaufBuilder from "@/components/lebenslauf/LebenslaufBuilder";

const TeamCvBuilderPage = () => {
  return (
    <div className="flex flex-col lg:h-[calc(100vh-3.5rem)] p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* embedded: only the form + preview panes scroll under the h-14 header;
          the toolbar stays put. stickyTopClassName is calibrated for the
          dashboard's short header (not the tall public marketing header). */}
      <div className="lg:flex-1 lg:min-h-0">
        <LebenslaufBuilder embedded stickyTopClassName="lg:top-4" />
      </div>
    </div>
  );
};

export default TeamCvBuilderPage;
