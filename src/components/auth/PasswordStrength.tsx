
import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthProps {
  password: string;
}

const RULES = [
  { label: '8 أحرف على الأقل', test: (p: string) => p.length >= 8 },
  { label: 'حرف كبير (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'حرف صغير (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'رقم (0-9)', test: (p: string) => /[0-9]/.test(p) },
  { label: 'رمز خاص (!@#$...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export const validatePassword = (password: string): boolean =>
  RULES.every(r => r.test(password));

const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  if (!password) return null;

  const passed = RULES.filter(r => r.test(password)).length;
  const strength = passed <= 2 ? 'ضعيفة' : passed <= 4 ? 'متوسطة' : 'قوية';
  const color = passed <= 2 ? 'bg-red-500' : passed <= 4 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${color} transition-all duration-300 rounded-full`} style={{ width: `${(passed / RULES.length) * 100}%` }} />
        </div>
        <span className={`text-xs font-medium ${passed <= 2 ? 'text-red-600' : passed <= 4 ? 'text-amber-600' : 'text-green-600'}`}>{strength}</span>
      </div>
      <ul className="space-y-1">
        {RULES.map((rule, i) => {
          const ok = rule.test(password);
          return (
            <li key={i} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-muted-foreground'}`}>
              {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PasswordStrength;
