/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit3, Check, X, Palette, MessageCircle, Send, Sparkles, Loader2, Image as ImageIcon, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

interface Note {
  id: string;
  text: string;
  color: string;
  rotation: number;
  image?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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

  const addNote = (text = '', image?: string) => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      text,
      image,
      color: COLORS[notes.length % COLORS.length], // Cyclic rainbow colors
      rotation: 0,
    };
    setNotes([newNote, ...notes]);
    if (!text && !image) {
      setEditingId(newNote.id);
      setEditText('');
    }
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter((n) => n.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
  };

  const startEditing = (note: Note) => {
    setEditingId(note.id);
    setEditText(note.text);
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

  const changeColor = (id: string) => {
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
  };

  const removeImage = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, image: undefined } : n));
  };

  const triggerGallery = (noteId: string | null = null) => {
    setLastUploadTargetId(noteId);
    fileInputRef.current?.click();
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
            className="group/btn px-6 py-2.5 bg-black text-white rounded-[20px] text-sm font-bold flex items-center gap-3 transition-all hover:scale-105 hover:bg-slate-800 active:scale-95 shadow-xl"
          >
            <div className="flex items-center -space-x-1">
              <Plus size={18} className="relative z-10" />
              <div className="bg-gradient-to-tr from-red-500 via-yellow-500 to-purple-500 p-1 rounded-full shadow-sm group-hover/btn:scale-110 transition-transform">
                <Sparkles size={10} className="text-white" />
              </div>
            </div>
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
                  className={`
                    relative min-h-[400px] p-[35px] flex flex-col items-start
                    shadow-[0_10px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_25px_50px_rgba(0,0,0,0.12)]
                    transition-all duration-300 note-corner-fold
                    ${note.color}
                  `}
                >
                  <div className="note-header w-full flex justify-between items-center text-[12px] uppercase tracking-[2px] font-black opacity-40 mb-[25px]">
                    <div className="flex items-center gap-1">
                       <div className="w-2 h-2 rounded-full bg-white/50" />
                       <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</span>
                    </div>
                    <span className="bg-white/30 px-2.5 py-1 rounded-full text-[10px] backdrop-blur-sm">Spectrum</span>
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
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingId(null)} className="p-2 hover:bg-black/5 rounded-full transition-colors"><X size={16} /></button>
                          <button onClick={saveNote} className="p-2 bg-black text-white rounded-full transition-transform active:scale-90"><Check size={16} /></button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col group">
                      <div 
                        onClick={() => startEditing(note)}
                        className="flex-1 w-full cursor-pointer overflow-hidden text-[22px] font-medium leading-[1.4] text-[#222] whitespace-pre-wrap"
                      >
                        {note.text || (!note.image && <span className="opacity-20 italic">Click to add note...</span>)}
                      </div>
                      
                      <div className="flex items-center justify-end gap-3 pt-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                        <button
                          onClick={() => triggerGallery(note.id)}
                          className="p-2 rounded-full hover:bg-black/5 text-[#666] transition-colors"
                          title="Add/Change photo"
                        >
                          <ImageIcon size={18} />
                        </button>
                        <button
                          onClick={() => changeColor(note.id)}
                          className="p-2 rounded-full hover:bg-black/5 text-[#666] transition-colors"
                          title="Color"
                        >
                          <Palette size={18} />
                        </button>
                        <button
                          onClick={() => startEditing(note)}
                          className="p-2 rounded-full hover:bg-black/5 text-[#666] transition-colors"
                          title="Edit"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="p-2 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
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

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
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
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 bg-white border-t border-black/5 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask Rainbow..."
                  className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-black outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !chatInput.trim()}
                  className="p-2 bg-black text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed transform active:scale-95 transition-transform"
                >
                  <Send size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`p-4 rounded-full shadow-lg transition-all transform active:scale-90 ${
            isChatOpen ? 'bg-white text-black' : 'bg-black text-white'
          }`}
        >
          {isChatOpen ? <X size={24} /> : <MessageCircle size={24} />}
        </button>
      </div>

      <style>{`
        textarea {
          field-sizing: content;
        }
      `}</style>
    </div>
  );
}
