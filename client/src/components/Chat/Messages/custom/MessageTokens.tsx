/**
 * MessageTokens - Displays token count information under each message
 * Custom component isolated from core LibreChat for easier upstream merges
 *
 * Shows:
 * - Single message tokens: tokens for this specific message
 * - Cumulative tokens: total tokens in conversation up to this message
 */
import React, { useMemo, useState, useEffect } from 'react';
import { Coins } from 'lucide-react';
import type { TMessage } from 'librechat-data-provider';

// Storage key for token display preference (must match Usage.tsx)
const TOKEN_DISPLAY_KEY = 'librechat_show_message_tokens';

interface MessageTokensProps {
  message: TMessage;
  messages?: TMessage[];
}

function estimateTokens(text: string | undefined): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

function getEffectiveTokenCount(message: TMessage): number {
  const explicitTokenCount = Number(message.tokenCount);
  if (Number.isFinite(explicitTokenCount) && explicitTokenCount > 0) {
    return explicitTokenCount;
  }
  return estimateTokens(message.text);
}

/**
 * Calculate cumulative token count up to and including this message
 */
function calculateCumulativeTokens(
  messages: TMessage[] | undefined,
  currentMessageId: string,
): number {
  if (!messages || messages.length === 0) {
    return 0;
  }

  let total = 0;
  const flatMessages = flattenMessages(messages);

  for (const msg of flatMessages) {
    // Add explicit tokenCount when present, otherwise use a lightweight estimate.
    total += getEffectiveTokenCount(msg);
    // Stop when we reach the current message
    if (msg.messageId === currentMessageId) {
      break;
    }
  }

  return total;
}

/**
 * Flatten nested message tree into array ordered by conversation flow
 */
function flattenMessages(messages: TMessage[]): TMessage[] {
  const result: TMessage[] = [];

  function traverse(msgs: TMessage[]) {
    for (const msg of msgs) {
      result.push(msg);
      if (msg.children && msg.children.length > 0) {
        traverse(msg.children);
      }
    }
  }

  traverse(messages);
  return result;
}

export default function MessageTokens({ message, messages }: MessageTokensProps) {
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

  const explicitTokenCount = Number(message.tokenCount);
  const hasExplicitTokenCount = Number.isFinite(explicitTokenCount) && explicitTokenCount > 0;
  const messageTokens = getEffectiveTokenCount(message);

  const cumulativeTokens = useMemo(() => {
    if (!messages || !message.messageId) {
      return messageTokens;
    }
    return calculateCumulativeTokens(messages, message.messageId);
  }, [messages, message.messageId, messageTokens]);

  // Don't show if disabled or no token data
  if (!showTokens || (!messageTokens && !cumulativeTokens)) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
      <Coins className="h-3 w-3" />
      <span>
        {messageTokens > 0 && (
          <>
            <span className="font-medium">
              {hasExplicitTokenCount
                ? messageTokens.toLocaleString()
                : `~${messageTokens.toLocaleString()}`}
            </span>
            <span className="mx-0.5 opacity-50">/</span>
          </>
        )}
        <span>{cumulativeTokens.toLocaleString()}</span>
      </span>
    </div>
  );
}
