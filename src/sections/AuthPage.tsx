'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, ArrowLeft, Loader2, Mail, Lock } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

interface AuthPageProps {
  userRole: 'student' | 'teacher' | 'admin' | null;
  onLogin: (email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => void;
  onRegister: (name: string, email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => void;
  onGoogleLogin?: (credential: string) => void;
  onBack: () => void;
  isLoading: boolean;
  error?: string | null;
}

export default function AuthPage({ userRole, onLogin, onRegister, onGoogleLogin, onBack, isLoading, error }: AuthPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    if (userRole === 'admin') {
      setIsLogin(true);
    }
  }, [userRole]);

  const handleGoogleAuth = useGoogleLogin({
    onSuccess: (codeResponse) => {
      if (onGoogleLogin && codeResponse.access_token) {
        onGoogleLogin(codeResponse.access_token);
      }
    },
    onError: (error) => console.log('Google Login Failed:', error)
  });

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      onLogin(email, password, userRole);
    } else {
      onRegister(name, email, password, userRole);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground transition-colors duration-500 overflow-hidden relative">
      {/* Background Decoration */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply dark:mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(circle at 80% 30%, rgba(29, 78, 216, 0.25) 0%, transparent 40%),
                               radial-gradient(circle at 20% 70%, rgba(56, 189, 248, 0.15) 0%, transparent 40%)`
        }}>
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-blue-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to home</span>
        </button>

        <Card className="border-border/40 shadow-2xl bg-card/80 backdrop-blur-2xl">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <img
                src={
                  userRole === 'student' || userRole === 'admin' ? '/origin-new.jpg'
                    : userRole === 'teacher' ? '/Origin-Teacher-Logo.png'
                      : '/O3-Origin-Logo.png'
                }
                alt="ORIGIN"
                className="h-16 w-auto rounded-2xl shadow-sm"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              {userRole === 'teacher' ? 'Teacher Login' : userRole === 'student' ? 'Student Login' : userRole === 'admin' ? 'Admin Portal' : 'Welcome to ORIGIN'}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {userRole === 'teacher' ? 'Access your dashboard and manage classes' : userRole === 'admin' ? 'System administration and platform management' : 'Your AI-powered JEE preparation companion'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col items-center mb-6">
              {userRole !== 'admin' && (
                <div className="flex bg-muted/50 p-1 rounded-xl w-full max-w-[240px] mb-4">
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Sign Up
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-2 w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold text-center animate-in fade-in slide-in-from-top-1 duration-300">
                  {error}
                </div>
              )}
            </div>

            <div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-300">
                    <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">Full Name</Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      </div>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Enter your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 h-12 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#3CACA3] focus:ring-[#3CACA3]/20 dark:text-white transition-all"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#3CACA3] focus:ring-[#3CACA3]/20 dark:text-white transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isLogin ? "Enter your password" : "Create a password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#3CACA3] focus:ring-[#3CACA3]/20 dark:text-white transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isLogin && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="remember"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-border bg-muted dark:bg-slate-950 text-blue-600 focus:ring-blue-500/20"
                      />
                      <label
                        htmlFor="remember"
                        className="text-sm text-muted-foreground cursor-pointer"
                      >
                        Remember me
                      </label>
                    </div>
                    <button type="button" className="text-sm text-blue-500 hover:underline">
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-[#1E3A5F] hover:opacity-90 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isLogin ? 'Logging in...' : 'Signing up...'}
                    </>
                  ) : (
                    isLogin ? 'Login' : 'Create Account'
                  )}
                </Button>
              </form>

              {userRole !== 'admin' && (
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/40" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground font-medium">Or continue with</span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3">
                    <Button 
                      variant="outline" 
                      className="h-11 border-border/60 hover:bg-muted text-foreground bg-muted/40"
                      onClick={() => handleGoogleAuth()}
                      disabled={isLoading}
                    >
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google
                    </Button>
                    <Button variant="outline" className="h-11 border-border/60 hover:bg-muted text-foreground bg-muted/40">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.684.81-1.513 1.24-2.333 1.24-.82 0-1.65-.43-2.333-1.24-.684-.81-1.177-1.94-1.177-3.08 0-1.14.493-2.27 1.177-3.08.684-.81 1.513-1.24 2.333-1.24.82 0-1.65.43 2.333 1.24.684.81 1.177 1.94 1.177 3.08zm-10.73 0c0 1.14-.493 2.27-1.177 3.08-.684.81-1.513 1.24-2.333 1.24-.82 0-1.65-.43-2.333-1.24C.493 3.7 0 2.57 0 1.43 0 .29.493-.84 1.177-1.65.684-.84 1.513-.41 2.333-.41c.82 0 1.65-.43 2.333-1.24C5.35-.84 5.843.29 5.843 1.43z" />
                      </svg>
                      Phone
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          By using ORIGIN, you agree to our commitment to your privacy and success
        </p>
      </div>
    </div>
  );
}
