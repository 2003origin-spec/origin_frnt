'use client';
import { useState } from 'react';
import {
    PlusCircle,
    CheckCircle2,
    Download,
    Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ncertBooksData, ncertClasses, ncertSubjectsByClass } from '@/data/ncertBooks';
import type { NCERTBook } from '@/data/ncertBooks';
import GlassSurface from '@/components/ui/GlassSurface';
import NCERTReader from './NCERTReader';

interface NCERTCornerProps {
    onAddBook: (book: any, folderName: string) => void;
    existingFolders: string[];
}

export default function NCERTCorner({ onAddBook, existingFolders }: NCERTCornerProps) {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedBookId, setSelectedBookId] = useState('');
    const [viewingBook, setViewingBook] = useState<NCERTBook | null>(null);
    const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
    const [isAdded, setIsAdded] = useState(false);

    const subjects = selectedClass ? ncertSubjectsByClass[selectedClass] || [] : [];
    const books = ncertBooksData.filter(
        (b) => b.bookClass === selectedClass && b.subject === selectedSubject
    );

    const handleGo = () => {
        const book = ncertBooksData.find((b) => b.id === selectedBookId);
        if (book) {
            // Transform NCERTBook to Book type for NCERTReader
            const readerBook = {
                id: book.id,
                title: book.title,
                bookClass: book.bookClass,
                subject: book.subject,
                coverImage: 'https://images.unsplash.com/photo-1636466497769-f81855aebf13?auto=format&fit=crop&q=80&w=400',
                isLiked: false,
                chapters: (book.chapters || []).map(ch => ({ ...ch, pages: 0 }))
            };
            setViewingBook(readerBook as any);
            if (book.chapters && book.chapters.length > 0) {
                setActiveChapterId(book.chapters[0].id);
            }
        }
    };

    const handleAddToLibrary = () => {
        if (viewingBook) {
            onAddBook(viewingBook, viewingBook.subject);
            setIsAdded(true);
            setTimeout(() => setIsAdded(false), 3000);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] bg-[#F1F3F4] dark:bg-[#020617] rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-500 border border-white/10">

            {/* 1. Official Header Style */}
            <div className="relative h-24 shrink-0 overflow-hidden">
                {/* Background Image Mockup */}
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400/80 to-yellow-500/80 z-10"></div>
                <img
                    src="https://images.unsplash.com/photo-1523050853064-909241584b80?auto=format&fit=crop&q=80&w=1200"
                    alt="Education"
                    className="absolute inset-0 w-full h-full object-cover grayscale mix-blend-overlay"
                />
                <div className="relative z-20 h-full flex items-center px-10">
                    <h1 className="text-3xl font-black text-white italic tracking-tight drop-shadow-md">
                        Textbooks PDF (I-XII)
                    </h1>
                </div>
            </div>

            {/* 2. Selection Bar (Maroon Style) */}
            <div className="bg-[#880E4F] p-4 flex flex-wrap items-center justify-center gap-3 shrink-0 z-30 shadow-lg border-y border-white/5">
                <select
                    value={selectedClass}
                    onChange={(e) => {
                        setSelectedClass(e.target.value);
                        setSelectedSubject('');
                        setSelectedBookId('');
                    }}
                    className="h-10 px-3 rounded text-slate-800 text-xs font-bold border-none outline-none min-w-[150px] bg-white hover:bg-slate-50 transition-colors"
                >
                    <option value="">..Select Class..</option>
                    {ncertClasses.map((c) => (
                        <option key={c} value={c}>Class {c}</option>
                    ))}
                </select>

                <select
                    value={selectedSubject}
                    onChange={(e) => {
                        setSelectedSubject(e.target.value);
                        setSelectedBookId('');
                    }}
                    disabled={!selectedClass}
                    className="h-10 px-3 rounded text-slate-800 text-xs font-bold border-none outline-none min-w-[150px] bg-white disabled:opacity-50"
                >
                    <option value="">..Select Subject..</option>
                    {subjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                <select
                    value={selectedBookId}
                    onChange={(e) => setSelectedBookId(e.target.value)}
                    disabled={!selectedSubject}
                    className="h-10 px-3 rounded text-slate-800 text-xs font-bold border-none outline-none min-w-[180px] bg-white disabled:opacity-50"
                >
                    <option value="">..Select Book Title..</option>
                    {books.map((b) => (
                        <option key={b.id} value={b.id}>{b.title}</option>
                    ))}
                </select>

                <Button
                    onClick={handleGo}
                    disabled={!selectedBookId}
                    className="h-10 px-6 bg-white hover:bg-slate-100 text-[#880E4F] font-black text-xs rounded transition-all active:scale-95 disabled:opacity-50 border border-[#880E4F]/20"
                >
                    Go
                </Button>
            </div>

            {/* 3. Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">

                {viewingBook ? (
                    <>
                        {/* Sidebar: Chapter Links */}
                        <div className="w-72 bg-[#EBEBEB] dark:bg-[#030712]/40 border-r border-[#D1D1D1] dark:border-white/5 overflow-y-auto shrink-0 custom-scrollbar">
                            <div className="p-4">
                                <h3 className="text-[#880E4F] dark:text-pink-400 font-black text-xs uppercase tracking-wider mb-4 border-b border-[#880E4F]/20 pb-2">
                                    {viewingBook.title}
                                </h3>
                                <div className="space-y-1">
                                    {viewingBook.chapters?.map((ch) => (
                                        <button
                                            key={ch.id}
                                            onClick={() => setActiveChapterId(ch.id)}
                                            className={`w-full text-left px-3 py-2.5 text-[11px] font-bold transition-all flex items-center justify-between group rounded-md ${activeChapterId === ch.id
                                                ? 'bg-[#880E4F] text-white shadow-md'
                                                : 'text-[#880E4F] dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <span className="truncate">{ch.title}</span>
                                            <span className={`text-[9px] font-medium opacity-70 group-hover:opacity-100 italic transition-opacity ${activeChapterId === ch.id ? 'text-white' : 'text-[#880E4F] dark:text-slate-400'}`}>
                                                (Open)
                                            </span>
                                        </button>
                                    ))}

                                    <button
                                        onClick={handleAddToLibrary}
                                        className="w-full mt-6 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 border border-indigo-400/30"
                                    >
                                        {isAdded ? (
                                            <><CheckCircle2 className="w-4 h-4" /> Added to Study Corner</>
                                        ) : (
                                            <><PlusCircle className="w-4 h-4" /> Add to Study Corner</>
                                        )}
                                    </button>
                                </div>
                                <div className="mt-8 pt-4 border-t border-slate-300 dark:border-white/5">
                                    <button className="text-[#880E4F] dark:text-pink-400 font-bold text-[10px] uppercase tracking-widest hover:underline flex items-center gap-2">
                                        <Download className="w-3 h-3" /> Download complete book
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Unified Reader Integration */}
                        <div className="flex-1 bg-white relative">
                            {viewingBook && activeChapterId && (
                                <NCERTReader
                                    book={viewingBook as any}
                                    activeChapterId={activeChapterId}
                                    onBack={() => setViewingBook(null)}
                                />
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-8 animate-in fade-in duration-1000">
                        <div className="w-32 h-32 rounded-[2.5rem] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner group">
                            <PlusCircle className="w-16 h-16 text-indigo-400 group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div className="max-w-md space-y-4">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Ready to Explore?</h2>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                Use the official NCERT selection panel above to find your textbooks. You can browse chapters, highlight key concepts, and sync everything directly to your Study Corner.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mt-8">
                            <GlassSurface className="p-6 border-white/10 group cursor-pointer hover:border-indigo-500/40 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400"><PlusCircle className="w-5 h-5" /></div>
                                    <div className="text-left">
                                        <span className="block text-xs font-black text-white uppercase tracking-wider">Storage Target</span>
                                        <select className="bg-transparent text-[10px] text-slate-400 font-bold uppercase outline-none border-none cursor-pointer">
                                            {existingFolders.map(f => (
                                                <option key={f} value={f} className="bg-[#020617]">{f}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </GlassSurface>
                            <GlassSurface className="p-6 border-white/10 group cursor-pointer hover:border-amber-500/40 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400"><Save className="w-5 h-5" /></div>
                                    <div className="text-left">
                                        <span className="block text-xs font-black text-white uppercase tracking-wider">Auto-Sync</span>
                                        <span className="block text-[10px] text-slate-500 font-bold uppercase">Cloud persistence on</span>
                                    </div>
                                </div>
                            </GlassSurface>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
