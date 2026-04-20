/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit3, Check, X, Palette, MessageCircle, Send, Sparkles, Loader2, Image as ImageIcon, Camera, MoreVertical, CheckCircle2, Mic, MicOff, Pencil, Eraser, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

import { Stage, Layer, Line as KonvaLine } from 'react-konva';

interface DrawingLine {
  tool: string;
  points: number[];
  color: string;
  strokeWidth: number;
}

interface Note {
  id: string;
  text: string;
  color: string;
  rotation: number;
  image?: string;
  completed?: boolean;
  drawingLines?: DrawingLine[];
}

interface Template {
  id: string;
  name: string;
  text: string;
  color: string;
  drawingLines?: DrawingLine[];
  image?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

const COLORS = [
  'bg-note-red',
  'bg-note-orange',
  'bg-note-yellow',
  'bg-note-green',
  'bg-note-blue',
  'bg-note-indigo',
  'bg-note-purple',
];

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [editText, setEditText] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'text' | 'draw'>('text');
  const [drawTool, setDrawTool] = useState<'pen' | 'eraser'>('pen');
  const [drawColor, setDrawColor] = useState('#000000');
  
  const [isEditorMenuOpen, setIsEditorMenuOpen] = useState(false);
  
  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const drawingId = isDrawing ? activeNoteId : null;
  const editingId = !isDrawing ? activeNoteId : null;

