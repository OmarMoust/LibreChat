import React, { useState, useEffect } from 'react';
import { Coins } from 'lucide-react';
import type { TMessage } from 'librechat-data-provider';

const TOKEN_DISPLAY_KEY = 'librechat_show_message_tokens';

interface MessageTokensProps {
  message: TMessage;
}

/**
 * Extract readable text from a message, checking both `text` and `content` fields.
 * LibreChat stores text in `text` for simple messages and in `content` parts for
 * structured (multi-part, tool call, thinking) messages.
 */
function extractText(message: TMessage): string {
  if (message.text && message.text.length > 0) {
    return message.text;
  }

  if (Array.isArray(message.content)) {
    const parts: string[] = [];
    for (const part of message.content) {
      if (part == null) continue;
      if (typeof part === 'string') {
        parts.push(part);
        continue;
      }
      if ('text' in part && typeof part.text === 'string') {
        parts.push(part.text);
      }
    }
    return parts.join('');
  }

  return '';
}

export default function MessageTokens({ message }: MessageTokensProps) {
  const [showTokens, setShowTokens] = useState(() => {
    try {
      return typeof window !== 'undefined'
        ? localStorage.getItem(TOKEN_DISPLAY_KEY) !== 'false'
        : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const handler = (e: Event) => setShowTokens((e as CustomEvent<boolean>).detail);
    window.addEventListener('tokenDisplayChange', handler);
    return () => window.removeEventListener('tokenDisplayChange', handler);
  }, []);

  if (!showTokens) {
    return null;
  }

  const explicit = Number(message.tokenCount);
  const hasExplicit = Number.isFinite(explicit) && explicit > 0;
  const tokens = hasExplicit ? explicit : Math.ceil(extractText(message).length / 4);

  if (tokens <= 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 self-center text-[11px] text-text-secondary-alt opacity-70">
      <Coins className="h-3 w-3" />
      <span>{hasExplicit ? tokens.toLocaleString() : `~${tokens.toLocaleString()}`}</span>
    </div>
  );
}
