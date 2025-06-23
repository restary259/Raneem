
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import PasswordResetModal from '@/components/auth/PasswordResetModal';
import AuthDebugPanel from '@/components/auth/AuthDebugPanel';

const StudentAuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔐 Auth page mounted');
    
    // Check if user is already logged in
    const getSession = async () => {
      try {
        console.log('🔐 Checking existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('🔐 Session check error:', error);
          return;
        }
        
        if (session?.user) {
          console.log('🔐 User already authenticated, redirecting to dashboard');
          setUser(session.user);
          navigate('/student-dashboard');
        }
      } catch (error) {
        console.error('🔐 Session check failed:', error);
      }
    };
    
    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state change:', event, session?.user?.id);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('🔐 User authenticated, navigating to dashboard');
        navigate('/student-dashboard');
      }
    });

    return () => {
      console.log('🔐 Auth page cleanup');
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('🔐 Starting auth process:', { isLogin, email });

      if (isLogin) {
        console.log('🔐 Attempting login...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          console.error('🔐 Login error:', error);
          throw error;
        }
        
        console.log('🔐 Login successful:', data.user?.id);
        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: "مرحباً بك في لوحة التحكم الخاصة بك",
        });
      } else {
        console.log('🔐 Attempting signup...');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone_number: phoneNumber,
              country: country,
            },
            emailRedirectTo: `${window.location.origin}/student-dashboard`
          }
        });
        
        if (error) {
          console.error('🔐 Signup error:', error);
          throw error;
        }
        
        console.log('🔐 Signup successful:', data.user?.id);
        toast({
          title: "تم إنشاء الحساب بنجاح",
          description: "يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب",
        });
      }
    } catch (error: any) {
      console.error('🔐 Auth error:', error);
      let errorMessage = error.message;
      
      // Provide more user-friendly error messages in Arabic
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'بيانات تسجيل الدخول غير صحيحة';
      } else if (error.message.includes('User already registered')) {
        errorMessage = 'هذا البريد الإلكتروني مسجل مسبقاً';
      } else if (error.message.includes('Password should be at least 6 characters')) {
        errorMessage = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
      } else if (error.message.includes('Invalid email')) {
        errorMessage = 'البريد الإلكتروني غير صالح';
      }

      toast({
        variant: "destructive",
        title: "حدث خطأ",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">الاسم الكامل *</Label>
                    <Input
                      id="fullName"
                      placeholder="أدخل اسمك الكامل"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={!isLogin}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">رقم الجوال</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="أدخل رقم جوالك"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="country">الدولة</Label>
                    <Input
                      id="country"
                      placeholder="أدخل دولتك"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="أدخل بريدك الإلكتروني"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {isLogin && (
                  <div className="text-left">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => setShowResetModal(true)}
                      className="p-0 h-auto font-normal text-sm text-primary hover:underline"
                    >
                      نسيت كلمة المرور؟
                    </Button>
                  </div>
                )}
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جار التحميل...
                  </>
                ) : (
                  isLogin ? "تسجيل الدخول" : "إنشاء حساب"
                )}
              </Button>
            </form>
            
            <div className="mt-4 text-center">
              <Button
                variant="link"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm"
              >
                {isLogin ? "ليس لديك حساب؟ سجل الآن" : "لديك حساب؟ سجل الدخول"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <AuthDebugPanel />

        <PasswordResetModal 
          isOpen={showResetModal} 
          onClose={() => setShowResetModal(false)} 
        />
      </div>
    </div>
  );
};

export default StudentAuthPage;
