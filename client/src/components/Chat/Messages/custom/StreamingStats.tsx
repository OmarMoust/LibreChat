/**
 * StreamingStats - Displays live tokens-per-second during streaming
 * Custom component isolated from core LibreChat for easier upstream merges
 *
 * Shows:
 * - Live tokens/sec while streaming
 * - Final tokens/sec stat after completion (persisted)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { useLocalize } from '~/hooks';

// Storage key for token display preference (must match Usage.tsx)
const TOKEN_DISPLAY_KEY = 'librechat_show_message_tokens';

interface StreamingStatsProps {
  /** The current text content being streamed */
  text: string;
  /** Whether the message is currently being streamed */
  isSubmitting: boolean;
  /** Whether this is the latest message */
  isLatestMessage: boolean;
}

/**
 * Simple token estimation based on character count
 * Roughly 4 characters per token for English text
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  // More accurate estimation: ~4 chars per token for English
  // This is a rough estimate - actual tokenization varies by model
  return Math.ceil(text.length / 4);
}

export default function StreamingStats({
  text,
  isSubmitting,
  isLatestMessage,
}: StreamingStatsProps) {
  const localize = useLocalize();
  const [tokensPerSecond, setTokensPerSecond] = useState<number>(0);
  const [finalStats, setFinalStats] = useState<{ tps: number; totalTokens: number; duration: number } | null>(null);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  
  // Check if token display is enabled
  const [showTokens, setShowTokens] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_DISPLAY_KEY) !== 'false';
    }
    return true;
  });

  // Listen for toggle changes from Usage settings
  useEffect(() => {
    const handleChange = (e: CustomEvent<boolean>) => {
      setShowTokens(e.detail);
    };
    
    window.addEventListener('tokenDisplayChange', handleChange as EventListener);
    return () => {
      window.removeEventListener('tokenDisplayChange', handleChange as EventListener);
    };
  }, []);

  // Refs for tracking
  const startTimeRef = useRef<number | null>(null);
  const prevTextLengthRef = useRef<number>(0);
  const tokenHistoryRef = useRef<Array<{ time: number; tokens: number }>>([]);
  const wasSubmittingRef = useRef<boolean>(false);

  // Calculate rolling average tokens per second
  const calculateTps = useCallback(() => {
    const now = Date.now();
    const currentTokens = estimateTokens(text);

    // Add to history
    tokenHistoryRef.current.push({ time: now, tokens: currentTokens });

    // Keep only last 2 seconds of history for rolling average
    const cutoff = now - 2000;
    tokenHistoryRef.current = tokenHistoryRef.current.filter((h) => h.time > cutoff);

    if (tokenHistoryRef.current.length < 2) {
      return 0;
    }

    const oldest = tokenHistoryRef.current[0];
    const newest = tokenHistoryRef.current[tokenHistoryRef.current.length - 1];
    const timeDiff = (newest.time - oldest.time) / 1000;
    const tokenDiff = newest.tokens - oldest.tokens;

    if (timeDiff <= 0) return 0;

    return Math.round(tokenDiff / timeDiff);
  }, [text]);

  // Detect streaming start
  useEffect(() => {
    if (isSubmitting && isLatestMessage && text.length > prevTextLengthRef.current) {
      if (!hasStartedStreaming) {
        setHasStartedStreaming(true);
        startTimeRef.current = Date.now();
        tokenHistoryRef.current = [];
        setFinalStats(null);
      }
    }
    prevTextLengthRef.current = text.length;
  }, [isSubmitting, isLatestMessage, text, hasStartedStreaming]);

  // Update TPS during streaming
  useEffect(() => {
    if (!hasStartedStreaming || !isSubmitting) return;

    const interval = setInterval(() => {
      const tps = calculateTps();
      setTokensPerSecond(tps);
    }, 200);

    return () => clearInterval(interval);
  }, [hasStartedStreaming, isSubmitting, calculateTps]);

  // Handle streaming completion
  useEffect(() => {
    // Detect when submitting stops (was submitting, now not)
    if (wasSubmittingRef.current && !isSubmitting && hasStartedStreaming && text) {
      const endTime = Date.now();
      const duration = startTimeRef.current ? (endTime - startTimeRef.current) / 1000 : 0;
      const totalTokens = estimateTokens(text);

      if (duration > 0.5 && totalTokens > 0) {
        const avgTps = Math.round(totalTokens / duration);
        setFinalStats({ tps: avgTps, totalTokens, duration });
      }

      setHasStartedStreaming(false);
      setTokensPerSecond(0);
      startTimeRef.current = null;
      tokenHistoryRef.current = [];
    }
    
    wasSubmittingRef.current = isSubmitting;
  }, [isSubmitting, hasStartedStreaming, text]);

  // Don't show if disabled
  if (!showTokens) {
    return null;
  }

  // Show live stats during streaming
  if (hasStartedStreaming && isSubmitting && tokensPerSecond > 0) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400">
        <Zap className="h-3 w-3 animate-pulse" />
        <span className="font-medium">
          {tokensPerSecond} {localize('com_ui_tokens_per_second')}
        </span>
      </div>
    );
  }

  // Show final stats after completion (only for latest message)
  if (finalStats && isLatestMessage && !isSubmitting) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-tertiary">
        <Zap className="h-3 w-3" />
        <span>
          ~{finalStats.totalTokens.toLocaleString()} {localize('com_ui_tokens')} @ {finalStats.tps}{' '}
          {localize('com_ui_tokens_per_second')} ({finalStats.duration.toFixed(1)}s)
        </span>
      </div>
    );
  }

  return null;
}
