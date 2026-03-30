'use client';
import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronLeft,
    BookOpen,
    Pencil,
    Highlighter,
    Eraser,
    Save,
    Search,
    Maximize2,
    X,
    Type,
    PenTool
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiCall } from '@/lib/api';
import type { Book, Note } from '@/types';

interface Stroke {
    type: 'pen' | 'highlight';
    points: { x: number; y: number }[];
}

interface NCERTReaderProps {
    book: Book;
    onBack: () => void;
    initialNotes?: Note[];
    activeChapterId?: string;
}

export default function NCERTReader({ book, onBack, initialNotes = [], activeChapterId }: NCERTReaderProps) {
    // --- State for Reader & Notebook ---
    const [markdownNote, setMarkdownNote] = useState(
        initialNotes.map(n => n.content).join('\n\n') || `# Notes for ${book.title}\n\nStart typing here...`
    );
    const [activeChapter, setActiveChapter] = useState(activeChapterId || book.chapters[0]?.id);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // --- State for Canvas Annotations ---
    const [activeTool, setActiveTool] = useState<'none' | 'pen' | 'highlight' | 'eraser'>('none');
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawing = useRef(false);

    const [noteId, setNoteId] = useState<number | null>(null);

    // --- Load Saved Strokes and Notes on Mount ---
    useEffect(() => {
        const savedStrokes = localStorage.getItem(`origin_strokes_${book.id}`);
        if (savedStrokes) {
            try {
                setStrokes(JSON.parse(savedStrokes));
            } catch (e) {
                console.error("Failed to parse saved strokes", e);
            }
        }
        // Fetch real notes from backend API
        const fetchNotes = async () => {
            try {
                const notes = await apiCall('/study/notes/');
                const bookNote = notes.find((n: any) => n.book === book.id || n.book?.id === book.id);
                if (bookNote) {
                    setMarkdownNote(bookNote.content);
                    setNoteId(bookNote.id);
                }
            } catch (error) {
                console.error("Failed to fetch notes", error);
            }
        };
        fetchNotes();
    }, [book.id]);

    // --- Auto-save Notes & Strokes ---
    const handleSave = async () => {
        localStorage.setItem(`origin_strokes_${book.id}`, JSON.stringify(strokes));

        try {
            if (noteId) {
                // Update existing note
                await apiCall(`/study/notes/${noteId}/`, {
                    method: 'PUT',
                    body: JSON.stringify({ book: book.id, content: markdownNote })
                });
            } else {
                // Create new note
                const newNote = await apiCall('/study/notes/', {
                    method: 'POST',
                    body: JSON.stringify({ book: book.id, content: markdownNote })
                });
                setNoteId(newNote.id);
            }
            console.log("Saved annotations and notes.");
        } catch (error) {
            console.error("Failed to save note", error);
        }
    };

    // --- Canvas Drawing Logic ---
    const redrawCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawLine = (stroke: Stroke) => {
            if (stroke.points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }

            if (stroke.type === 'highlight') {
                ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)'; // Yellow-400 with opacity
                ctx.lineWidth = 24;
                ctx.lineCap = 'butt';
                ctx.lineJoin = 'miter';
                ctx.globalCompositeOperation = 'multiply'; // Makes highlight look realistic on text
            } else {
                ctx.strokeStyle = '#3b82f6'; // Blue-500 ink
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalCompositeOperation = 'source-over';
            }

            ctx.stroke();
        };

        strokes.forEach(drawLine);
        if (currentStroke) drawLine(currentStroke);
    };

    useEffect(() => {
        redrawCanvas();
    }, [strokes, currentStroke]);

    useEffect(() => {
        // Resize canvas to match container
        const resizeCanvas = () => {
            if (containerRef.current && canvasRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                canvasRef.current.width = clientWidth;
                canvasRef.current.height = clientHeight;
                redrawCanvas();
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (activeTool === 'none') return;
        isDrawing.current = true;
        const { x, y } = getCoordinates(e);

        if (activeTool === 'eraser') {
            eraseStroke(x, y);
        } else {
            setCurrentStroke({
                type: activeTool,
                points: [{ x, y }]
            });
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current || activeTool === 'none') return;
        const { x, y } = getCoordinates(e);

        if (activeTool === 'eraser') {
            eraseStroke(x, y);
        } else if (currentStroke) {
            setCurrentStroke(prev => prev ? {
                ...prev,
                points: [...prev.points, { x, y }]
            } : null);
        }
    };

    const stopDrawing = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;

        if (currentStroke && currentStroke.points.length > 2) {
            setStrokes(prev => [...prev, currentStroke]);
        }
        setCurrentStroke(null);
    };

    const eraseStroke = (x: number, y: number) => {
        const ERASER_RADIUS = 20;
        setStrokes(prev => prev.filter(stroke => {
            const isHit = stroke.points.some(p =>
                Math.hypot(p.x - x, p.y - y) < ERASER_RADIUS
            );
            return !isHit;
        }));
    };

    const clearCanvas = () => {
        if (window.confirm("Clear all annotations on this page?")) {
            setStrokes([]);
            localStorage.removeItem(`origin_strokes_${book.id}`);
        }
    };

    return (
        <div className={`flex flex-col h-screen bg-[#F8FAFC] dark:bg-[#060D1A] text-slate-900 dark:text-slate-200 font-sans transition-all duration-300 relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>

            {/* ----- Header ----- */}
            <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white/80 dark:bg-[#030712]/50 backdrop-blur-xl border-b border-slate-200 dark:border-indigo-500/10 shadow-sm dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-20 shrink-0 transition-colors">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20 dark:border-indigo-500/30 shadow-sm dark:shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">{book.title}</h1>
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">{book.subject} • Class {book.bookClass}</p>
                        </div>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-1 p-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-inner">
                    <ToolbarButton
                        icon={Type}
                        active={activeTool === 'none'}
                        onClick={() => setActiveTool('none')}
                        tooltip="Select text / Scroll"
                        activeBg="bg-white dark:bg-white/20"
                        activeColor="text-indigo-600 dark:text-white"
                    />
                    <div className="w-px h-5 bg-slate-300 dark:bg-white/10 mx-1"></div>
                    <ToolbarButton
                        icon={Pencil}
                        active={activeTool === 'pen'}
                        onClick={() => setActiveTool('pen')}
                        activeColor="text-blue-600 dark:text-blue-400"
                        activeBg="bg-blue-100 dark:bg-blue-500/20"
                        tooltip="Pen"
                    />
                    <ToolbarButton
                        icon={Highlighter}
                        active={activeTool === 'highlight'}
                        onClick={() => setActiveTool('highlight')}
                        activeColor="text-amber-600 dark:text-yellow-400"
                        activeBg="bg-amber-100 dark:bg-yellow-500/20"
                        tooltip="Highlighter"
                    />
                    <ToolbarButton
                        icon={Eraser}
                        active={activeTool === 'eraser'}
                        onClick={() => setActiveTool('eraser')}
                        tooltip="Eraser"
                    />
                    <div className="w-px h-5 bg-slate-300 dark:bg-white/10 mx-1"></div>
                    <Button variant="ghost" size="icon" onClick={clearCanvas} className="w-8 h-8 rounded-full text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleSave}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full h-9 px-4 text-xs font-bold shadow-lg shadow-indigo-500/20 dark:shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all active:scale-95"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Sync Progress
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full hidden sm:flex"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </Button>
                </div>
            </header>

            {/* ----- Main Split View ----- */}
            <div className="flex-1 flex overflow-hidden">

                {/* --- Left: Document Viewer --- */}
                <div className="flex-1 relative flex flex-col bg-slate-200 dark:bg-[#0f1423] transition-colors">

                    {/* Chapter Tabs */}
                    <div className="flex overflow-x-auto no-scrollbar bg-white/50 dark:bg-[#030712]/40 border-b border-slate-200 dark:border-white/5 py-2 px-4 gap-2 backdrop-blur-sm z-10 shrink-0">
                        {book.chapters.map(ch => (
                            <button
                                key={ch.id}
                                onClick={() => setActiveChapter(ch.id)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeChapter === ch.id
                                    ? 'bg-indigo-600 text-white dark:bg-indigo-500/20 dark:text-indigo-300 shadow-md dark:border dark:border-indigo-500/30'
                                    : 'bg-white/80 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-transparent hover:bg-white dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-slate-200'
                                    }`}
                            >
                                {ch.title}
                            </button>
                        ))}
                    </div>

                    {/* Document Content Area */}
                    <div
                        ref={containerRef}
                        className="flex-1 overflow-y-auto relative flex justify-center p-4 sm:p-8 custom-scrollbar"
                    >
                        {/* The "Paper" Container */}
                        <div className="w-full max-w-4xl min-h-[1200px] bg-white dark:bg-[#FAF9F6] rounded-sm shadow-2xl relative text-slate-900 mx-auto transition-transform origin-top">

                            {/* Text Content (Mock) */}
                            <div className="p-10 sm:p-16 max-w-3xl mx-auto select-auto">
                                <h2 className="text-3xl font-serif font-bold text-slate-900 mb-8 border-b-2 border-slate-200 pb-4">
                                    {book.chapters.find(c => c.id === activeChapter)?.title || 'Chapter Title'}
                                </h2>

                                <div className="w-full h-[1000px] bg-slate-100 rounded-sm overflow-hidden border border-slate-200 relative">
                                    {/* Use current chapter pdf path to render if it exists */}
                                    {book.chapters.find(c => c.id === activeChapter)?.pdfFile ? (
                                        <iframe
                                            src={`/books/${book.basePath}/${book.chapters.find(c => c.id === activeChapter)?.pdfFile}#toolbar=0&navpanes=0&scrollbar=1`}
                                            className="w-full h-full border-none"
                                            title="NCERT Viewer"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                                            <p className="text-lg leading-relaxed text-slate-800 mb-6 font-serif">
                                                This is a mock textual representation of the NCERT book content. In a full production environment, this container would house a <code className="bg-slate-100 px-1 rounded border border-slate-200 font-mono text-sm">react-pdf</code> viewer rendering the actual PDF document page by page.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <p className="text-lg leading-relaxed text-slate-800 mb-6 font-serif">
                                    However, representing the text in DOM elements first allows for vastly superior accessibility, crisp rendering on all devices, and makes native browser text-selection and searching trivial. The <strong>Antigravity theme</strong> surrounds this eye-friendly texture, reducing strain while keeping the core content highly legible.
                                </p>

                                <div className="my-8 p-6 bg-indigo-50 dark:bg-blue-50/50 border-l-4 border-indigo-500 dark:border-blue-500 rounded-xl shadow-sm">
                                    <h4 className="font-bold text-indigo-900 dark:text-blue-900 mb-2">Did You Know?</h4>
                                    <p className="text-indigo-800 dark:text-blue-800">You can use the highlighter tool from the top toolbar to mark any of this text. The canvas layer sits exactly on top of the text, allowing your strokes to persist across sessions!</p>
                                </div>

                                <p className="text-lg leading-relaxed text-slate-800 font-serif">
                                    Try grabbing the Pen tool (blue icon) and scribbling over this paragraph. Then switch to the Eraser to rub it out.
                                </p>
                            </div>

                            {/* Interactive Canvas Overlay */}
                            <canvas
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseOut={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className={`absolute top-0 left-0 w-full h-full z-10 touch-none ${activeTool === 'pen' ? 'cursor-crosshair' :
                                    activeTool === 'highlight' ? 'cursor-cell' :
                                        activeTool === 'eraser' ? 'cursor-alias' : 'cursor-text'
                                    }`}
                                style={{ pointerEvents: activeTool === 'none' ? 'none' : 'auto' }}
                            />
                        </div>
                    </div>
                </div>

                {/* --- Right: Personal Notebook Sidebar --- */}
                <div className="w-80 lg:w-96 bg-white dark:bg-[#030712]/80 backdrop-blur-xl border-l border-slate-200 dark:border-white/5 flex flex-col shrink-0 z-20 shadow-[-5px_0_15px_rgba(0,0,0,0.05)] dark:shadow-[-10px_0_30px_rgba(0,0,0,0.5)] transition-colors">
                    <div className="h-14 flex items-center justify-between px-5 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-transparent">
                        <div className="flex items-center gap-2">
                            <PenTool className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="font-bold text-sm tracking-wide text-slate-900 dark:text-white">Smart Notebook</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold bg-indigo-500/5 text-indigo-600 dark:text-indigo-300 border-indigo-500/20">AUTO-SYNC</Badge>
                    </div>

                    <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-slate-100/30 dark:bg-white/5">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <Input
                                placeholder="Search your notes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-9 pl-9 bg-white dark:bg-[#060D1A] border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500/20 dark:focus-visible:ring-indigo-500 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex-1 p-5 overflow-y-auto bg-white dark:bg-transparent">
                        <textarea
                            value={markdownNote}
                            onChange={(e) => setMarkdownNote(e.target.value)}
                            className="w-full h-full bg-transparent border-none resize-none focus:ring-0 text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-sans placeholder-slate-400 outline-none"
                            placeholder="Type your notes here... Supports markdown formatting."
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}

function ToolbarButton({ icon: Icon, active, onClick, activeColor, activeBg, tooltip }: any) {
    return (
        <button
            title={tooltip}
            onClick={onClick}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${active
                ? `${activeBg} ${activeColor} shadow-md scale-110`
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
        >
            <Icon className={`w-4 h-4 ${active ? 'stroke-[2.5px]' : ''}`} />
        </button>
    );
}
