"use client";
import { cn } from "@/lib/utils";
import { ChatContext, ChatTargetMode } from "@/types/ide";
import {
  Bot,
  SendHorizontal,
  Paperclip,
  Sparkles,
  Pin,
  FileCode,
  User,
  ChevronDown,
  Loader2,
  MessageSquare,
  Settings,
  UserCircle,
  X,
  Mic,
  MicOff
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SettingsDialog from "../layout/SettingsDialog";
import AccountDialog from "../layout/AccountDialog";
import { useChat } from '@ai-sdk/react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { FileNode } from "@/types/ide";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { detectStubInChanges, STUB_RETRY_MESSAGE } from "@/lib/stubDetector";
import { useChatContext, PendingPrompt } from "@/contexts/ChatContext";

type AIModel =
  | "gemini-2.5-flash"
  | "gemini-2.0-flash-exp"
  | "gemini-2.5-pro"
  | "ollama:gpt-oss:120b-cloud";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: AIModel;
}

interface EditorChange {
  path: string;
  action: "create" | "update" | "delete";
  content: string;
}

interface ChatPanelProps {
  chatContext: ChatContext;
  onTargetModeChange: (mode: ChatTargetMode) => void;
  onSendMessage: (message: string, model: AIModel) => void;
  fileTree?: FileNode[];
  fileContents?: Record<string, string>;
  onApplyEditorChanges?: (changes: EditorChange[]) => void;
}

const MODELS: { id: AIModel; name: string; icon: string }[] = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", icon: "✨" },
  { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash Exp", icon: "🚀" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", icon: "🧠" },
  { id: "ollama:gpt-oss:120b-cloud", name: "Ollama gpt-oss:120b-cloud", icon: "🦙" },
];

// Account Dialog Component



