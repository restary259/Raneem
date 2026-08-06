import SpreadsheetHub from '@/components/spreadsheet/SpreadsheetHub';
import { useAuth } from '@/contexts/AuthContext';

export default function TeamSpreadsheetPage() {
  const { user } = useAuth();
  return <SpreadsheetHub scope="team" userId={user?.id} />;
}
