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
import { setManualSelection, extractSelectionText } from '@/features/origin-ai/highlight-capture';

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // --- State for Canvas Annotations ---
    const [activeTool, setActiveTool] = useState<'none' | 'pen' | 'highlight' | 'eraser'>('none');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Synchronize selection from iframe to parent for Origin AI
    useEffect(() => {
        const handleIframeSelection = () => {
            if (!iframeRef.current?.contentDocument) return;
            const selection = iframeRef.current.contentDocument.getSelection();
            if (selection && selection.toString()) {
                const cleanText = extractSelectionText(selection);
                setManualSelection(cleanText);
            } else {
                setManualSelection(null);
            }
        };

        const attachListener = () => {
            const doc = iframeRef.current?.contentDocument;
            if (doc) {
                doc.addEventListener('selectionchange', handleIframeSelection);
            }
        };

        const iframe = iframeRef.current;
        if (iframe) {
            iframe.addEventListener('load', attachListener);
            attachListener();
        }

        return () => {
            if (iframe) {
                iframe.removeEventListener('load', attachListener);
                const doc = iframe.contentDocument;
                if (doc) {
                    doc.removeEventListener('selectionchange', handleIframeSelection);
                }
            }
        };
    }, []);
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
        <div className={`flex flex-col h-screen bg-background text-foreground font-sans transition-all duration-300 relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>

            {/* ----- Header ----- */}
            <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-background/80 backdrop-blur-xl border-b border-border shadow-sm z-20 shrink-0 transition-colors">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="hidden md:flex flex-col">
                        <h1 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">{book.title}</h1>
                        <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{book.subject} • Class {book.bookClass}</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-1 p-1 rounded-full bg-muted border border-border shadow-inner">
                    <ToolbarButton
                        icon={Type}
                        active={activeTool === 'none'}
                        onClick={() => setActiveTool('none')}
                        tooltip="Select text / Scroll"
                        activeBg="bg-card"
                        activeColor="text-primary"
                    />
                    <div className="w-px h-5 bg-border mx-1"></div>
                    <ToolbarButton
                        icon={Pencil}
                        active={activeTool === 'pen'}
                        onClick={() => setActiveTool('pen')}
                        activeColor="text-blue-600"
                        activeBg="bg-blue-100/50"
                        tooltip="Pen"
                    />
                    <ToolbarButton
                        icon={Highlighter}
                        active={activeTool === 'highlight'}
                        onClick={() => setActiveTool('highlight')}
                        activeColor="text-amber-600"
                        activeBg="bg-amber-100/50"
                        tooltip="Highlighter"
                    />
                    <ToolbarButton
                        icon={Eraser}
                        active={activeTool === 'eraser'}
                        onClick={() => setActiveTool('eraser')}
                        tooltip="Eraser"
                    />
                    <div className="w-px h-5 bg-border mx-1"></div>
                    <Button variant="ghost" size="icon" onClick={clearCanvas} className="w-8 h-8 rounded-full text-destructive hover:bg-destructive/10">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant={isSidebarOpen ? "secondary" : "default"}
                        size="sm"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="h-9 px-4 rounded-full text-xs font-bold shadow-sm transition-all active:scale-95"
                    >
                        <PenTool className="w-4 h-4 mr-2" />
                        {isSidebarOpen ? 'Hide Notes' : 'Show Notes'}
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-9 px-4 text-xs font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 hidden sm:flex"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Sync
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full hidden sm:flex"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </Button>
                </div>
            </header>

            {/* ----- Main Split View ----- */}
            <div className="flex-1 flex overflow-hidden">

                {/* --- Left: Document Viewer --- */}
                <div className="flex-1 relative flex flex-col bg-muted/30 transition-colors">

                    {/* Chapter Tabs */}
                    <div className="flex overflow-x-auto no-scrollbar bg-background/50 border-b border-border py-2 px-4 gap-2 backdrop-blur-sm z-10 shrink-0">
                        {book.chapters.map(ch => (
                            <button
                                key={ch.id}
                                onClick={() => setActiveChapter(ch.id)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeChapter === ch.id
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'bg-background/80 text-muted-foreground border border-border hover:bg-background hover:text-primary'
                                    }`}
                            >
                                {ch.title}
                            </button>
                        ))}
                    </div>

                    {/* Document Content Area */}
                    <div
                        ref={containerRef}
                        className="flex-1 overflow-hidden relative flex justify-center bg-muted/10"
                    >
                        {/* The PDF Container - Now maximized */}
                        <div className="w-full h-full relative">
                            {(() => {
                                const activeChapterMeta = book.chapters.find(c => c.id === activeChapter);
                                const pdfFile = activeChapterMeta?.pdfFile;
                                const basePath = book.basePath;
                                if (pdfFile && basePath) {
                                    const pdfUrl = `/books/${basePath}/${pdfFile}#toolbar=0&navpanes=0&scrollbar=1`;
                                    return (
                                        <iframe
                                            ref={iframeRef}
                                            src={pdfUrl}
                                            className="w-full h-full border-none"
                                            title="NCERT Viewer"
                                        />
                                    );
                                }
                                return (
                                    <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                                        <p className="text-lg leading-relaxed text-slate-800 mb-6 font-serif">
                                            PDF source unavailable for this chapter.
                                        </p>
                                    </div>
                                );
                            })()}

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
                {isSidebarOpen && (
                    <div className="w-80 lg:w-96 bg-card backdrop-blur-xl border-l border-border flex flex-col shrink-0 z-20 shadow-[-5px_0_15px_rgba(0,0,0,0.05)] transition-all">
                        <div className="h-14 flex items-center justify-between px-5 border-b border-border bg-muted/50">
                            <div className="flex items-center gap-2">
                                <PenTool className="w-4 h-4 text-primary" />
                                <span className="font-bold text-sm tracking-wide text-foreground">Smart Notebook</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-bold bg-primary/5 text-primary border-primary/20">AUTO-SYNC</Badge>
                        </div>

                        <div className="p-4 border-b border-border bg-muted/20">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search your notes..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-9 pl-9 bg-background border-border text-xs text-foreground rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="flex-1 p-5 overflow-y-auto bg-card">
                            <textarea
                                value={markdownNote}
                                onChange={(e) => setMarkdownNote(e.target.value)}
                                className="w-full h-full bg-transparent border-none resize-none focus:ring-0 text-foreground text-sm leading-relaxed font-sans placeholder:text-muted-foreground/50 outline-none"
                                placeholder="Type your notes here... Supports markdown formatting."
                            />
                        </div>
                    </div>
                )}

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
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
        >
            <Icon className={`w-4 h-4 ${active ? 'stroke-[2.5px]' : ''}`} />
        </button>
    );
}