export function ChatPanel({
  chatContext,
  onTargetModeChange,
  onSendMessage,
  fileTree,
  fileContents,
  onApplyEditorChanges
}: ChatPanelProps) {
  const [selectedModel, setSelectedModel] = useState<AIModel>("gemini-2.5-flash");
  const [isModelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);

  const [chatWidth, setChatWidth] = useState(470);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Get shared chat context
  const { messages: contextMessages, addMessage: addContextMessage, setMessages: setContextMessages, pendingPrompt, setPendingPrompt } = useChatContext();

  // Convert context messages to useChat format
  const initialMessagesForUseChat = contextMessages.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
  }));

  // Track last auto-sent selection to avoid duplicates
  const lastAutoSentSelection = useRef<string | null>(null);

  // Speech recognition
  const {
    isListening,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechRecognition({
    continuous: false,
    interimResults: true,
    onTranscript: (transcript) => {
      // Append transcript to current input
      const newInput = input ? `${input} ${transcript}` : transcript;
      handleInputChange({ target: { value: newInput } } as any);
    },
    onError: (error) => {
      console.error('Speech recognition error:', error);
    }
  });

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Use AI SDK's useChat hook for streaming
  const { messages: aiMessages, input, handleInputChange, handleSubmit, isLoading, setMessages, append } = useChat({
    api: '/api/chat',
    streamProtocol: 'text', // Use text stream protocol for toTextStreamResponse
    body: {
      model: selectedModel,
      context: {
        mode: chatContext.resolvedMode,
        activeFilePath: chatContext.activeFilePath,
        selection: chatContext.selection,
        intent: chatContext.intent,
      },
      fileTree: fileTree || [],
      fileContents: fileContents || {},
    },
    initialMessages: initialMessagesForUseChat,
    onError: (error) => {
      console.error('Chat error:', error);
    },
    onFinish: async (message) => {
      // Parse the response for editor changes
      if (message.content && onApplyEditorChanges) {
        try {
          // Extract JSON from the response
          let jsonStr = message.content.trim();

          // Remove markdown code blocks if present
          if (jsonStr.includes("```json")) {
            const jsonBlockMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonBlockMatch) {
              jsonStr = jsonBlockMatch[1].trim();
            }
          } else if (jsonStr.includes("```")) {
            const codeBlockMatch = jsonStr.match(/```\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
              jsonStr = codeBlockMatch[1].trim();
            }
          }

          // Try to find JSON object with balanced braces (same logic as route.ts)
          const findBalancedJson = (str: string): string | null => {
            let depth = 0;
            let start = -1;
            let inString = false;
            let escapeNext = false;

            for (let i = 0; i < str.length; i++) {
              const char = str[i];

              // Handle escape sequences
              if (escapeNext) {
                escapeNext = false;
                continue;
              }

              if (char === '\\') {
                escapeNext = true;
                continue;
              }

              // Toggle string state on unescaped quotes
              if (char === '"') {
                inString = !inString;
                continue;
              }

              // Only count braces outside of strings
              if (!inString) {
                if (char === '{') {
                  if (depth === 0) start = i;
                  depth++;
                } else if (char === '}') {
                  depth--;
                  if (depth === 0 && start !== -1) {
                    return str.substring(start, i + 1);
                  }
                }
              }
            }
            return null;
          };

          const balancedJson = findBalancedJson(jsonStr);
          if (!balancedJson) {
            console.warn('[chat] Could not find balanced JSON object in response');
            return;
          }

          let parsed: any = null;
          try {
            parsed = JSON.parse(balancedJson);
          } catch (parseError) {
            console.error('[chat] Failed to parse JSON:', parseError);
            console.warn('[chat] JSON preview:', balancedJson.substring(0, 500));
            return;
          }

          // Validate structure
          if (!parsed.chat || !parsed.editor) {
            console.warn('[chat] Invalid response structure - missing chat or editor');
            console.warn('[chat] Parsed object keys:', Object.keys(parsed));
            return;
          }

          // Extract chat message and display it (it should already be in the message content)
          if (parsed.chat.message) {
            console.log('[chat] Chat message (will be shown in chat panel):', parsed.chat.message.substring(0, 150));
          }

          // Validate and apply editor changes (ONLY code, no chat messages)
          // CRITICAL: "explain" and "debug" actions are READ-ONLY - do not apply changes
          const isReadOnlyAction = chatContext.intent === 'explain' || chatContext.intent === 'debug';

          if (parsed.editor && Array.isArray(parsed.editor.changes)) {
            const changes: EditorChange[] = parsed.editor.changes;

            if (isReadOnlyAction && changes.length > 0) {
              console.log(`[chat] Read-only action (${chatContext.intent}) - ignoring ${changes.length} editor change(s)`);
              console.log('[chat] Changes will NOT be applied - this is a read-only action');
              return; // Don't apply changes for explain/debug
            }

            console.log(`[chat] Editor changes (will be shown in code editor): ${parsed.editor.changes.length} file(s)`);

            // Validate each change has required fields
            const validChanges = changes.filter((change) => {
              if (!change.path || !change.action) {
                console.warn('[chat] Invalid change - missing path or action:', change);
                return false;
              }

              if ((change.action === "create" || change.action === "update") && !change.content) {
                console.warn(`[chat] Invalid change - ${change.action} action requires content:`, change.path);
                return false;
              }

              // Ensure content is a string (full file content)
              if (change.content && typeof change.content !== "string") {
                console.warn(`[chat] Invalid change - content must be string:`, change.path);
                return false;
              }

              // Ensure content doesn't contain chat message patterns (should be code only)
              if (change.content) {
                const content = change.content.trim();
                // Check for common chat message patterns that shouldn't be in code
                if (content.startsWith('I\'ve') || content.startsWith('I have') ||
                  content.startsWith('I analyzed') || content.startsWith('I implemented')) {
                  console.warn(`[chat] Invalid change - content appears to be a chat message, not code:`, change.path);
                  return false;
                }
              }

              return true;
            });

            // STUB DETECTOR: Check for placeholder logic in contract files
            if (validChanges.length > 0) {
              const stubCheck = detectStubInChanges(validChanges);

              if (stubCheck.stubDetected) {
                // Reject response - contains placeholder logic
                console.warn('[chat] STUB DETECTED - Rejecting response with placeholder logic:', stubCheck.matchedIn);

                // Remove the assistant message with stub code
                setMessages((prev) => prev.filter((msg) => msg.id !== message.id));

                // Automatically retry with stub rejection message
                setTimeout(() => {
                  append({
                    role: 'user',
                    content: STUB_RETRY_MESSAGE,
                  });
                }, 100);

                return; // Don't apply changes
              }

              // No stub detected - apply changes
              console.log(`[chat] Applying ${validChanges.length} editor change(s) to Monaco editor`);
              console.log('[chat] Changes to apply:', validChanges.map(c => ({
                path: c.path,
                action: c.action,
                contentLength: c.content?.length || 0
              })));

              if (onApplyEditorChanges) {
                onApplyEditorChanges(validChanges);
                console.log('[chat] onApplyEditorChanges called successfully');
              } else {
                console.error('[chat] ERROR: onApplyEditorChanges is not defined!');
              }
            } else if (changes.length > 0) {
              console.warn('[chat] No valid changes to apply after validation');
            }
          }
        } catch (error) {
          // If parsing fails, that's okay - just log it
          console.warn('[chat] Could not parse editor changes from response:', error);
        }
      }
    },
  });

  // Auto-send message when Explain/Debug is triggered via code selection
  useEffect(() => {
    const selection = chatContext.selection;
    const intent = chatContext.intent;

    // Only auto-send for explain/debug actions with valid selection
    if ((intent === 'explain' || intent === 'debug') && selection?.selectedText) {
      // Create a unique key for this selection to avoid duplicates
      const selectionKey = `${intent}-${selection.startLine}-${selection.endLine}-${selection.selectedText.substring(0, 50)}`;

      // Skip if we already sent this exact selection (prevents duplicate sends)
      if (lastAutoSentSelection.current === selectionKey) {
        return;
      }

      // Skip if already loading (don't send duplicate while previous is processing)
      if (isLoading) {
        return;
      }

      console.log('[ChatPanel] Auto-sending message for', intent, 'action');
      lastAutoSentSelection.current = selectionKey;

      // Auto-send message based on intent
      const message = intent === 'explain'
        ? 'Please explain this code.'
        : 'Please help me debug this code.';

      append({
        role: 'user',
        content: message,
      });
    } else {
      // Reset tracking when selection/intent is cleared
      if (!selection || !intent || intent === 'general') {
        lastAutoSentSelection.current = null;
      }
    }
  }, [chatContext.selection, chatContext.intent, append, isLoading]);

  // Clear selection tracking when response completes (allows re-sending same selection)
  useEffect(() => {
    if (!isLoading && lastAutoSentSelection.current) {
      // Small delay to ensure response is fully processed
      const timer = setTimeout(() => {
        lastAutoSentSelection.current = null;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Helper function to extract chat message from JSON response
  // Returns the chat.message for display, showing the AI's thinking/explanation
  const extractChatMessage = (content: string): string => {
    try {
      // Try to parse as JSON first
      let jsonStr = content.trim();

      // Remove markdown code blocks if present
      if (jsonStr.includes("```json")) {
        const jsonBlockMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
          jsonStr = jsonBlockMatch[1].trim();
        }
      } else if (jsonStr.includes("```")) {
        const codeBlockMatch = jsonStr.match(/```\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1].trim();
        }
      }

      // Try to find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // If it's a structured response, return only the chat message (thinking/explanation)
        if (parsed.chat && parsed.chat.message) {
          // Return the chat message which contains the AI's thinking and what it wrote
          return parsed.chat.message;
        }
        // If no chat.message but there's editor changes, show a summary
        if (parsed.editor && parsed.editor.changes && parsed.editor.changes.length > 0) {
          const changeCount = parsed.editor.changes.length;
          const fileNames = parsed.editor.changes.map((c: any) => c.path).join(', ');
          return `I've made ${changeCount} change(s) to: ${fileNames}`;
        }
      }
    } catch (error) {
      // If parsing fails, check if it's already just text (not JSON)
      // In that case, return as-is
    }

    // If not JSON or parsing failed, return original content
    // This handles cases where the response isn't structured JSON
    return content;
  };

  // Convert AI SDK messages to our ChatMessage format
  // Extract chat message from JSON responses for display
  // Filter out internal system retry messages (they start with STUB_RETRY_MESSAGE)
  const messages: ChatMessage[] = aiMessages
    .filter(msg => {
      // Hide internal retry messages from display
      if (msg.role === 'user' && msg.content === STUB_RETRY_MESSAGE) {
        return false;
      }
      return true;
    })
    .map(msg => {
      // For assistant messages, try to extract just the chat message
      const displayContent = msg.role === "assistant"
        ? extractChatMessage(msg.content)
        : msg.content;

      return {
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: displayContent,
        timestamp: new Date(),
        model: selectedModel,
      };
    });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const chatPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Resize handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !chatPanelRef.current) return;
      const panelRect = chatPanelRef.current.getBoundingClientRect();
      const newWidth = e.clientX - panelRect.left;
      setChatWidth(Math.max(280, Math.min(600, newWidth)));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!input.trim() || isLoading) return;

    // Call parent handler
    onSendMessage(input, selectedModel);

    // Use AI SDK's handleSubmit which handles streaming automatically
    // useChat will add the user message to aiMessages, which will then sync to context via useEffect
    handleSubmit(e);
  };

  // Sync useChat messages to context whenever they change
  useEffect(() => {
    // Convert useChat messages to context format
    const contextFormatMessages = aiMessages.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: Date.now(),
    }));

    // Only update context if messages are different (to avoid infinite loops)
    const currentContextIds = contextMessages.map(m => m.id).join(',');
    const newContextIds = contextFormatMessages.map(m => m.id).join(',');

    if (currentContextIds !== newContextIds && contextFormatMessages.length > 0) {
      setContextMessages(contextFormatMessages);
    }
  }, [aiMessages, setContextMessages]); // Sync useChat messages to context

  // Sync context messages to useChat when context changes (e.g., from landing page)
  useEffect(() => {
    // Convert context messages to useChat format
    const contextMessagesForUseChat = contextMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
    }));

    // Only update if messages are different (to avoid infinite loops)
    const currentIds = aiMessages.map(m => m.id).join(',');
    const contextIds = contextMessagesForUseChat.map(m => m.id).join(',');

    // Only sync if context has more messages (new message from landing page)
    if (contextMessagesForUseChat.length > aiMessages.length && contextIds !== currentIds) {
      // Update useChat messages to match context
      setMessages(contextMessagesForUseChat);
    }
  }, [contextMessages.length]); // Only trigger when message count changes from outside

  // Handle pending prompt from landing page - trigger API call
  useEffect(() => {
    if (pendingPrompt && !isLoading) {
      console.log('[ChatPanel] Processing pending prompt from landing page:', pendingPrompt.content.substring(0, 50));

      // Clear the pending prompt immediately to prevent re-triggering
      setPendingPrompt(null);

      // Use append to send the message and trigger the API call
      // This will add the user message and generate a response
      append({
        role: 'user',
        content: pendingPrompt.content,
      });
    }
  }, [pendingPrompt, isLoading, append, setPendingPrompt]);

  return (
    <>
      <AccountDialog isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <div className="flex h-full">
        {/* Icon Rail - Always Visible */}
        <div className="w-12 h-full bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-3 gap-1 shrink-0">
          {/* Chat Toggle */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={cn(
              "p-2.5 rounded-lg transition-colors",
              isChatOpen
                ? "bg-purple-500/10 text-purple-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            )}
            title={isChatOpen ? "Hide Chat" : "Show Chat"}
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          {/* Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Account */}
          <button
            onClick={() => setIsAccountOpen(true)}
            className="p-2.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Account"
          >
            <UserCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Content - Toggleable & Resizable */}
        {isChatOpen && (
          <div
            ref={chatPanelRef}
            className="relative flex flex-col h-full bg-zinc-950 border-r border-zinc-800 overflow-hidden shrink-0"
            style={{ width: chatWidth }}
          >
            {/* Resize Handle */}
            <div
              onMouseDown={handleResizeMouseDown}
              className="absolute top-0 bottom-0 right-0 w-2 cursor-col-resize z-50 group hover:bg-purple-500/30 active:bg-purple-500/50 transition-colors"
            >
              <div className="absolute top-1/2 -translate-y-1/2 right-0.5 w-0.5 h-8 bg-zinc-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      msg.role === "assistant" ? "bg-purple-500/10" : "bg-zinc-800"
                    )}>
                      {msg.role === "assistant" ? (
                        <Bot className="w-5 h-5 text-purple-400" />
                      ) : (
                        <User className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <div className={cn(
                      "space-y-1 max-w-[85%]",
                      msg.role === "user" && "items-end"
                    )}>
                      <div className={cn(
                        "flex items-center gap-2",
                        msg.role === "user" && "justify-end"
                      )}>
                        <span className="text-xs font-semibold text-zinc-400">
                          {msg.role === "assistant" ? "Stella" : "You"}
                        </span>
                        {msg.model && (
                          <span className="text-[10px] text-zinc-600">
                            {MODELS.find(m => m.id === msg.model)?.icon}
                          </span>
                        )}
                      </div>
                      <div className={cn(
                        "text-sm leading-relaxed p-3 border prose prose-invert prose-sm max-w-none",
                        msg.role === "assistant"
                          ? "text-zinc-300 bg-zinc-900/50 rounded-r-lg rounded-bl-lg border-zinc-800/50"
                          : "text-zinc-200 bg-purple-600/20 rounded-l-lg rounded-br-lg border-purple-500/30"
                      )}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            // Style code blocks
                            code: ({ node, inline, className, children, ...props }: any) => {
                              return inline ? (
                                <code className="px-1.5 py-0.5 bg-zinc-800/50 text-purple-300 rounded text-xs font-mono" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <code className="block p-3 bg-zinc-950/50 rounded-md border border-zinc-800/50 text-xs font-mono text-zinc-300 overflow-x-auto" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            // Style pre blocks
                            pre: ({ node, children, ...props }: any) => {
                              return (
                                <pre className="p-0 bg-transparent" {...props}>
                                  {children}
                                </pre>
                              );
                            },
                            // Style paragraphs
                            p: ({ node, children, ...props }: any) => {
                              return (
                                <p className="mb-2 last:mb-0" {...props}>
                                  {children}
                                </p>
                              );
                            },
                            // Style headings
                            h1: ({ node, children, ...props }: any) => (
                              <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0 text-zinc-200" {...props}>
                                {children}
                              </h1>
                            ),
                            h2: ({ node, children, ...props }: any) => (
                              <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-zinc-200" {...props}>
                                {children}
                              </h2>
                            ),
                            h3: ({ node, children, ...props }: any) => (
                              <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-zinc-200" {...props}>
                                {children}
                              </h3>
                            ),
                            // Style lists
                            ul: ({ node, children, ...props }: any) => (
                              <ul className="list-disc list-inside mb-2 space-y-1 text-zinc-300" {...props}>
                                {children}
                              </ul>
                            ),
                            ol: ({ node, children, ...props }: any) => (
                              <ol className="list-decimal list-inside mb-2 space-y-1 text-zinc-300" {...props}>
                                {children}
                              </ol>
                            ),
                            li: ({ node, children, ...props }: any) => (
                              <li className="ml-4" {...props}>
                                {children}
                              </li>
                            ),
                            // Style links
                            a: ({ node, children, ...props }: any) => (
                              <a className="text-purple-400 hover:text-purple-300 underline" {...props}>
                                {children}
                              </a>
                            ),
                            // Style blockquotes
                            blockquote: ({ node, children, ...props }: any) => (
                              <blockquote className="border-l-4 border-zinc-700 pl-4 my-2 italic text-zinc-400" {...props}>
                                {children}
                              </blockquote>
                            ),
                            // Style horizontal rules
                            hr: ({ node, ...props }: any) => (
                              <hr className="my-3 border-zinc-700" {...props} />
                            ),
                            // Style strong/bold
                            strong: ({ node, children, ...props }: any) => (
                              <strong className="font-semibold text-zinc-200" {...props}>
                                {children}
                              </strong>
                            ),
                            // Style emphasis/italic
                            em: ({ node, children, ...props }: any) => (
                              <em className="italic text-zinc-300" {...props}>
                                {children}
                              </em>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-zinc-400">Stella</div>
                    <div className="text-sm text-zinc-300 bg-zinc-900/50 p-3 rounded-r-lg rounded-bl-lg border border-zinc-800/50 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                      <span className="text-zinc-500">Thinking...</span>
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Context Strip */}
            <div className="border-t border-zinc-800 bg-zinc-900/20 px-3 py-2">
              <div className="flex flex-wrap gap-2 items-center">
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium border uppercase tracking-wider",
                  chatContext.targetMode !== "auto"
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                )}>
                  {chatContext.targetMode !== "auto" && <Pin className="w-2.5 h-2.5" />}
                  {chatContext.resolvedMode}
                </div>

                {chatContext.activeFilePath && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 max-w-[150px] truncate">
                    <FileCode className="w-3 h-3 text-zinc-500" />
                    {chatContext.activeFilePath.split('/').pop()}
                  </div>
                )}

                {chatContext.selection && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    Lines {chatContext.selection.startLine}-{chatContext.selection.endLine}
                  </div>
                )}

                {chatContext.intent && chatContext.intent !== "general" && (
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border capitalize",
                    chatContext.intent === "explain" && "bg-blue-500/10 text-blue-400 border-blue-500/30",
                    chatContext.intent === "debug" && "bg-orange-500/10 text-orange-400 border-orange-500/30"
                  )}>
                    {chatContext.intent}
                  </div>
                )}
              </div>

              {chatContext.selection && chatContext.selection.selectedText && (
                <div className="mt-2 p-2 bg-zinc-900 rounded-md border border-zinc-800 max-h-[80px] overflow-hidden">
                  <pre className="text-[11px] text-zinc-400 font-mono whitespace-pre-wrap overflow-hidden">
                    {chatContext.selection.selectedText.slice(0, 200)}
                    {chatContext.selection.selectedText.length > 200 && "..."}
                  </pre>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-zinc-900/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {/* Model Selector */}
                  <div className="relative">
                    <button
                      onClick={() => setModelDropdownOpen(!isModelDropdownOpen)}
                      className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
                    >
                      <span>{MODELS.find(m => m.id === selectedModel)?.icon}</span>
                      <span>{MODELS.find(m => m.id === selectedModel)?.name}</span>
                      <ChevronDown className={cn(
                        "w-3 h-3 transition-transform",
                        isModelDropdownOpen && "rotate-180"
                      )} />
                    </button>

                    <AnimatePresence>
                      {isModelDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute bottom-full left-0 mb-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50"
                        >
                          {MODELS.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                setSelectedModel(model.id);
                                setModelDropdownOpen(false);
                              }}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 text-xs w-full text-left hover:bg-zinc-800 transition-colors",
                                selectedModel === model.id ? "text-purple-400" : "text-zinc-400"
                              )}
                            >
                              <span>{model.icon}</span>
                              <span>{model.name}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Target Switcher */}
                  <div
                    className="relative inline-flex gap-3 p-0.4 rounded-full shadow-md"
                    style={{
                      background: "linear-gradient(to bottom, #27272a, #18181b)",
                    }}
                  >
                    {/* Animated Active Indicator */}
                    <motion.div
                      className="absolute top-0.5 rounded-full"
                      initial={false}
                      animate={{
                        left: `calc(${(["auto", "contract", "frontend"].indexOf(chatContext.targetMode) / 3) * 100}% + 2px)`,
                        width: `calc(${100 / 2.5}% - 4px)`,
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      style={{
                        height: "calc(100% - 4px)",
                        background: "linear-gradient(135deg, #E6E6E6 0%, #BDBDBD 22%, #6D28D9 55%, #3B0764 100%)",
                        boxShadow: "0 1px 4px rgba(109, 40, 217, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
                      }}
                    />
                    {(["auto", "contract", "frontend"] as ChatTargetMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => onTargetModeChange(m)}
                        className="relative z-10 px-2.5 py-1 text-[12px] rounded-full uppercase font-semibold transition-all duration-200 cursor-pointer"
                        style={{
                          color: chatContext.targetMode === m ? "#F4F4F5" : "#666666",
                        }}
                        title={`Target: ${m}`}
                      >
                        {m === "auto" ? "Auto" : m.slice(0, 1)}
                      </button>
                    ))}
                  </div>

                  {/* orginal target switcher */}

                  {/* <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                       {(["auto", "contract", "frontend"] as ChatTargetMode[]).map((m) => (
                         <button
                           key={m}
                           onClick={() => onTargetModeChange(m)}
                           className={cn(
                             "px-2 py-1 text-[10px] rounded-md hover:text-zinc-100 uppercase font-medium transition-colors",
                             chatContext.targetMode === m 
                               ? "bg-purple-600 text-white shadow-sm" 
                               : "text-zinc-500"
                           )}
                           title={`Target: ${m}`}
                         >
                           {m === "auto" ? "Auto" : m.slice(0, 1)}
                         </button>
                       ))}
                      </div>
                    */}

                </div>

                <div className="text-[10px] text-zinc-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                </div>
              </div>

              <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl focus-within:ring-1 focus-within:ring-purple-500/50 focus-within:border-purple-500/50 transition-all shadow-sm">
                <form onSubmit={handleSend}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      handleInputChange(e);
                      // Auto-resize textarea
                      if (textareaRef.current) {
                        textareaRef.current.style.height = "auto";
                        textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                    disabled={isLoading}
                    rows={1}
                    placeholder={`Ask about ${chatContext.resolvedMode}...`}
                    className="w-full bg-transparent text-sm text-zinc-200 p-3 pr-20 resize-none outline-none max-h-[200px] min-h-[44px] disabled:opacity-50"
                  />
                </form>
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <button className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  {isSpeechSupported && (
                    <button
                      type="button"
                      onClick={toggleListening}
                      disabled={isLoading}
                      className={cn(
                        "p-1.5 rounded-md transition-colors flex items-center gap-1",
                        isListening
                          ? "bg-red-600 text-white hover:bg-red-500 animate-pulse"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                      title={isListening ? "Stop recording" : "Start voice input"}
                    >
                      {isListening ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="p-1.5 bg-purple-600 text-white rounded-md disabled:opacity-50 hover:bg-purple-500 transition-colors flex items-center gap-1"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

