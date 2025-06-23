
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import PasswordResetModal from '@/components/auth/PasswordResetModal';
import AuthDebugPanel from '@/components/auth/AuthDebugPanel';
import { validateInput, rateLimiter } from '@/utils/security';

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
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitTime, setRateLimitTime] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔐 Secure auth page mounted');
    
    // Check if user is already logged in
    const getSession = async () => {
      try {
        console.log('🔐 Checking existing session securely...');
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

  // Check rate limiting
  useEffect(() => {
    if (isRateLimited) {
      const interval = setInterval(() => {
        const remaining = rateLimiter.getRemainingTime('auth-attempt');
        setRateLimitTime(Math.ceil(remaining / 1000));
        
        if (remaining <= 0) {
          setIsRateLimited(false);
          setRateLimitTime(0);
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isRateLimited]);

  const validateForm = () => {
    // Validate email
    if (!validateInput.email(email)) {
      toast({
        variant: "destructive",
        title: "خطأ في البيانات",
        description: "البريد الإلكتروني غير صالح",
      });
      return false;
    }

    // Validate password for signup
    if (!isLogin) {
      const passwordValidation = validateInput.password(password);
      if (!passwordValidation.isValid) {
        setPasswordErrors(passwordValidation.errors);
        toast({
          variant: "destructive",
          title: "خطأ في كلمة المرور",
          description: passwordValidation.errors[0],
        });
        return false;
      }
      
      // Validate full name
      if (!fullName.trim() || fullName.length < 2) {
        toast({
          variant: "destructive",
          title: "خطأ في البيانات",
          description: "الاسم الكامل مطلوب ويجب أن يكون حرفين على الأقل",
        });
        return false;
      }
    }

    return true;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check rate limiting
    if (!rateLimiter.checkLimit('auth-attempt', 5, 15 * 60 * 1000)) {
      setIsRateLimited(true);
      setRateLimitTime(Math.ceil(rateLimiter.getRemainingTime('auth-attempt') / 1000));
      toast({
        variant: "destructive",
        title: "تم تجاوز الحد المسموح",
        description: "عدد كبير من المحاولات. يرجى الانتظار قبل المحاولة مرة أخرى.",
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setPasswordErrors([]);

    try {
      console.log('🔐 Starting secure auth process:', { isLogin, email: email.substring(0, 3) + '***' });

      if (isLogin) {
        console.log('🔐 Attempting secure login...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: validateInput.sanitizeString(email),
          password: password, // Don't sanitize password as it might affect authentication
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
        console.log('🔐 Attempting secure signup...');
        const { data, error } = await supabase.auth.signUp({
          email: validateInput.sanitizeString(email),
          password: password,
          options: {
            data: {
              full_name: validateInput.sanitizeString(fullName),
              phone_number: phoneNumber ? validateInput.sanitizeString(phoneNumber) : null,
              country: country ? validateInput.sanitizeString(country) : null,
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
      } else if (error.message.includes('Email rate limit exceeded')) {
        errorMessage = 'تم تجاوز حد إرسال الرسائل. يرجى الانتظار قبل المحاولة مرة أخرى.';
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

  // Clear password errors when switching between login/signup
  useEffect(() => {
    setPasswordErrors([]);
  }, [isLogin]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-gray-600">محمي بأحدث تقنيات الأمان</span>
            </div>
            <CardTitle className="text-2xl font-bold">
              {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isRateLimited && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm text-center">
                  يرجى الانتظار {rateLimitTime} ثانية قبل المحاولة مرة أخرى
                </p>
              </div>
            )}
            
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
                      maxLength={100}
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
                      maxLength={20}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="country">الدولة</Label>
                    <Input
                      id="country"
                      placeholder="أدخل دولتك"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      maxLength={50}
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
                  maxLength={254}
                  autoComplete="email"
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
                    minLength={8}
                    maxLength={128}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                
                {!isLogin && passwordErrors.length > 0 && (
                  <div className="text-sm text-red-600">
                    <ul className="list-disc list-inside space-y-1">
                      {passwordErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
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
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || isRateLimited}
              >
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
                disabled={isLoading}
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
