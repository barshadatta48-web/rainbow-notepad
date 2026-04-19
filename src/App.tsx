/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit3, Check, X, Palette, MessageCircle, Send, Sparkles, Loader2, Image as ImageIcon, Camera, MoreVertical, CheckCircle2, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

interface Note {
  id: string;
  text: string;
  color: string;
  rotation: number;
  image?: string;
  completed?: boolean;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  
  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

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

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Load notes from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem('stickie-notes-rainbow');
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error('Failed to parse notes from local storage', e);
      }
    }
  }, []);

  // Save notes to localStorage
  useEffect(() => {
    localStorage.setItem('stickie-notes-rainbow', JSON.stringify(notes));
  }, [notes]);

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

  const addNote = (text = '', image?: string) => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      text,
      image,
      completed: false,
      color: COLORS[notes.length % COLORS.length], // Cyclic rainbow colors
      rotation: 0,
    };
    setNotes([newNote, ...notes]);
    if (!text && !image) {
      setEditingId(newNote.id);
      setEditText('');
    }
  };

  const deleteNote = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotes(notes.filter((n) => n.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
    setOpenMenuId(null);
  };

  const startEditing = (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(note.id);
    setEditText(note.text);
    setOpenMenuId(null);
  };

  const saveNote = () => {
    if (editingId) {
      setNotes(
        notes.map((n) =>
          n.id === editingId ? { ...n, text: editText } : n
        )
      );
      setEditingId(null);
    }
  };

  const toggleComplete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotes(notes.map(n => n.id === id ? { ...n, completed: !n.completed } : n));
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

  const startVoiceRecording = (e?: React.MouseEvent) => {
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
      setIsChatOpen(true);
      setIsHeaderMenuOpen(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setChatInput(transcript);
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
          <button
            onClick={() => addNote()}
            className="group/btn px-6 py-2.5 bg-black text-white rounded-[20px] text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 hover:bg-slate-800 active:scale-95 shadow-xl"
          >
            <Plus size={18} />
            New Note
          </button>

          {/* Header Three-dot Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsHeaderMenuOpen(!isHeaderMenuOpen);
              }}
              className={`p-2 rounded-full transition-all hover:bg-black/5 ${isHeaderMenuOpen ? 'bg-black text-white' : 'text-slate-600'}`}
            >
              <MoreVertical size={24} />
            </button>

            <AnimatePresence>
              {isHeaderMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute top-full right-0 mt-4 w-56 bg-white/90 backdrop-blur-2xl border border-black/5 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.1)] z-[100] overflow-hidden p-2"
                >
                  <button
                    onClick={() => {}}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-black/5 rounded-xl transition-colors text-slate-700"
                  >
                    <Palette size={18} className="text-purple-500" />
                    Theme
                  </button>
                  <button
                    onClick={() => {
                      setIsChatOpen(true);
                      setIsHeaderMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-black/5 rounded-xl transition-colors text-slate-700"
                  >
                    <MessageCircle size={18} className="text-blue-500" />
                    AI Chat Assistant
                  </button>
                  <button
                    onClick={(e) => startVoiceRecording(e)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-black/5 rounded-xl transition-colors text-slate-700"
                  >
                    <Mic size={18} className="text-red-500" />
                    Voice Chat Recorder
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
                  className={`
                    relative min-h-[400px] p-[35px] flex flex-col items-start
                    shadow-[0_10px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_25px_50px_rgba(0,0,0,0.12)]
                    transition-all duration-300 note-corner-fold
                    ${note.color}
                    ${note.completed ? 'opacity-80 scale-[0.98]' : ''}
                  `}
                >
                  <div className="note-header w-full flex justify-between items-center text-[12px] uppercase tracking-[2px] font-black opacity-40 mb-[25px]">
                    <div className="flex items-center gap-1">
                       <div className="w-2 h-2 rounded-full bg-white/50" />
                       <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</span>
                    </div>
                    {note.completed && <span className="bg-black/10 px-2 py-0.5 rounded italic lowercase tracking-normal">Done</span>}
                  </div>

                  {note.image && (
                    <div className="relative w-full mb-4 group/image">
                      <img 
                        src={note.image} 
                        alt="Attached photo" 
                        className="w-full aspect-video object-cover rounded-xl shadow-md border border-black/5" 
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => removeImage(note.id)}
                        className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity hover:bg-black"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {editingId === note.id ? (
                    <div className="w-full h-full flex flex-col">
                      <textarea
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        placeholder="Start typing..."
                        className="flex-1 w-full bg-transparent resize-none focus:outline-none text-[18px] leading-[1.6] text-[#333] placeholder:opacity-30"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            saveNote();
                          }
                          if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                      />
                      <div className="flex items-center justify-between pt-4">
                        <span className="text-[10px] opacity-40 italic">Ctrl+Enter to save</span>
                        <div className="flex items-center gap-2 relative">
                          <button onClick={() => setEditingId(null)} className="p-2 hover:bg-black/5 rounded-full transition-colors"><X size={16} /></button>
                          <button onClick={saveNote} className="p-2 bg-black text-white rounded-full transition-transform active:scale-90"><Check size={16} /></button>
                          
                          {/* Three-dot in editing mode */}
                          <div className="relative">
                            <button 
                              onClick={(e) => toggleMenu(note.id, e)}
                              className="p-2 hover:bg-black/5 rounded-full transition-colors"
                            >
                              <MoreVertical size={16} />
                            </button>
                            <AnimatePresence>
                              {openMenuId === note.id && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                  className="absolute bottom-full right-0 mb-2 w-48 bg-white/90 backdrop-blur-xl border border-black/5 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                                >
                                  <button 
                                    onClick={(e) => triggerGallery(note.id, e)}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 transition-colors border-b border-black/5"
                                  >
                                    <ImageIcon size={16} className="text-slate-400" />
                                    <span>Add Photo</span>
                                  </button>
                                  <button 
                                    onClick={() => setEditingId(null)}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 transition-colors text-red-500 border-b border-black/5"
                                  >
                                    <X size={16} />
                                    <span>Discard Changes</span>
                                  </button>
                                  <button 
                                    onClick={(e) => startVoiceRecording(e)}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 transition-colors text-slate-700"
                                  >
                                    <Mic size={16} className="text-red-500" />
                                    <span>Voice Record</span>
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col group">
                      <div 
                        onClick={() => startEditing(note)}
                        className={`flex-1 w-full cursor-pointer overflow-hidden text-[22px] font-medium leading-[1.4] text-[#222] whitespace-pre-wrap ${note.completed ? 'line-through opacity-40' : ''}`}
                      >
                        {note.text || (!note.image && <span className="opacity-20 italic">Click to add note...</span>)}
                      </div>
                      
                      <div className="flex items-center justify-end gap-3 pt-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 relative">
                        {/* 1. Right Icon (Toggle completion) */}
                        <button
                          onClick={(e) => toggleComplete(note.id, e)}
                          className={`p-2 rounded-full transition-colors ${note.completed ? 'bg-green-500 text-white' : 'hover:bg-black/5 text-[#666]'}`}
                          title="Mark as done"
                        >
                          {note.completed ? <CheckCircle2 size={18} /> : <Check size={18} />}
                        </button>
                        
                        {/* 2. Delete Icon */}
                        <button
                          onClick={(e) => deleteNote(note.id, e)}
                          className="p-2 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>

                        {/* 3. Three-dot Icon */}
                        <div className="relative">
                          <button
                            onClick={(e) => toggleMenu(note.id, e)}
                            className={`p-2 rounded-full transition-colors ${openMenuId === note.id ? 'bg-black text-white' : 'hover:bg-black/5 text-[#666]'}`}
                            title="More options"
                          >
                            <MoreVertical size={18} />
                          </button>
                          
                          <AnimatePresence>
                            {openMenuId === note.id && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                className="absolute bottom-full right-0 mb-2 w-48 bg-white/90 backdrop-blur-xl border border-black/5 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                              >
                                <button 
                                  onClick={(e) => startEditing(note, e)}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 transition-colors border-b border-black/5"
                                >
                                  <Edit3 size={16} className="text-slate-400" />
                                  <span>Edit text</span>
                                </button>
                                <button 
                                  onClick={(e) => changeColor(note.id, e)}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 transition-colors border-b border-black/5"
                                >
                                  <Palette size={16} className="text-slate-400" />
                                  <span>Change spectrum</span>
                                </button>
                                <button 
                                  onClick={(e) => triggerGallery(note.id, e)}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 transition-colors border-b border-black/5"
                                >
                                  <ImageIcon size={16} className="text-slate-400" />
                                  <span>Add gallery photo</span>
                                </button>
                                <button 
                                  onClick={(e) => startVoiceRecording(e)}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 transition-colors"
                                >
                                  <Mic size={16} className="text-red-500" />
                                  <span>Voice Record</span>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

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
                  onClick={(e) => startVoiceRecording(e)}
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
