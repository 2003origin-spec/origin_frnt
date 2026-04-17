'use client';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Sparkles,
  Target,
  RotateCcw,
  Send,
  MessageCircle,
  Lightbulb,
  ArrowRight
} from 'lucide-react';
import { dppQuestions } from '@/data/mockData';
import { renderFormattedExplanation, renderInlineSegments, renderQuestionText } from '@/lib/math-text';
import type { User } from '@/types';

interface DPPViewProps {
  onBack: () => void;
  user: User;
}

export default function DPPView({ onBack }: DPPViewProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  const [answers, setAnswers] = useState<(number | null)[]>(new Array(dppQuestions.length).fill(null));
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', message: string }[]>([
    { role: 'ai', message: 'Hi! I\'m your AI mentor. I can help explain the concepts in these DPP questions. What would you like to know?' }
  ]);

  const currentQuestion = dppQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / dppQuestions.length) * 100;

  const handleOptionSelect = (optionIndex: number) => {
    if (showSolution) return;
    setSelectedOption(optionIndex);
  };

  const handleCheck = () => {
    if (selectedOption === null) return;
    setShowSolution(true);
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = selectedOption;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < dppQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setShowSolution(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setSelectedOption(answers[currentQuestionIndex - 1]);
      setShowSolution(answers[currentQuestionIndex - 1] !== null);
    }
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;

    setChatHistory([...chatHistory, { role: 'user', message: chatMessage }]);

    // Simulate AI response
    setTimeout(() => {
      setChatHistory(prev => [...prev, {
        role: 'ai',
        message: `Great question! This problem tests your understanding of ${currentQuestion.concept}. The key insight is to remember that ${currentQuestion.explanation.split('.')[0]}. Would you like me to explain the step-by-step solution?`
      }]);
    }, 1000);

    setChatMessage('');
  };

  const correctCount = answers.filter((a, i) => a === dppQuestions[i].correctOption).length;
  const isCompleted = answers.every(a => a !== null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Header */}
      <header className="z-40 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Daily Practice Problems</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Personalized based on your weak areas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-[#3CACA3]/10 text-[#3CACA3] dark:bg-[#3CACA3]/20">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Generated
              </Badge>
            </div>
          </div>
        </div>
        <Progress value={progress} className="h-1 rounded-none" />
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isCompleted ? (
          // Completion View
          <Card className="border-0 shadow-lg dark:bg-slate-900/60 dark:ring-1 dark:ring-white/10">
            <CardContent className="p-8 text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#3CACA3] to-[#1E3A5F] flex items-center justify-center mb-6">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">DPP Completed! 🎉</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Great job completing your personalized practice set!
              </p>

              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
                  <div className="text-3xl font-bold text-green-600">{correctCount}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Correct</div>
                </div>
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20">
                  <div className="text-3xl font-bold text-red-600">{dppQuestions.length - correctCount}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Wrong</div>
                </div>
                <div className="p-4 rounded-xl bg-[#3CACA3]/10 dark:bg-[#3CACA3]/20">
                  <div className="text-3xl font-bold text-[#3CACA3]">
                    {Math.round((correctCount / dppQuestions.length) * 100)}%
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Accuracy</div>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentQuestionIndex(0);
                    setSelectedOption(null);
                    setShowSolution(false);
                    setAnswers(new Array(dppQuestions.length).fill(null));
                  }}
                  className="rounded-full"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retry DPP
                </Button>
                <Button
                  onClick={onBack}
                  className="rounded-full bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] text-white"
                >
                  Back to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Question View
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Question Area */}
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-lg dark:bg-slate-900/60 dark:ring-1 dark:ring-white/10">
                <CardContent className="p-6 sm:p-8">
                  {/* Question Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <Badge className="bg-[#3CACA3]/10 text-[#3CACA3]">
                      Q{currentQuestionIndex + 1} of {dppQuestions.length}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {currentQuestion.difficulty}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {currentQuestion.subject}
                    </Badge>
                  </div>

                  {/* Question */}
                  <div className="text-xl font-medium text-slate-900 dark:text-white mb-6 leading-relaxed">
                    {renderQuestionText(currentQuestion.text, 'dpp-question')}
                  </div>

                  {/* Options */}
                  <div className="space-y-3 mb-6">
                    {currentQuestion.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleOptionSelect(index)}
                        disabled={showSolution}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${showSolution
                          ? index === currentQuestion.correctOption
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : selectedOption === index
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-slate-200 dark:border-slate-700 opacity-50'
                          : selectedOption === index
                            ? 'border-[#3CACA3] bg-[#3CACA3]/5 dark:bg-[#3CACA3]/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-[#3CACA3]/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${showSolution
                            ? index === currentQuestion.correctOption
                              ? 'bg-green-500 text-white'
                              : selectedOption === index
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            : selectedOption === index
                              ? 'bg-[#3CACA3] text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                            {showSolution && index === currentQuestion.correctOption ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : showSolution && selectedOption === index ? (
                              <XCircle className="w-5 h-5" />
                            ) : (
                              String.fromCharCode(65 + index)
                            )}
                          </div>
                          <span className={`text-lg ${showSolution && index === currentQuestion.correctOption
                            ? 'text-green-700 dark:text-green-400'
                            : showSolution && selectedOption === index
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-slate-700 dark:text-slate-300'
                            }`}>
                            {renderInlineSegments(String(option), `dpp-option-${index}`)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Solution */}
                  {showSolution && (
                    <div className="mb-6 p-6 rounded-xl bg-[#3CACA3]/5 dark:bg-[#3CACA3]/10 border border-[#3CACA3]/20">
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-[#3CACA3]" />
                        Explanation
                      </h4>
                      <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {renderFormattedExplanation(currentQuestion.explanation)}
                      </div>
                      <div className="mt-4 pt-4 border-t border-[#3CACA3]/20">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-900 dark:text-white">Concept:</strong> {currentQuestion.concept}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={currentQuestionIndex === 0}
                      className="rounded-full"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>

                    {!showSolution ? (
                      <Button
                        onClick={handleCheck}
                        disabled={selectedOption === null}
                        className="rounded-full bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] text-white"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Check Answer
                      </Button>
                    ) : (
                      <Button
                        onClick={handleNext}
                        className="rounded-full bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] text-white"
                      >
                        {currentQuestionIndex === dppQuestions.length - 1 ? 'Finish' : 'Next'}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Progress Card */}
              <Card className="border-0 shadow-soft dark:bg-slate-900/60 dark:ring-1 dark:ring-white/10">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Progress</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {dppQuestions.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setCurrentQuestionIndex(index);
                          setSelectedOption(answers[index]);
                          setShowSolution(answers[index] !== null);
                        }}
                        className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${index === currentQuestionIndex
                          ? 'ring-2 ring-[#3CACA3] ring-offset-2'
                          : ''
                          } ${answers[index] !== null
                            ? answers[index] === dppQuestions[index].correctOption
                              ? 'bg-green-500 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-slate-100 text-slate-400'
                          }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI Helper Card */}
              <Card className="border-0 shadow-soft bg-gradient-to-br from-[#3CACA3] to-[#1E3A5F] text-white dark:ring-1 dark:ring-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <img src="/ai-bot.png" className="w-6 h-6 object-cover rounded-sm" />
                    <h3 className="font-semibold">Stuck on this?</h3>
                  </div>
                  <p className="text-white/80 text-sm mb-4">
                    Ask your AI mentor for hints without seeing the full solution.
                  </p>
                  <Button
                    onClick={() => setShowAIChat(true)}
                    variant="secondary"
                    className="w-full rounded-full bg-white text-[#3CACA3] hover:bg-white/90"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Ask AI Mentor
                  </Button>
                </CardContent>
              </Card>

              {/* Topic Info */}
              <Card className="border-0 shadow-soft dark:bg-slate-900/60 dark:ring-1 dark:ring-white/10">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#3CACA3]" />
                    Focus Areas
                  </h3>
                  <div className="space-y-2">
                    <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                      Redox Reactions
                    </Badge>
                    <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ml-2">
                      Equilibrium
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                    These DPP questions are designed to strengthen your understanding of these concepts.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* AI Chat Modal */}
      {showAIChat && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg border-0 shadow-2xl max-h-[80vh] flex flex-col dark:bg-slate-900 dark:ring-1 dark:ring-white/10">
            <CardContent className="p-4 flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3CACA3] to-[#1E3A5F] flex items-center justify-center overflow-hidden p-1">
                    <img src="/ai-bot.png" alt="AI Mentor" className="w-full h-full object-cover rounded-full" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">AI Mentor</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Here to guide, not give answers!</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAIChat(false)}
                  className="p-2 rounded-lg hover:bg-slate-100"
                >
                  <XCircle className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Chat History */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 max-h-64">
                {chatHistory.map((msg, index) => (
                  <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user'
                      ? 'bg-slate-200'
                      : 'bg-gradient-to-br from-[#3CACA3] to-[#1E3A5F]'
                      }`}>
                      {msg.role === 'user' ? (
                        <span className="text-sm font-medium text-slate-700">You</span>
                      ) : (
                        <img src="/ai-bot.png" className="w-full h-full object-cover rounded-full" />
                      )}
                    </div>
                    <div className={`rounded-lg p-3 max-w-[80%] ${msg.role === 'user'
                      ? 'bg-[#3CACA3] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2 pt-4 border-t">
                <input
                  type="text"
                  placeholder="Ask for a hint..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:border-[#3CACA3] focus:outline-none focus:ring-2 focus:ring-[#3CACA3]/20"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button
                  className="rounded-full bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] text-white"
                  onClick={handleSendMessage}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
