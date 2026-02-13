"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

// Pending prompt that needs to be sent to the backend (from landing page)
export interface PendingPrompt {
  content: string;
  timestamp: number;
}

interface ChatContextType {
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;
  // Pending prompt from landing page that should trigger API call
  pendingPrompt: PendingPrompt | null;
  setPendingPrompt: (prompt: PendingPrompt | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  // Initialize with just the welcome message - no persistence
  const [messages, setMessagesState] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant' as const,
      content: `Welcome to Stacy. I'm Stella, your AI assistant. I'm ready to help you build Stellar smart contracts and frontends.`,
      timestamp: Date.now(),
    },
  ]);

  // Pending prompt from landing page that needs to trigger API call
  const [pendingPrompt, setPendingPromptState] = useState<PendingPrompt | null>(null);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    setMessagesState((prev) => [...prev, newMessage]);
  }, []);

  const clearMessages = useCallback(() => {
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      content: `Welcome to Stacy. I'm Stella, your AI assistant. I'm ready to help you build Stellar smart contracts and frontends.`,
      timestamp: Date.now(),
    };
    setMessagesState([welcomeMessage]);
  }, []);

  const setMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessagesState(newMessages);
  }, []);

  const setPendingPrompt = useCallback((prompt: PendingPrompt | null) => {
    setPendingPromptState(prompt);
  }, []);

  return (
    <ChatContext.Provider value={{ messages, addMessage, clearMessages, setMessages, pendingPrompt, setPendingPrompt }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