  // Ref for hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastUploadTargetId, setLastUploadTargetId] = useState<string | null>(null);

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi! I'm your Rainbow assistant. I can help you organize your notes or brainstorm new ideas. What's on your mind?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Load notes and templates from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem('stickie-notes-rainbow');
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error('Failed to parse notes from local storage', e);
      }
    }
    const savedTemplates = localStorage.getItem('stickie-templates-rainbow');
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error('Failed to parse templates', e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('stickie-notes-rainbow', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('stickie-templates-rainbow', JSON.stringify(templates));
  }, [templates]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle outside clicks to close menus
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
      setIsHeaderMenuOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const addNote = (text = '', image?: string, drawingLines?: DrawingLine[], color?: string) => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      text,
      image,
      drawingLines,
      completed: false,
      color: color || COLORS[notes.length % COLORS.length], // Cyclic rainbow colors
      rotation: 0,
    };
    setNotes([newNote, ...notes]);
    if (!text && !image && !drawingLines) {
      setActiveNoteId(newNote.id);
      setIsDrawing(false);
      setEditText('');
    }
  };

  const saveAsTemplate = (note: Note) => {
    const name = prompt("Enter a name for this template:");
    if (!name) return;

    const newTemplate: Template = {
      id: crypto.randomUUID(),
      name,
      text: note.text,
      color: note.color,
      drawingLines: note.drawingLines,
      image: note.image
    };
    setTemplates([...templates, newTemplate]);
    setOpenMenuId(null);
    setIsEditorMenuOpen(false);
  };

  const applyTemplate = (template: Template) => {
    addNote(template.text, template.image, template.drawingLines, template.color);
    setIsTemplatesModalOpen(false);
    setIsHeaderMenuOpen(false);
  };

  const deleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplates(templates.filter(t => t.id !== id));
  };

  const deleteNote = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotes(notes.filter((n) => n.id !== id));
    if (activeNoteId === id) {
      setActiveNoteId(null);
    }
    setOpenMenuId(null);
  };

  const startEditing = (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveNoteId(note.id);
    setIsDrawing(false);
    setEditText(note.text);
    setOpenMenuId(null);
    setIsEditorMenuOpen(false);
  };

  const startDrawing = (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveNoteId(note.id);
    setIsDrawing(true);
    setEditText(note.text);
    setOpenMenuId(null);
    setIsEditorMenuOpen(false);
  };

  const saveNote = () => {
    if (activeNoteId) {
      setNotes(
        notes.map((n) =>
          n.id === activeNoteId ? { ...n, text: editText } : n
        )
      );
      setActiveNoteId(null);
      setIsEditorMenuOpen(false);
    }
  };

  const toggleComplete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotes(notes.map(n => n.id === id ? { ...n, completed: !n.completed } : n));
    setOpenMenuId(null);
  };

  const changeColor = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotes(
      notes.map((n) => {
        if (n.id === id) {
          const currentIndex = COLORS.indexOf(n.color);
          const nextIndex = (currentIndex + 1) % COLORS.length;
          return { ...n, color: COLORS[nextIndex] };
        }
        return n;
      })
    );
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (lastUploadTargetId) {
        // Update existing note
        setNotes(prev => prev.map(n => n.id === lastUploadTargetId ? { ...n, image: base64 } : n));
        setLastUploadTargetId(null);
      } else {
        // Create new note with image
        addNote('', base64);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input
    event.target.value = '';
    setOpenMenuId(null);
  };

  const removeImage = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, image: undefined } : n));
  };

  const triggerGallery = (noteId: string | null = null, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLastUploadTargetId(noteId);
    fileInputRef.current?.click();
    setOpenMenuId(null);
  };

  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const startVoiceRecording = (target: 'chat' | 'note' = 'chat', e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    if (!('webkitSpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      if (target === 'chat') {
        setIsChatOpen(true);
        setIsHeaderMenuOpen(false);
      }
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      
      if (target === 'chat') {
        setChatInput(transcript);
      } else {
        setEditText(prev => prev + (prev.length > 0 ? ' ' : '') + transcript);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const toggleDrawing = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeNoteId === id && isDrawing) {
      setIsDrawing(false);
    } else {
      setActiveNoteId(id);
      setIsDrawing(true);
      setOpenMenuId(null);
    }
  };

  // Resize observer for drawing canvas
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ width, height });
    });
    observer.observe(canvasContainerRef.current);
    return () => observer.disconnect();
  }, [activeNoteId, isDrawing]);

  const handleMouseDown = (e: any) => {
    if (!activeNoteId) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) {
      const note = notes.find(n => n.id === activeNoteId);
      const newLines = [...(note?.drawingLines || []), { 
        tool: drawTool, 
        points: [pos.x, pos.y], 
        color: drawColor,
        strokeWidth: drawTool === 'eraser' ? 40 : 4
      }];
      updateDrawing(activeNoteId, newLines);
    }
  };

  const handleMouseMove = (e: any) => {
    if (e.evt.buttons !== 1 || !activeNoteId) return;
    const pos = e.target.getStage()?.getPointerPosition();
    const note = notes.find(n => n.id === activeNoteId);
    if (pos && note?.drawingLines) {
      const lastLine = { ...note.drawingLines[note.drawingLines.length - 1] };
      lastLine.points = lastLine.points.concat([pos.x, pos.y]);
      const newLines = note.drawingLines.slice(0, -1).concat([lastLine]);
      updateDrawing(activeNoteId, newLines);
    }
  };

  const handleMouseUp = () => {
    // End of stroke
  };

  const updateDrawing = (id: string, lines: DrawingLine[]) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, drawingLines: lines } : n));
  };

  const clearDrawing = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotes(prev => prev.map(n => n.id === id ? { ...n, drawingLines: [] } : n));
    setOpenMenuId(null);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMessage,
        config: {
          systemInstruction: `You are a helpful assistant for "Rainbow notepad", a sticky note app. 
          Your goal is to help users brainstorm, organize, and summarize their thoughts. 
          Keep your responses concise and friendly. 
          If the user wants to create a note, suggest they do so, or just provide the text they can copy.
          Current notes: ${notes.map(n => n.text).join(' | ')}`
        }
      });

      const aiResponse = response.text || "I'm sorry, I couldn't process that.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Oops! Something went wrong. Please check your connection or try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-minimal-bg font-sans text-[#333] selection:bg-blue-100 overflow-x-hidden animate-rainbow-slow">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Background Theme Logo */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.05]">
        <div className="relative">
          <Sparkles size={600} className="text-black" />
          <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-8xl font-black tracking-tighter uppercase whitespace-nowrap rotate-[-15deg]">Rainbow</span>
          </div>
        </div>
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 px-[50px] py-[30px] flex items-center justify-between border-b-2 border-black/5 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-red-500 via-yellow-500 to-purple-500 p-2 rounded-xl shadow-lg">
             <Sparkles className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-red-600 via-yellow-600 to-purple-600 bg-clip-text text-transparent">
            Rainbow notepad
          </h1>
        </div>
        
        <div className="flex items-center gap-[15px]">
          {/* Header Action Buttons (Refined) */}
          <button
            onClick={() => setIsTemplatesModalOpen(true)}
            className="p-3 rounded-2xl transition-all hover:bg-yellow-50 text-slate-400 hover:text-yellow-600 group/tt"
            title="Note Templates"
          >
            <Sparkles size={22} />
          </button>
          
          <button
            onClick={() => setIsChatOpen(true)}
            className="p-3 rounded-2xl transition-all hover:bg-blue-50 text-slate-400 hover:text-blue-600"
            title="AI Chat"
          >
            <MessageCircle size={22} />
          </button>

          <button
            onClick={() => addNote()}
            className="group/btn px-6 py-2.5 bg-black text-white rounded-[20px] text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 hover:bg-slate-800 active:scale-95 shadow-xl ml-2"
          >
            <Plus size={18} />
            New Note
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-[50px] pt-[140px] pb-12 relative z-10">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <div className="p-8 rounded-full bg-white shadow-inner mb-6 border border-black/5">
               <Plus className="opacity-20" size={48} />
            </div>
            <p className="text-xl font-semibold opacity-30 italic">Start your rainbow collection...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[40px]">
            <AnimatePresence mode="popLayout">
              {notes.map((note) => (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -20 }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  onClick={() => startEditing(note)}
                  className={`
                    relative min-h-[400px] p-[35px] flex flex-col items-start
                    shadow-[0_10px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_25px_50px_rgba(0,0,0,0.12)]
                    transition-all duration-300 note-corner-fold cursor-pointer group
                    ${note.color}
                    ${note.completed ? 'opacity-80 scale-[0.98]' : ''}
                  `}
                >
                  <div className="note-header w-full flex justify-between items-center text-[12px] uppercase tracking-[2px] font-black opacity-40 mb-[25px] pointer-events-none">
                    <div className="flex items-center gap-1">
                       <div className="w-2 h-2 rounded-full bg-white/50" />
                       <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</span>
                    </div>
                    {note.completed && <span className="bg-black/10 px-2 py-0.5 rounded italic lowercase tracking-normal">Done</span>}
                  </div>

                  {note.image && (
                    <div className="relative w-full mb-4 pointer-events-none">
                      <img 
                        src={note.image} 
                        alt="Attached photo" 
                        className="w-full aspect-video object-cover rounded-xl shadow-md border border-black/5" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <div className="w-full h-full flex flex-col relative pointer-events-none">
                    {/* Drawing Layer Preview */}
                    {(note.drawingLines && note.drawingLines.length > 0) && (
                      <div className="absolute inset-0 z-0">
                        <Stage width={300} height={400} className="w-full h-full">
                          <Layer>
                            {note.drawingLines.map((line, i) => (
                              <KonvaLine
                                key={i}
                                points={line.points}
                                stroke={line.color}
                                strokeWidth={line.strokeWidth}
                                tension={0.5}
                                lineCap="round"
                                lineJoin="round"
                                globalCompositeOperation={
                                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                                }
                              />
                            ))}
                          </Layer>
                        </Stage>
                      </div>
                    )}

                    <div className={`flex-1 w-full overflow-hidden text-[22px] font-medium leading-[1.4] text-[#222] whitespace-pre-wrap relative z-10 ${note.completed ? 'line-through opacity-40' : ''}`}>
                      {note.text || (!note.image && !note.drawingLines?.length && <span className="opacity-20 italic">Empty note...</span>)}
                    </div>
                    
                    <div className="flex items-center justify-end gap-3 pt-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 relative pointer-events-auto">
                      <button
                        onClick={(e) => startEditing(note, e)}
                        className="p-2.5 rounded-xl bg-white/20 hover:bg-white text-[#222] transition-colors border border-black/10"
                        title="Edit"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={(e) => changeColor(note.id, e)}
                        className="p-2.5 rounded-xl bg-white/20 hover:bg-white text-purple-600 transition-colors border border-black/10"
                        title="Warp Spectrum"
                      >
                        <Palette size={18} />
                      </button>
                      <button
                        onClick={(e) => deleteNote(note.id, e)}
                        className="p-2.5 rounded-xl bg-white/20 hover:bg-red-500 hover:text-white text-red-500 transition-colors border border-black/10"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Full Screen Editor Overlay */}
      <AnimatePresence>
        {activeNoteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white flex flex-col"
          >
            {/* Editor Header */}
            <header className="px-8 py-6 flex items-center justify-between border-b border-black/5 bg-white/50 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <button 
                  onClick={saveNote}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-slate-600"
                  title="Back"
                >
                  <ArrowLeft size={24} />
                </button>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${notes.find(n => n.id === activeNoteId)?.color} bg-opacity-40 border border-black/5 shadow-sm`}>
                  {isDrawing ? 'Sketching Mode' : 'Writing Mode'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Mode Switcher */}
                <button
                  onClick={() => setIsDrawing(!isDrawing)}
                  className={`p-3 rounded-2xl transition-all ${isDrawing ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}
                  title={isDrawing ? "Switch to Writing" : "Switch to Drawing"}
                >
                  {isDrawing ? <Edit3 size={22} /> : <Pencil size={22} />}
                </button>

                <div className="w-px h-8 bg-black/5 mx-1" />

                {/* Direct Action Tools */}
                <button
                  onClick={(e) => triggerGallery(activeNoteId, e)}
                  className="p-3 rounded-2xl hover:bg-slate-50 text-slate-400 hover:text-blue-500 transition-all"
                  title="Gallery"
                >
                  <ImageIcon size={22} />
                </button>

                <button
                  onClick={(e) => startVoiceRecording('note', e)}
                  className={`p-3 rounded-2xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-slate-50 text-slate-400 hover:text-red-500'}`}
                  title="Voice to Note"
                >
                  <Mic size={22} />
                </button>

                <button
                  onClick={(e) => startVoiceRecording('chat', e)}
                  className="p-3 rounded-2xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all"
                  title="AI Voice Chat"
                >
                  <MessageCircle size={22} />
                </button>

                <button
                  onClick={(e) => changeColor(activeNoteId!, e)}
                  className="p-3 rounded-2xl hover:bg-slate-50 text-slate-400 hover:text-purple-500 transition-all"
                  title="Warp Spectrum"
                >
                  <Palette size={22} />
                </button>

                <button
                  onClick={(e) => {
                    const note = notes.find(n => n.id === activeNoteId);
                    if (note) saveAsTemplate({...note, text: editText});
                  }}
                  className="p-3 rounded-2xl hover:bg-slate-50 text-slate-400 hover:text-yellow-600 transition-all"
                  title="Save Template"
                >
                  <Sparkles size={22} />
                </button>

                <div className="w-px h-8 bg-black/5 mx-1" />

                <button
                  onClick={(e) => deleteNote(activeNoteId!, e)}
                  className="p-3 rounded-2xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                  title="Delete Note"
                >
                  <Trash2 size={22} />
                </button>

                <button
                  onClick={saveNote}
                  className="p-3 bg-black text-white rounded-2xl hover:bg-slate-800 transition-all shadow-lg ml-2"
                  title="Save & Close"
                >
                  <CheckCircle2 size={22} />
                </button>
              </div>
            </header>

            {/* Hybrid Note Editor Body */}
            <div className={`flex-1 relative overflow-hidden flex flex-col ${notes.find(n => n.id === activeNoteId)?.color}`}>
              <div className="flex-1 w-full max-w-5xl mx-auto p-12 lg:p-24 relative flex flex-col">
                
                {/* Photo Layer */}
                {notes.find(n => n.id === activeNoteId)?.image && (
                  <div className="relative mb-8 group shrink-0 z-10 w-full max-w-2xl mx-auto">
                    <img 
                      src={notes.find(n => n.id === activeNoteId)?.image} 
                      className="w-full max-h-[30vh] object-contain rounded-2xl shadow-xl transition-all"
                      referrerPolicy="no-referrer"
                    />
                    <button 
                      onClick={() => removeImage(activeNoteId)}
                      className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}

                {/* Text Layer */}
                <textarea
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Type your thoughts... or use the mic above"
                  className={`flex-1 w-full bg-transparent resize-none focus:outline-none text-4xl lg:text-6xl font-medium leading-tight text-[#333] placeholder:opacity-10 z-10 relative ${isDrawing ? 'pointer-events-none' : 'pointer-events-auto'}`}
                />

                {/* Drawing Layer Overlay */}
                <div 
                  ref={canvasContainerRef} 
                  className={`absolute inset-0 z-20 ${isDrawing ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                >
                  <Stage
                    width={canvasSize.width}
                    height={canvasSize.height}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}
                  >
                    <Layer>
                      {(notes.find(n => n.id === activeNoteId)?.drawingLines || []).map((line, i) => (
                        <KonvaLine
                          key={i}
                          points={line.points}
                          stroke={line.color}
                          strokeWidth={line.strokeWidth}
                          tension={0.5}
                          lineCap="round"
                          lineJoin="round"
                          globalCompositeOperation={
                            line.tool === 'eraser' ? 'destination-out' : 'source-over'
                          }
                        />
                      ))}
                    </Layer>
                  </Stage>
                </div>

                {/* Mode Floating Drawing Tools (Only visible when drawing is active) */}
                <AnimatePresence>
                  {isDrawing && (
                    <motion.div 
                      initial={{ y: 100, opacity: 0, x: "-50%" }}
                      animate={{ y: 0, opacity: 1, x: "-50%" }}
                      exit={{ y: 100, opacity: 0, x: "-50%" }}
                      className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-black/10 p-4 rounded-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.15)] flex items-center gap-3 z-[100]"
                    >
                      <div className="flex items-center gap-1.5 mr-2">
                        <button
                          onClick={() => setDrawTool('pen')}
                          className={`p-3.5 rounded-2xl transition-all ${drawTool === 'pen' ? 'bg-black text-white' : 'hover:bg-slate-100 text-[#666]'}`}
                        >
                          <Pencil size={20} />
                        </button>
                        <button
                          onClick={() => setDrawTool('eraser')}
                          className={`p-3.5 rounded-2xl transition-all ${drawTool === 'eraser' ? 'bg-black text-white' : 'hover:bg-slate-100 text-[#666]'}`}
                        >
                          <Eraser size={20} />
                        </button>
                      </div>
                      
                      <div className="w-px h-10 bg-black/5 mx-1" />
                      
                      <div className="flex items-center gap-2 px-1">
                        {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b'].map(c => (
                          <button
                            key={c}
                            onClick={() => { setDrawColor(c); setDrawTool('pen'); }}
                            className={`w-9 h-9 rounded-full border border-black/10 transition-all hover:scale-115 active:scale-95 ${drawColor === c && drawTool === 'pen' ? 'ring-2 ring-black ring-offset-4' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>

                      <div className="w-px h-10 bg-black/5 mx-1" />
                      
                      <button
                        onClick={(e) => clearDrawing(activeNoteId!, e)}
                        className="p-3.5 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold flex items-center gap-2"
                        title="Clear Canvas"
                      >
                        <Trash2 size={20} />
                        <span className="text-xs uppercase tracking-widest hidden sm:inline">Clear</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates Modal */}
      <AnimatePresence>
        {isTemplatesModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTemplatesModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="px-12 py-8 flex items-center justify-between border-b border-black/5">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Your Templates</h2>
                  <p className="text-slate-400 font-medium">Quick start your thoughts with presets</p>
                </div>
                <button 
                  onClick={() => setIsTemplatesModalOpen(false)}
                  className="p-3 hover:bg-black/5 rounded-full transition-colors"
                >
                  <X size={28} />
                </button>
              </div>

              <div className="p-12 overflow-y-auto">
                {templates.length === 0 ? (
                  <div className="py-20 text-center text-slate-300">
                    <Sparkles className="mx-auto mb-4 opacity-20" size={64} />
                    <p className="text-xl italic font-medium">No templates saved yet.<br/>Save a note as a template to see it here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {templates.map(template => (
                      <div 
                        key={template.id}
                        onClick={() => applyTemplate(template)}
                        className={`group relative p-8 rounded-3xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg border border-black/5 ${template.color}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-bold text-lg truncate pr-8">{template.name}</h3>
                          <button 
                            onClick={(e) => deleteTemplate(template.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-black/10 rounded-full transition-all"
                          >
                            <Trash2 size={16} className="text-black/60" />
                          </button>
                        </div>
                        <p className="text-sm opacity-60 line-clamp-3 leading-relaxed">
                          {template.text || "Visual Template"}
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-black/5 px-3 py-1 rounded-full w-fit">
                          {template.drawingLines?.length ? 'Sketch' : template.image ? 'Media' : 'Text'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Chat Box */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-80 sm:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-black/5 flex flex-col mb-4 overflow-hidden"
            >
              <div className="p-4 bg-black text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-yellow-400" />
                  <span className="font-semibold">Rainbow AI</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 relative">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      msg.role === 'user' 
                        ? 'bg-black text-white rounded-tr-none' 
                        : 'bg-white border border-black/5 rounded-tl-none shadow-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-black/5 p-3 rounded-2xl rounded-tl-none shadow-sm">
                      <Loader2 className="animate-spin text-slate-400" size={16} />
                    </div>
                  </div>
                )}
                
                {/* Voice Recording Mask */}
                {isRecording && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center text-red-500 font-bold"
                  >
                    <div className="bg-red-500/10 p-8 rounded-full mb-4 animate-pulse">
                      <Mic size={48} className="animate-bounce" />
                    </div>
                    <span className="tracking-widest uppercase text-xs">Listening...</span>
                    <button 
                      onClick={() => recognitionRef.current?.stop()}
                      className="mt-6 px-4 py-2 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors"
                    >
                      Stop Recording
                    </button>
                  </motion.div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 bg-white border-t border-black/5 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isRecording ? "Transcribing..." : "Ask Rainbow..."}
                  disabled={isRecording}
                  className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-black outline-none disabled:opacity-50"
                />
                <button
                  onClick={(e) => startVoiceRecording('chat', e)}
                  disabled={isLoading}
                  className={`p-2 rounded-full transition-all transform active:scale-90 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400 hover:text-red-500'}`}
                  title="Start voice recording"
                >
                  <Mic size={16} />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !chatInput.trim() || isRecording}
                  className="p-2 bg-black text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed transform active:scale-95 transition-transform"
                >
                  <Send size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        textarea {
          field-sizing: content;
        }
      `}</style>
    </div>
  );
}
