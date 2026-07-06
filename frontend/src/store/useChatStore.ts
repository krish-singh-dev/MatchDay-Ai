import { create } from 'zustand';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  detectedLanguage?: string;
  wasCached?: boolean;
  timestamp: Date;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  preferredLanguage: string;
  setPreferredLanguage: (lang: string) => void;
  sendMessage: (queryText: string, venueId: string, userId?: string | null) => Promise<void>;
  clearChat: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api/v1` 
  : 'http://localhost:5000/api/v1';

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  preferredLanguage: 'en',
  
  setPreferredLanguage: (lang) => set({ preferredLanguage: lang }),
  
  sendMessage: async (queryText, venueId, userId = null) => {
    if (!queryText.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: queryText,
      sender: 'user',
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/chat/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queryText,
          venueId,
          userId,
          language: get().preferredLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message. Please try again.');
      }

      const data = await response.json();

      const botMessage: Message = {
        id: data.id || `bot-${Date.now()}`,
        text: data.responseText,
        sender: 'bot',
        detectedLanguage: data.detectedLanguage,
        wasCached: data.wasCached,
        timestamp: new Date(data.createdAt || Date.now()),
      };

      set((state) => ({
        messages: [...state.messages, botMessage],
        isLoading: false,
      }));
    } catch (err: any) {
      set({
        error: err.message || 'Something went wrong',
        isLoading: false,
      });
    }
  },

  clearChat: () => set({ messages: [], error: null }),
}));
