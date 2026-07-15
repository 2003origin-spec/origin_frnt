'use client';
import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import dynamic from 'next/dynamic';

const OriMascot = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });
import {
  GraduationCap,
  BookOpen,
  Users,
  Youtube,
  Building2,
  Share2,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Target,
  Phone,
  Lock,
} from 'lucide-react';
import type { User } from '@/types';
import { completeOnboardingAction, completeAccountSetupAction } from '@/server/actions/profile-actions';

interface OnboardingPageProps {
  user: User;
  onComplete: (data: Partial<User>) => void | Promise<void>;
}

export default function OnboardingPage({ user, onComplete }: OnboardingPageProps) {
  // Google signups (passwordSet === false) must also set a password here; OTP is
  // skipped because Google already verified their email.
  const needsPassword = user.passwordSet === false;
  // Email signups now capture the mobile number on the signup form, so the
  // account-setup step is only needed for users still missing a mobile (Google
  // signups, legacy accounts) or who must set a password (Google signups).
  const needsAccountSetup = needsPassword || !user.mobile;

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    class: '',
    isDropper: false,
    selectedCourse: '',
    subjects: [] as string[],
    referralSource: '',
    mobile: '',
    password: '',
    confirmPassword: '',
  });
  const [setupError, setSetupError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalSteps = needsAccountSetup ? 5 : 4;
  const progress = (step / totalSteps) * 100;

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
      return;
    }
    // Final step (account setup): validate + persist mobile (+ password) first,
    // then finalize the rest of onboarding.
    setSetupError(null);
    if (needsPassword && formData.password !== formData.confirmPassword) {
      setSetupError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      // Only the account-setup step (mobile / password) needs this call; email
      // signups already captured their mobile at registration.
      if (needsAccountSetup) {
        const setup = await completeAccountSetupAction({
          mobile: formData.mobile,
          password: needsPassword ? formData.password : undefined,
        });
        if (!setup.ok) {
          setSetupError(setup.error ?? 'Could not save your details.');
          return;
        }
      }
      const response = await completeOnboardingAction({
        class: formData.class,
        isDropper: formData.isDropper,
        selectedCourse: formData.selectedCourse,
        subjects: formData.subjects,
        referralSource: formData.referralSource,
      });
      await onComplete(response);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setSetupError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return formData.class !== '';
      case 2: return formData.selectedCourse !== '';
      case 3: return formData.subjects.length > 0;
      case 4: return formData.referralSource !== '';
      case 5: {
        const mobileOk = /^[6-9]\d{9}$/.test(formData.mobile.replace(/\D/g, '').slice(-10));
        const pwOk = !needsPassword || (formData.password.length >= 8 && formData.confirmPassword.length >= 8);
        return mobileOk && pwOk;
      }
      default: return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <img src="/origin-new.jpg" alt="ORIGIN Student" className="h-16 w-auto" />
              </div>
              <img src="/ori2d/ori-exited.png" alt="Ori" className="w-32 h-32 sm:w-44 sm:h-44 object-contain drop-shadow-xl mx-auto mb-4" />
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Which class are you in?</h2>
              <p className="text-sm text-muted-foreground">This helps us personalize your learning experience</p>
            </div>

            <RadioGroup
              value={formData.class}
              onValueChange={(value) => setFormData({ ...formData, class: value, isDropper: value === 'dropper' })}
              className="grid grid-cols-2 gap-3"
            >
              {[
                { value: '9', label: 'Class 9', desc: 'Foundation' },
                { value: '10', label: 'Class 10', desc: 'Board + Foundation' },
                { value: '11', label: 'Class 11', desc: 'JEE/NEET Prep' },
                { value: '12', label: 'Class 12', desc: 'Final Stretch' },
                { value: 'dropper', label: 'Dropper', desc: 'One More Try' },
              ].map((option) => (
                <div key={option.value}>
                  <RadioGroupItem value={option.value} id={`cls-${option.value}`} className="peer sr-only" />
                  <Label
                    htmlFor={`cls-${option.value}`}
                    className="flex flex-col items-center p-4 neu-raised rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary peer-data-[state=checked]:bg-primary/5"
                  >
                    <span className="font-black text-foreground">{option.label}</span>
                    <span className="text-xs text-muted-foreground mt-1 text-center">{option.desc}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Choose your course</h2>
              <p className="text-sm text-muted-foreground">Select the exam you are preparing for</p>
            </div>

            <RadioGroup
              value={formData.selectedCourse}
              onValueChange={(value) => setFormData({ ...formData, selectedCourse: value, subjects: [] })}
              className="space-y-3"
            >
              {[
                { value: 'JEE', label: 'JEE (Main + Advanced)', desc: 'Engineering Entrance Exam' },
                { value: 'NEET', label: 'NEET (UG)', desc: 'Medical Entrance Exam' },
                ...(['9', '10'].includes(formData.class) ? [{ value: 'Foundation', label: 'Foundation (9th/10th)', desc: 'Early Prep for JEE/NEET' }] : []),
              ].map((option) => (
                <div key={option.value}>
                  <RadioGroupItem value={option.value} id={`course-${option.value}`} className="peer sr-only" />
                  <Label
                    htmlFor={`course-${option.value}`}
                    className="flex items-center p-4 neu-raised rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary peer-data-[state=checked]:bg-primary/5"
                  >
                    <div className="flex-1">
                      <span className="font-black text-foreground block">{option.label}</span>
                      <span className="text-sm text-muted-foreground">{option.desc}</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-primary opacity-0 peer-data-[state=checked]:opacity-100 transition-opacity" />
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <img src="/ori2d/ori-curious.png" alt="Ori" className="w-24 h-24 object-contain mx-auto mb-3 drop-shadow-md" />
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4 overflow-hidden p-2">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Select your subjects</h2>
              <p className="text-sm text-muted-foreground">We will tailor your experience based on these</p>
            </div>

            <div className="space-y-3">
              {(formData.selectedCourse === 'JEE'
                ? [
                  { value: 'Physics', label: 'Physics', desc: 'Mechanics, Electricity, Modern Physics' },
                  { value: 'Chemistry', label: 'Chemistry', desc: 'Organic, Inorganic, Physical' },
                  { value: 'Mathematics', label: 'Mathematics', desc: 'Calculus, Algebra, Geometry' },
                ]
                : formData.selectedCourse === 'NEET'
                  ? [
                    { value: 'Physics', label: 'Physics', desc: 'Mechanics, Electricity, Modern Physics' },
                    { value: 'Chemistry', label: 'Chemistry', desc: 'Organic, Inorganic, Physical' },
                    { value: 'Biology', label: 'Biology', desc: 'Botany, Zoology' },
                  ]
                  : [
                    { value: 'Physics', label: 'Physics', desc: 'Foundation Concepts' },
                    { value: 'Chemistry', label: 'Chemistry', desc: 'Foundation Concepts' },
                    { value: 'Mathematics', label: 'Mathematics', desc: 'Foundation Concepts' },
                    { value: 'Biology', label: 'Biology', desc: 'Foundation Concepts' },
                  ]
              ).map((subject) => (
                <div key={subject.value}>
                  <Checkbox
                    id={`subj-${subject.value}`}
                    checked={formData.subjects.includes(subject.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({ ...formData, subjects: [...formData.subjects, subject.value] });
                      } else {
                        setFormData({ ...formData, subjects: formData.subjects.filter((s) => s !== subject.value) });
                      }
                    }}
                    className="sr-only peer"
                  />
                  <Label
                    htmlFor={`subj-${subject.value}`}
                    className="flex items-center p-4 neu-raised rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary peer-data-[state=checked]:bg-primary/5"
                  >
                    <div className="flex-1">
                      <span className="font-black text-foreground block">{subject.label}</span>
                      <span className="text-sm text-muted-foreground">{subject.desc}</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-primary opacity-0 peer-data-[state=checked]:opacity-100 transition-opacity" />
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">How did you hear about ORIGIN?</h2>
              <p className="text-sm text-muted-foreground">Help us understand our reach</p>
            </div>

            <RadioGroup
              value={formData.referralSource}
              onValueChange={(value) => setFormData({ ...formData, referralSource: value })}
              className="grid grid-cols-2 gap-3"
            >
              {[
                { value: 'friends', label: 'Friends', icon: Users },
                { value: 'youtube', label: 'YouTube', icon: Youtube },
                { value: 'coaching', label: 'Coaching', icon: Building2 },
                { value: 'social', label: 'Social Media', icon: Share2 },
                { value: 'other', label: 'Other', icon: BookOpen },
              ].map((option) => (
                <div key={option.value}>
                  <RadioGroupItem value={option.value} id={`ref-${option.value}`} className="peer sr-only" />
                  <Label
                    htmlFor={`ref-${option.value}`}
                    className="flex flex-col items-center p-4 neu-raised rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary peer-data-[state=checked]:bg-primary/5"
                  >
                    <option.icon className="w-6 h-6 text-primary mb-2" />
                    <span className="font-bold text-foreground">{option.label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Phone className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Almost there!</h2>
              <p className="text-sm text-muted-foreground">
                {needsPassword ? 'Add your mobile number and set a password to secure your account.' : 'Add your mobile number to finish setting up your account.'}
              </p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={formData.mobile}
                    onChange={(e) => { setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }); setSetupError(null); }}
                    placeholder="10-digit mobile number"
                    className="w-full neu-inset rounded-xl bg-transparent py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {needsPassword && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Set Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setSetupError(null); }}
                        placeholder="Min 8 characters"
                        className="w-full neu-inset rounded-xl bg-transparent py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); setSetupError(null); }}
                        placeholder="Re-enter password"
                        className="w-full neu-inset rounded-xl bg-transparent py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                </>
              )}

              {setupError && <p className="text-xs font-bold text-rose-500 text-center">{setupError}</p>}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-6 neu-surface text-foreground transition-colors duration-300">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg neu-raised rounded-3xl p-5 sm:p-8">
        {/* Ori greeting */}
        <div className="mb-6 flex justify-center">
          <div className="h-20 w-20">
            <OriMascot expression="curious" title="Ori" />
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground">Step {step} of {totalSteps}</span>
            <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="neu-inset rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        {renderStep()}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 h-12 neu-raised rounded-xl font-bold text-sm hover:-translate-y-0.5 transition-all"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={!isStepValid() || submitting}
            className="flex-1 h-12 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl font-black text-sm shadow-[3px_3px_8px_hsl(var(--neu-shadow))] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {step === totalSteps ? (
              <>{submitting ? 'Saving…' : 'Complete Setup'}<Sparkles className="w-4 h-4" /></>
            ) : (
              <>Continue<ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
