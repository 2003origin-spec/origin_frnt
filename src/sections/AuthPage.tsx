'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, ArrowLeft, Loader2, Mail, Lock } from 'lucide-react';

interface AuthPageProps {
  userRole: 'student' | 'teacher' | null;
  onLogin: (email: string, password: string) => void;
  onBack: () => void;
  isLoading: boolean;
  error?: string | null;
}

export default function AuthPage({ userRole, onLogin, onBack, isLoading, error }: AuthPageProps) {
  const [showPassword, setShowPassword] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(loginEmail, loginPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#060D1A] text-white">
      {/* Background Decoration */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(circle at 80% 30%, rgba(29, 78, 216, 0.4) 0%, transparent 40%),
                               radial-gradient(circle at 20% 70%, rgba(56, 189, 248, 0.2) 0%, transparent 40%)`
        }}>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[#3CACA3] dark:hover:text-[#3CACA3] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to home</span>
        </button>

        <Card className="border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-slate-900/60 backdrop-blur-2xl dark:border-white/10">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <img
                src={
                  userRole === 'student' ? '/origin-new.jpg'
                    : userRole === 'teacher' ? '/Origin-Teacher-Logo.png'
                      : '/O3-Origin-Logo.png'
                }
                alt="ORIGIN"
                className="h-16 w-auto"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
              {userRole === 'teacher' ? 'Teacher Login' : userRole === 'student' ? 'Student Login' : 'Welcome to ORIGIN'}
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              {userRole === 'teacher' ? 'Access your dashboard and manage classes' : 'Your AI-powered JEE preparation companion'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col items-center mb-6">
              <div className="px-6 py-2 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-white/5 font-bold text-[#3CACA3] dark:text-blue-300">
                Login
              </div>

              {error && (
                <div className="mt-4 w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold text-center animate-in fade-in slide-in-from-top-1 duration-300">
                  {error}
                </div>
              )}
            </div>

            <div>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-slate-700 dark:text-slate-300">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10 h-12 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#3CACA3] focus:ring-[#3CACA3]/20 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-slate-700 dark:text-slate-300">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#3CACA3] focus:ring-[#3CACA3]/20 dark:text-white"
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

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-[#3CACA3] focus:ring-[#3CACA3]/20"
                    />
                    <label
                      htmlFor="remember"
                      className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer"
                    >
                      Remember me
                    </label>
                  </div>
                  <button type="button" className="text-sm text-[#3CACA3] hover:underline">
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] hover:opacity-90 text-white rounded-xl font-medium"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">Or continue with</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-11 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-200 dark:bg-slate-900">
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
                  <Button variant="outline" className="h-11 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-200 dark:bg-slate-900">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.684.81-1.513 1.24-2.333 1.24-.82 0-1.65-.43-2.333-1.24-.684-.81-1.177-1.94-1.177-3.08 0-1.14.493-2.27 1.177-3.08.684-.81 1.513-1.24 2.333-1.24.82 0 1.65.43 2.333 1.24.684.81 1.177 1.94 1.177 3.08zm-10.73 0c0 1.14-.493 2.27-1.177 3.08-.684.81-1.513 1.24-2.333 1.24-.82 0-1.65-.43-2.333-1.24C.493 3.7 0 2.57 0 1.43 0 .29.493-.84 1.177-1.65.684-.84 1.513-.41 2.333-.41c.82 0 1.65-.43 2.333-1.24C5.35-.84 5.843.29 5.843 1.43z" />
                    </svg>
                    Phone
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          By using ORIGIN, you agree to our commitment to your privacy and success
        </p>
      </div>
    </div>
  );
}
