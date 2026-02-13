/**
 * Stella RAG Client - Retrieval Augmented Generation for Stellar Documentation
 * This service queries the Stella RAG API to get Stellar-specific context
 * for enhancing AI responses with accurate Stellar/Soroban documentation.
 */

const STELLA_RAG_URL =
  "https://stella-rag-prod.jutsu.ai/api/threads/thread_dda93944a3974930adbf6ddeaa9948c2/runs";

const STELLA_RAG_HEADERS = {
  "Content-Type": "application/json",
  Accept: "text/event-stream",
  "x-api-key": process.env.STELLA_RAG_API_KEY,
  Origin: "https://stellar.org",
  Referer: "https://stellar.org/",
};

export interface StellaRAGOptions {
  timeout?: number;
  onChunk?: (chunk: string) => void;
}

/**
 * Queries Stella RAG API and returns the full response as a string.
 * Handles Server-Sent Events (SSE) streaming correctly.
 * 
 * @param prompt - The user's prompt/question
 * @param options - Optional configuration (timeout, streaming callback)
 * @returns Promise<string> - The complete response from Stella RAG
 */
export async function runStellaRAG(
  prompt: string,
  options: StellaRAGOptions = {}
): Promise<string> {
  const { timeout = 120000, onChunk } = options;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(STELLA_RAG_URL, {
      method: "POST",
      headers: STELLA_RAG_HEADERS,
      body: JSON.stringify({ input: prompt }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stella RAG API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error("No response body from Stella RAG API");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          // SSE format: "data: {...}"
          if (!line.startsWith("data:")) continue;

          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            const eventType = event.type;

            if (eventType === "content") {
              const text = event.content || "";
              finalText += text;
              
              // Call streaming callback if provided
              if (onChunk) {
                onChunk(text);
              }
            } else if (eventType === "done") {
              return finalText;
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return finalText;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("Stella RAG request timed out");
      }
      throw error;
    }
    throw new Error("Unknown error in Stella RAG request");
  }
}

/**
 * Queries Stella RAG and returns a refined prompt that includes
 * Stellar documentation context. This can be used to enhance
 * the system prompt for the main AI model.
 * 
 * @param userPrompt - The user's original prompt
 * @returns Promise<string> - Enhanced prompt with Stellar context
 */
export async function getStellarContext(userPrompt: string): Promise<string> {
  try {
    const stellarContext = await runStellaRAG(userPrompt, {
      timeout: 60000, // 60 second timeout for context retrieval
    });

    // If we got context, format it nicely
    if (stellarContext && stellarContext.trim()) {
      return `\n\n--- Stellar Documentation Context ---\n${stellarContext}\n\n--- End Context ---\n\nBased on the above Stellar documentation, please provide a comprehensive answer to the user's question.`;
    }

    return "";
  } catch (error) {
    console.error("[stellaRAG] Error getting context:", error);
    // Return empty string on error - don't break the main flow
    return "";
  }
}

/**
 * Determines if a prompt should use Stella RAG based on keywords.
 * This helps avoid unnecessary API calls for non-Stellar questions.
 * 
 * @param prompt - The user's prompt
 * @returns boolean - Whether to use Stella RAG
 */
export function shouldUseStellaRAG(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  
  const stellarKeywords = [
    "stellar",
    "soroban",
    "contract",
    "smart contract",
    "wasm",
    "stellar sdk",
    "soroban sdk",
    "deploy",
    "invoke",
    "storage",
    "ledger",
    "transaction",
    "xdr",
    "horizon",
    "network",
    "testnet",
    "mainnet",
  ];

  // Check if prompt contains any Stellar-related keywords
  return stellarKeywords.some((keyword) => lowerPrompt.includes(keyword));
}
