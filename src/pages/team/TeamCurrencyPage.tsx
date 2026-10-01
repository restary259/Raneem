import { Card, CardContent } from "@/components/ui/card";
import CurrencyConverter from "@/components/calculator/CurrencyConverter";

const TeamCurrencyPage = () => {
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <Card>
        <CardContent className="pt-6">
          <CurrencyConverter />
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamCurrencyPage;
