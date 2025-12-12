/**
 * StreamingStats - Displays live tokens-per-second during streaming
 * Custom component isolated from core LibreChat for easier upstream merges
 *
 * Shows:
 * - Live tokens/sec while streaming
 * - Final tokens/sec stat after completion
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { useLocalize } from '~/hooks';

interface StreamingStatsProps {
  /** The current text content being streamed */
  text: string;
  /** Whether the message is currently being streamed */
  isSubmitting: boolean;
  /** Whether this is the latest message */
  isLatestMessage: boolean;
  /** Whether the message is finished */
  isFinished: boolean;
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
  isFinished,
}: StreamingStatsProps) {
  const localize = useLocalize();
  const [tokensPerSecond, setTokensPerSecond] = useState<number>(0);
  const [finalStats, setFinalStats] = useState<{ tps: number; totalTokens: number } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Refs for tracking
  const startTimeRef = useRef<number | null>(null);
  const lastTokenCountRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);
  const tokenHistoryRef = useRef<Array<{ time: number; tokens: number }>>([]);

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

  // Start tracking when streaming begins
  useEffect(() => {
    if (isSubmitting && isLatestMessage && !isFinished) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
        lastTokenCountRef.current = 0;
        tokenHistoryRef.current = [];
        setFinalStats(null);
      }
      setIsStreaming(true);
    }
  }, [isSubmitting, isLatestMessage, isFinished]);

  // Update TPS during streaming
  useEffect(() => {
    if (!isStreaming || isFinished) return;

    const interval = setInterval(() => {
      const tps = calculateTps();
      setTokensPerSecond(tps);
    }, 200); // Update every 200ms for smooth display

    return () => clearInterval(interval);
  }, [isStreaming, isFinished, calculateTps]);

  // Handle streaming completion
  useEffect(() => {
    if (isStreaming && (isFinished || (!isSubmitting && text))) {
      const endTime = Date.now();
      const totalTime = startTimeRef.current ? (endTime - startTimeRef.current) / 1000 : 0;
      const totalTokens = estimateTokens(text);

      if (totalTime > 0 && totalTokens > 0) {
        const avgTps = Math.round(totalTokens / totalTime);
        setFinalStats({ tps: avgTps, totalTokens });
      }

      setIsStreaming(false);
      startTimeRef.current = null;
      tokenHistoryRef.current = [];
    }
  }, [isFinished, isSubmitting, text, isStreaming]);

  // Reset when message changes
  useEffect(() => {
    if (!isLatestMessage) {
      setIsStreaming(false);
      setTokensPerSecond(0);
      startTimeRef.current = null;
      tokenHistoryRef.current = [];
    }
  }, [isLatestMessage]);

  // Show live stats during streaming
  if (isStreaming && tokensPerSecond > 0) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400">
        <Zap className="h-3 w-3 animate-pulse" />
        <span className="font-medium">
          {tokensPerSecond} {localize('com_ui_tokens_per_second')}
        </span>
      </div>
    );
  }

  // Show final stats after completion
  if (finalStats && !isStreaming) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-tertiary">
        <Zap className="h-3 w-3" />
        <span>
          ~{finalStats.totalTokens.toLocaleString()} {localize('com_ui_tokens')} @ {finalStats.tps}{' '}
          {localize('com_ui_tokens_per_second')}
        </span>
      </div>
    );
  }

  return null;
}

