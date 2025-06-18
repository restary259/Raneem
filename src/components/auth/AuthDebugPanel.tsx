
import React from 'react';
import { useAuthDebug } from '@/hooks/useAuthDebug';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AuthDebugPanel: React.FC = () => {
  const authDebug = useAuthDebug();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card className="mt-4 border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="text-sm text-orange-800">معلومات التصحيح (للمطورين فقط)</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div><strong>المستخدم:</strong> {authDebug.user ? authDebug.user.email : 'غير مسجل'}</div>
        <div><strong>الجلسة:</strong> {authDebug.session ? 'نشطة' : 'غير نشطة'}</div>
        <div><strong>التحميل:</strong> {authDebug.loading ? 'جار التحميل' : 'مكتمل'}</div>
        {authDebug.error && (
          <div className="text-red-600"><strong>خطأ:</strong> {authDebug.error}</div>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer">تغييرات حالة المصادقة</summary>
          <ul className="mt-1 space-y-1">
            {authDebug.authStateChanges.map((change, index) => (
              <li key={index} className="text-gray-600">• {change}</li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
};

export default AuthDebugPanel;
