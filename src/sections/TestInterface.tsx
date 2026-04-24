'use client';
import { useState, useEffect, useRef } from 'react';
import { Camera, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Test, TestResult, UserAnswer } from '@/types';
import { renderInlineSegments, renderQuestionText } from '@/lib/math-text';
import { submitTestAction } from '@/server/actions/test-actions';
import { toast } from 'sonner';

interface TestInterfaceProps {
  test: Test;
  onComplete: (result: TestResult) => void;
  onExit: () => void;
}

// NTA Status Types
type QuestionStatus = 'not_visited' | 'not_answered' | 'answered' | 'marked_review' | 'answered_marked';

export default function TestInterface({ test, onComplete, onExit }: TestInterfaceProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(test.duration * 60);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [proctorStatus, setProctorStatus] = useState<'monitoring' | 'warning' | 'error'>('monitoring');
  const [mobileDetected, setMobileDetected] = useState(false);
  const [violations, setViolations] = useState(0);
  const [showMalpracticeWarning, setShowMalpracticeWarning] = useState(false);
  const [isMalpracticeTerminated, setIsMalpracticeTerminated] = useState(false);
  const malpracticeTimerRef = useRef<any>(null);
  const questionStartedAtRef = useRef<number>(Date.now());

  // Proctoring setup
  useEffect(() => {

    async function startProctoring() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, frameRate: 15 }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access failed", err);
        setProctorStatus('error');
      }
    }

    startProctoring();

    // Mock detection logic - students using mobiles
    const detectionInterval = setInterval(() => {
      // Small chance of simulation every interval
      if (Math.random() < 0.1) {
        setMobileDetected(true);
        setProctorStatus('warning');

        // Auto-clear after 5 seconds
        setTimeout(() => {
          setMobileDetected(false);
          setProctorStatus('monitoring');
        }, 5000);
      }
    }, 20000);

    return () => {
      stopCamera();
      clearInterval(detectionInterval);
      if (malpracticeTimerRef.current) clearTimeout(malpracticeTimerRef.current);
    };
  }, []);

  // Malpractice Detection Logic
  useEffect(() => {
    const handleViolation = () => {
      setViolations(prev => {
        const next = prev + 1;
        if (next >= 3) {
          terminateWithMalpractice();
        } else {
          setShowMalpracticeWarning(true);
        }
        return next;
      });
    };

    const startTimer = () => {
      if (!malpracticeTimerRef.current && !isMalpracticeTerminated) {
        malpracticeTimerRef.current = setTimeout(() => {
          handleViolation();
          malpracticeTimerRef.current = null;
        }, 2000);
      }
    };

    const stopTimer = () => {
      if (malpracticeTimerRef.current) {
        clearTimeout(malpracticeTimerRef.current);
        malpracticeTimerRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) startTimer();
      else stopTimer();
    };

    const handleBlur = () => startTimer();
    const handleFocus = () => stopTimer();

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isMalpracticeTerminated]);

  const terminateWithMalpractice = () => {
    setIsMalpracticeTerminated(true);
    stopCamera();
    // Delay submission slightly to show the overlay
    setTimeout(() => {
      finalSubmit({ malpractice: true });
    }, 4000);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Initialize tracking
  useEffect(() => {
    const initialAnswers = test.questions.map((q) => ({
      questionId: q.id,
      selectedOption: null,
      selectedOptions: [],
      matrixPairs: [],
      answerText: '',
      timeSpent: 0,
      isMarkedForReview: false,
    }));
    setAnswers(initialAnswers);

    // Visit first question
    setVisitedStats(prev => {
      const next = [...prev];
      next[0] = true;
      return next;
    });
    questionStartedAtRef.current = Date.now();
  }, [test.questions]);

  // Track if a question has been visited at all
  const [visitedStats, setVisitedStats] = useState<boolean[]>(new Array(test.questions.length).fill(false));

  const markVisited = (index: number) => {
    setVisitedStats(prev => {
      if (prev[index]) return prev;
      const next = [...prev];
      next[index] = true;
      return next;
    });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuestionStatus = (index: number): QuestionStatus => {
    if (!answers[index] || !visitedStats[index]) return 'not_visited';
    const ans = answers[index];

    const hasAnswered = 
        ans.selectedOption !== null || 
        (ans.selectedOptions && ans.selectedOptions.length > 0) || 
        (ans.matrixPairs && ans.matrixPairs.length > 0) || 
        (ans.answerText && ans.answerText.trim() !== '');

    if (hasAnswered && ans.isMarkedForReview) return 'answered_marked';
    if (hasAnswered && !ans.isMarkedForReview) return 'answered';
    if (!hasAnswered && ans.isMarkedForReview) return 'marked_review';
    return 'not_answered';
  };

  const currentQuestion = test.questions[currentQuestionIndex];

  // Temp state for selection before saving
  const [tempSelection, setTempSelection] = useState<number | null>(null);
  const [tempSelections, setTempSelections] = useState<number[]>([]);
  const [tempMatrixPairs, setTempMatrixPairs] = useState<number[][]>([]);
  const [tempTextAnswer, setTempTextAnswer] = useState<string>('');

  // Sync temp selection when navigating
  useEffect(() => {
    if (answers[currentQuestionIndex]) {
      setTempSelection(answers[currentQuestionIndex].selectedOption ?? null);
      setTempSelections(answers[currentQuestionIndex].selectedOptions || []);
      setTempMatrixPairs(answers[currentQuestionIndex].matrixPairs || []);
      setTempTextAnswer(answers[currentQuestionIndex].answerText || '');
    } else {
      setTempSelection(null);
      setTempSelections([]);
      setTempMatrixPairs([]);
      setTempTextAnswer('');
    }
    markVisited(currentQuestionIndex);
    questionStartedAtRef.current = Date.now();
  }, [currentQuestionIndex, answers]);

  const getElapsedSeconds = () => Math.max(0, Math.round((Date.now() - questionStartedAtRef.current) / 1000));

  const recordCurrentQuestionTime = () => {
    const elapsedSeconds = getElapsedSeconds();
    if (elapsedSeconds <= 0 || !answers[currentQuestionIndex]) {
      questionStartedAtRef.current = Date.now();
      return answers;
    }

    const updatedAnswers = [...answers];
    updatedAnswers[currentQuestionIndex] = {
      ...updatedAnswers[currentQuestionIndex],
      timeSpent: (updatedAnswers[currentQuestionIndex].timeSpent ?? 0) + elapsedSeconds,
    };
    questionStartedAtRef.current = Date.now();
    setAnswers(updatedAnswers);
    return updatedAnswers;
  };

  const saveCurrentResponse = (isMarkedForReview: boolean) => {
    const elapsedSeconds = getElapsedSeconds();
    const updatedAnswers = [...answers];
    updatedAnswers[currentQuestionIndex] = {
      ...updatedAnswers[currentQuestionIndex],
      selectedOption: tempSelection,
      selectedOptions: tempSelections,
      matrixPairs: tempMatrixPairs,
      answerText: tempTextAnswer,
      isMarkedForReview,
      timeSpent: (updatedAnswers[currentQuestionIndex]?.timeSpent ?? 0) + elapsedSeconds,
    };
    questionStartedAtRef.current = Date.now();
    setAnswers(updatedAnswers);
    return updatedAnswers;
  };

  const navigateToQuestion = (nextIndex: number) => {
    recordCurrentQuestionTime();
    setCurrentQuestionIndex(nextIndex);
  };

  const handleOptionSelect = (optionIndex: number) => {
    setTempSelection(optionIndex);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setTempTextAnswer(e.target.value);
  };

  const handleClearResponse = () => {
    setTempSelection(null);
    setTempSelections([]);
    setTempMatrixPairs([]);
    setTempTextAnswer('');
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = {
      ...newAnswers[currentQuestionIndex],
      selectedOption: null,
      selectedOptions: [],
      matrixPairs: [],
      answerText: '',
      isMarkedForReview: false // also clears review status usually in NTA
    };
    setAnswers(newAnswers);
  };

  const saveAndNext = () => {
    saveCurrentResponse(false);
    if (currentQuestionIndex < test.totalQuestions - 1) {
      navigateToQuestion(currentQuestionIndex + 1);
    }
  };

  const saveAndMarkForReview = () => {
    saveCurrentResponse(true);
    if (currentQuestionIndex < test.totalQuestions - 1) {
      navigateToQuestion(currentQuestionIndex + 1);
    }
  };

  const markForReviewAndNext = () => {
    saveCurrentResponse(true);
    if (currentQuestionIndex < test.totalQuestions - 1) {
      navigateToQuestion(currentQuestionIndex + 1);
    }
  };

  const finalSubmit = async (options?: { malpractice?: boolean }) => {
    stopCamera();
    setShowSubmitModal(false);

    try {
      const isMalpractice = options?.malpractice || false;
      const answersWithCurrentTime = recordCurrentQuestionTime();
      const formattedAnswers = answersWithCurrentTime.filter(a =>
        a.selectedOption !== null ||
        (a.selectedOptions && a.selectedOptions.length > 0) ||
        (a.matrixPairs && a.matrixPairs.length > 0) ||
        a.answerText ||
        a.isMarkedForReview
      ).map(a => ({
        questionId: a.questionId,
        selectedOption: a.selectedOption,
        selectedOptions: a.selectedOptions,
        matrixPairs: a.matrixPairs,
        answerText: a.answerText,
        timeSpent: a.timeSpent,
        isMarkedForReview: a.isMarkedForReview
      }));

      const payload = {
        answers: formattedAnswers,
        timeTaken: test.duration * 60 - timeRemaining,
        isMalpractice: isMalpractice
      };

      const result = await submitTestAction(test.id, payload);

      onComplete(result as TestResult);
    } catch (error: any) {
      console.error('Test submission failed:', error);
      toast.error('Failed to submit test. Please try again.');
    }
  };

  // Stats for Legend
  const stats = {
    not_visited: 0,
    not_answered: 0,
    answered: 0,
    marked: 0,
    answered_marked: 0
  };

  answers.forEach((_, i) => {
    const status = getQuestionStatus(i);
    if (status === 'not_visited') stats.not_visited++;
    else if (status === 'not_answered') stats.not_answered++;
    else if (status === 'answered') stats.answered++;
    else if (status === 'marked_review') stats.marked++;
    else if (status === 'answered_marked') stats.answered_marked++;
  });

  return (
    <div className="min-h-screen bg-white text-black font-sans text-sm selection:bg-blue-200 flex flex-col">

      {/* 1. Top Header */}
      <header className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-6 py-2 border-b border-gray-300 gap-3 sm:gap-0">
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center cursor-pointer" onClick={() => { stopCamera(); onExit(); }}>
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
              <div className="w-6 h-6 bg-orange-500 rounded-tr-xl rounded-bl-xl" style={{ clipPath: 'polygon(0% 100%, 100% 100%, 100% 0%)' }}></div>
            </div>
          </div>
          <div>
            <h1 className="text-sm sm:text-xl font-bold text-blue-900 leading-tight">O3 ORIGIN TESTING AGENCY</h1>
            <p className="text-[10px] sm:text-xs text-green-700 font-semibold italic">Excellence in Assessment</p>
          </div>
        </div>

        <div className="flex items-center justify-between w-full sm:w-auto gap-4 text-xs font-semibold">
          <div className="w-16 h-20 sm:w-24 sm:h-28 bg-gray-600 rounded-lg flex flex-col items-center justify-center overflow-hidden relative shadow-inner border-2 border-gray-400">
            {proctorStatus === 'error' ? (
              <div className="flex flex-col items-center justify-center text-red-100 p-2 bg-red-900/50 w-full h-full">
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 mb-2" />
                <span className="text-[8px] sm:text-[10px] text-center font-bold tracking-tighter">ACCESS DENIED</span>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover opacity-100 -scale-x-100"
                />
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.8)]"></div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white py-0.5 text-center flex items-center justify-center gap-1">
                  {proctorStatus === 'warning' ? (
                    <span className="text-yellow-400 flex items-center">
                      <AlertTriangle className="w-2 h-2 mr-0.5" /> MOBILE?
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <ShieldCheck className="w-2 h-2 mr-0.5 text-green-400" /> PROCTORING
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-0.5 sm:gap-1 text-[10px] sm:text-xs">
            <div className="flex"><span className="w-20 sm:w-28 text-gray-500">Candidate:</span> <span className="text-orange-500 truncate max-w-[100px] sm:max-w-none">[Your Name]</span></div>
            <div className="flex"><span className="w-20 sm:w-28 text-gray-500">Subject:</span> <span className="text-orange-500 truncate max-w-[100px] sm:max-w-none">{test.title}</span></div>
            <div className="flex"><span className="w-20 sm:w-28 text-gray-500">Remaining:</span> <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-[10px] sm:text-xs">{formatTime(timeRemaining)}</span></div>
          </div>
        </div>
      </header>

      {/* 2. Orange Sub Header */}
      <div className="bg-[#f08c32] px-3 sm:px-6 py-1.5 flex justify-between items-center text-[10px] sm:text-xs overflow-x-auto whitespace-nowrap">
        <div className="flex gap-1" style={{ height: '32px' }}>
          <div className="flex items-center px-3 sm:px-4 bg-orange-400 text-white font-bold opacity-80 uppercase text-[10px] sm:text-xs">{test.title}</div>
        </div>
        <div className="flex items-center gap-3 sm:gap-6 ml-4">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold hidden sm:inline">Paper Language:</span>
            <select className="border border-gray-300 text-black px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white outline-none w-24 sm:w-48 text-[10px] sm:text-xs">
              <option>English</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>

        {/* Left Area - Question Content */}
        <div className="flex-1 flex flex-col border-r border-gray-300 relative">

          {/* Question Header */}
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-300 font-bold text-base sm:text-lg border-t-4 border-t-white bg-white sticky top-0 z-20">
            <span>Question {currentQuestionIndex + 1}:</span>
            <div className="w-6 h-6 bg-blue-600 rounded-full text-white flex items-center justify-center font-bold text-sm">&darr;</div>
          </div>

          {/* Question Text & Options */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 relative">
            <div className="absolute right-0 top-[50%] bg-black text-white px-1 py-4 cursor-pointer text-xs"><b>&gt;</b></div>
            <div className="max-w-3xl">

              {/* Added Tags rendering for Phase 7 */}
              {currentQuestion?.tags && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {(typeof currentQuestion.tags === 'string' ? currentQuestion.tags.split(',') : Array.isArray(currentQuestion.tags) ? currentQuestion.tags : []).map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md text-[10px] font-bold uppercase tracking-wider">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-base text-gray-800 leading-relaxed font-serif mb-8 whitespace-pre-wrap">
                {renderQuestionText(currentQuestion?.text, 'test-question')}
              </div>

              {(currentQuestion?.questionType === 'mcq' || !currentQuestion?.questionType) && (
                <div className="space-y-4 font-serif text-base">
                  {currentQuestion?.options.map((option, idx) => (
                    <label key={idx} className="flex items-start gap-4 cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${currentQuestionIndex}`}
                        checked={tempSelection === idx}
                        onChange={() => handleOptionSelect(idx)}
                        className="mt-1.5 w-4 h-4"
                      />
                      <span>({idx + 1})</span>
                      <span className="text-gray-800">{renderInlineSegments(String(option), `test-mcq-option-${idx}`, 'plain')}</span>
                    </label>
                  ))}
                </div>
              )}

              {currentQuestion?.questionType === 'msq' && (
                <div className="space-y-4 font-serif text-base">
                  <p className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-tight">Multiple Correct Concept</p>
                  {currentQuestion?.options.map((option, idx) => (
                    <label key={idx} className="flex items-start gap-4 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={tempSelections.includes(idx)}
                        onChange={() => {
                          setTempSelections(prev =>
                            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                          );
                        }}
                        className="mt-1.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="group-hover:text-blue-600 transition-colors">({idx + 1})</span>
                      <span className="group-hover:text-blue-600 transition-colors">
                        {renderInlineSegments(String(option), `test-msq-option-${idx}`, 'plain')}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {currentQuestion?.questionType === 'matrix_match' && currentQuestion.matrixData && (
                <div className="space-y-6 font-serif text-base">
                  <p className="text-xs font-bold text-blue-600 mb-4 uppercase tracking-tight">Matrix Matching</p>
                  
                  {/* Column B Reference (Sync with OGCode) */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Column B Reference</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {currentQuestion.matrixData.column_b.map((term: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
                          <span className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs text-gray-700">{renderInlineSegments(String(term), `test-matrix-term-${idx}`)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {currentQuestion.matrixData.column_a.map((itemA: string, idxA: number) => (
                      <div key={idxA} className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                            {String.fromCharCode(80 + idxA)}
                          </span>
                          <span className="text-sm font-semibold text-gray-800">{renderInlineSegments(String(itemA), `test-matrix-item-${idxA}`)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(currentQuestion as any).matrixData.column_b.map((_: any, idxB: number) => {
                            const isSelected = tempMatrixPairs.some(p => p[0] === idxA && p[1] === idxB);
                            return (
                              <button
                                key={idxB}
                                onClick={() => {
                                  setTempMatrixPairs(prev => {
                                    const exists = prev.some(p => p[0] === idxA && p[1] === idxB);
                                    if (exists) return prev.filter(p => !(p[0] === idxA && p[1] === idxB));
                                    return [...prev, [idxA, idxB]];
                                  });
                                }}
                                className={`px-4 py-1.5 rounded text-xs font-bold transition-all border
                                  ${isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                    : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}
                                `}
                              >
                                {idxB + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentQuestion?.questionType === 'numerical' && (
                <div className="font-serif text-base">
                  <p className="text-xs font-bold text-blue-600 mb-4 uppercase tracking-tight">Numerical Value Type</p>
                  <div className="flex flex-col gap-4">
                    <input
                      type="number"
                      step="any"
                      value={tempTextAnswer}
                      onChange={handleTextChange}
                      className="border-2 border-slate-300 rounded-md p-3 w-64 text-2xl font-mono text-center focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                      placeholder="0.00"
                    />
                    <p className="text-[10px] text-gray-500 italic">* Round off to nearest two decimal places if required.</p>
                  </div>
                </div>
              )}

              {currentQuestion?.questionType === 'subjective' && (
                <div className="font-serif text-base w-full">
                  <p className="text-sm font-bold text-slate-500 mb-2 uppercase">Write your answer:</p>
                  <textarea
                    value={tempTextAnswer}
                    onChange={handleTextChange}
                    className="border-2 border-slate-300 rounded-md p-4 w-full h-32 text-base font-sans focus:border-blue-500 outline-none resize-y"
                    placeholder="Type your explanation or answer here..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-300 px-3 sm:px-4 py-2 sm:py-3 grid grid-cols-2 sm:flex sm:flex-row gap-2">
            <button onClick={saveAndNext} className="bg-[#5CB85C] text-white px-2 sm:px-4 py-2 sm:py-1.5 font-bold text-[10px] sm:text-xs rounded-sm hover:opacity-90 uppercase">SAVE & NEXT</button>
            <button onClick={saveAndMarkForReview} className="bg-[#F0AD4E] text-white px-2 sm:px-4 py-2 sm:py-1.5 font-bold text-[10px] sm:text-xs rounded-sm hover:opacity-90 uppercase">SAVE & REVIEW</button>
            <button onClick={handleClearResponse} className="bg-white text-gray-800 border border-gray-300 px-2 sm:px-4 py-2 sm:py-1.5 font-bold text-[10px] sm:text-xs rounded-sm hover:bg-gray-50 uppercase shadow-sm">CLEAR</button>
            <button onClick={markForReviewAndNext} className="bg-[#297FC6] text-white px-2 sm:px-4 py-2 sm:py-1.5 font-bold text-[10px] sm:text-xs rounded-sm hover:opacity-90 uppercase sm:ml-auto">REVIEW & NEXT</button>
          </div>

          {/* Footer Buttons */}
          <div className="bg-gray-100 border-t border-gray-300 px-4 py-3 flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => navigateToQuestion(Math.max(0, currentQuestionIndex - 1))}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-1 text-xs font-bold rounded-sm shadow-sm hover:bg-gray-50 uppercase"
                disabled={currentQuestionIndex === 0}
              >&lt;&lt; BACK</button>
              <button
                onClick={() => navigateToQuestion(Math.min(test.totalQuestions - 1, currentQuestionIndex + 1))}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-1 text-xs font-bold rounded-sm shadow-sm hover:bg-gray-50 uppercase"
              >NEXT &gt;&gt;</button>
            </div>
            <button onClick={() => setShowSubmitModal(true)} className="bg-[#5CB85C] text-white px-6 py-1.5 font-bold text-sm rounded-sm hover:opacity-90 uppercase shadow-md">SUBMIT</button>
          </div>

        </div>

        {/* Right Area - Palette */}
        <div className="w-full lg:w-[350px] bg-white flex flex-col pt-4 border-t lg:border-t-0 lg:border-l border-gray-300 max-h-[300px] lg:max-h-none">

          {/* Legend */}
          <div className="px-4 pb-4 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px] text-gray-700 font-semibold mb-4">

              <div className="flex items-center gap-1.5">
                <div className="w-8 h-7 bg-gray-200 border border-gray-300 rounded-sm flex items-center justify-center font-bold text-gray-500 relative">
                  <span className="bg-white px-1 leading-none z-10">{stats.not_visited}</span>
                </div>
                <span className="leading-tight w-20">Not Visited</span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-tr-[16px] rounded-br-[4px] rounded-tl-[4px] bg-[#D9534F] text-white flex items-center justify-center font-bold shadow-sm relative overflow-hidden" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 70%, 70% 100%, 0% 100%)' }}>
                  {stats.not_answered}
                  <div className="absolute -top-2 -right-2 w-4 h-4 bg-white/20 rotate-45"></div>
                </div>
                <span className="leading-tight">Not Answered</span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-tr-[4px] rounded-bl-[16px] rounded-tl-[4px] rounded-br-[4px] bg-[#5CB85C] text-white flex items-center justify-center font-bold shadow-sm" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 30% 100%, 0% 70%)' }}>
                  {stats.answered}
                </div>
                <span className="leading-tight">Answered</span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-[#5B247A] text-white flex items-center justify-center font-bold shadow-sm">
                  {stats.marked}
                </div>
                <span className="leading-tight">Marked for Review</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-gray-700 font-semibold mt-1">
              <div className="w-8 h-8 rounded-full bg-[#5B247A] text-white flex items-center justify-center font-bold shadow-sm relative">
                {stats.answered_marked}
                <div className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-white"></div>
              </div>
              <span className="leading-tight flex-1">Answered & Marked for Review (will be considered for evaluation)</span>
            </div>
          </div>

          {/* Palette Grid */}
          <div className="flex-1 p-4 bg-blue-50/30 overflow-y-auto">
            <div className="bg-[#EBEBEB] text-[#297FC6] font-bold py-1 px-2 border-b border-[#297FC6] text-xs uppercase mb-2 inline-block">
              {test.title}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-y-2 gap-x-1 justify-items-center">
              {test.questions.map((_, i) => {
                const status = getQuestionStatus(i);
                let shapeClass = "w-10 h-9 font-bold text-sm flex items-center justify-center relative";
                let innerContent = (i + 1).toString().padStart(2, '0');

                if (status === 'not_visited') {
                  shapeClass += " bg-white border border-gray-400 text-gray-800 rounded-sm";
                } else if (status === 'not_answered') {
                  shapeClass += " text-white";
                  innerContent = <div className="absolute inset-0 bg-[#D9534F] flex items-center justify-center" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 70%, 70% 100%, 0% 100%)' }}>{innerContent}</div> as any;
                } else if (status === 'answered') {
                  shapeClass += " text-white";
                  innerContent = <div className="absolute inset-0 bg-[#5CB85C] flex items-center justify-center" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 30% 100%, 0% 70%)' }}>{innerContent}</div> as any;
                } else if (status === 'marked_review') {
                  shapeClass += " text-white";
                  innerContent = <div className="absolute inset-0 bg-[#5B247A] rounded-full flex items-center justify-center w-9 h-9 mx-auto">{innerContent}</div> as any;
                } else if (status === 'answered_marked') {
                  shapeClass += " text-white";
                  innerContent = <div className="absolute inset-0 mx-auto w-9 h-9"><div className="w-full h-full bg-[#5B247A] rounded-full flex items-center justify-center">{innerContent}</div><div className="absolute right-0 bottom-0 w-3 h-3 bg-[#5CB85C] rounded-full border border-white"></div></div> as any;
                }

                return (
                  <button onClick={() => navigateToQuestion(i)} key={i} className={shapeClass}>
                    {innerContent}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {mobileDetected && (
        <div className="fixed inset-0 z-[100] bg-red-950/20 backdrop-blur-[2px] pointer-events-none flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce border-4 border-white/20">
            <div className="p-3 bg-white/20 rounded-full">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xl font-black uppercase tracking-tighter">Mobile Device Detected!</p>
              <p className="text-sm font-medium opacity-90">Avoid using mobile phones. This incident is being recorded.</p>
            </div>
          </div>
        </div>
      )}

      {showMalpracticeWarning && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border-b-8 border-yellow-500">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">Warning: Screen Left</h2>
            <p className="text-gray-600 mb-8 leading-relaxed font-medium">
              You switched tabs or left the test screen. This is a violation of exam rules.
              <br /><span className="text-red-600 font-bold mt-2 block">Violation: {violations}/3</span>
            </p>
            <button
              onClick={() => setShowMalpracticeWarning(false)}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95 text-lg"
            >
              I Understand, Continue Test
            </button>
          </div>
        </div>
      )}

      {isMalpracticeTerminated && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-red-950/90 backdrop-blur-md p-4 animate-in fade-in duration-500">
          <div className="bg-white rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.3)] max-w-md w-full p-10 text-center border-t-8 border-red-600">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
              <ShieldCheck className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-3xl font-black text-red-600 mb-4 uppercase tracking-tighter">Test Terminated</h2>
            <p className="text-xl font-bold text-gray-900 mb-2">MALPRACTICE DETECTED</p>
            <p className="text-gray-600 mb-10 leading-relaxed font-semibold">
              You have exceeded the maximum number of warnings for leaving the test screen.
              The test has been suspended and reported.
            </p>
            <div className="flex items-center justify-center gap-3 text-red-600 font-bold animate-bounce text-lg">
              <span className="w-2 h-2 bg-red-600 rounded-full"></span>
              SUBMITTING RESULTS...
            </div>
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Submit Exam</h2>
            <p className="text-gray-600 text-sm mb-6">Are you sure you want to submit the exam? Once submitted, you cannot change your answers.</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-6 py-2 border border-blue-600 text-blue-600 font-bold rounded hover:bg-blue-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => finalSubmit()}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors shadow-md"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
