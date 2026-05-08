import React, { useMemo, useState, useEffect } from 'react';
import { Coins } from 'lucide-react';
import type { TMessage, TMessageContentParts } from 'librechat-data-provider';

const TOKEN_DISPLAY_KEY = 'librechat_show_message_tokens';

interface MessageTokensProps {
  message: TMessage;
  messages?: TMessage[];
  isLast?: boolean;
}

/**
 * Extract all readable text from a message using every available source:
 * 1. message.text (simple messages)
 * 2. message.content parts (structured messages with TEXT, THINK, etc.)
 *    - part.text can be a plain string OR a TextData object with a .value property
 */
function extractText(message: TMessage): string {
  if (message.text && message.text.length > 0) {
    return message.text;
  }

  if (Array.isArray(message.content)) {
    return extractFromContentParts(message.content);
  }

  return '';
}

function extractFromContentParts(content: TMessageContentParts[]): string {
  const chunks: string[] = [];
  for (const part of content) {
    if (part == null) continue;

    if ('text' in part) {
      const tf = part.text;
      if (typeof tf === 'string' && tf.length > 0) {
        chunks.push(tf);
      } else if (tf && typeof tf === 'object' && 'value' in tf && typeof tf.value === 'string') {
        chunks.push(tf.value);
      }
    }

    if ('think' in part) {
      const tk = part.think;
      if (typeof tk === 'string' && tk.length > 0) {
        chunks.push(tk);
      } else if (tk && typeof tk === 'object' && 'value' in tk && typeof tk.value === 'string') {
        chunks.push(tk.value);
      }
    }
  }
  return chunks.join('');
}

function getTokens(message: TMessage): number {
  const explicit = Number(message.tokenCount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const text = extractText(message);
  return text.length > 0 ? Math.ceil(text.length / 4) : 0;
}

function flattenTree(messages: TMessage[]): TMessage[] {
  const result: TMessage[] = [];
  for (const msg of messages) {
    result.push(msg);
    if (msg.children && msg.children.length > 0) {
      result.push(...flattenTree(msg.children));
    }
  }
  return result;
}

export default function MessageTokens({ message, messages, isLast }: MessageTokensProps) {
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

  const msgTokens = useMemo(() => getTokens(message), [message]);

  const cumulative = useMemo(() => {
    if (!messages || messages.length === 0 || !message.messageId) return msgTokens;
    let total = 0;
    for (const m of flattenTree(messages)) {
      total += getTokens(m);
      if (m.messageId === message.messageId) break;
    }
    return total;
  }, [messages, message.messageId, msgTokens]);

  if (!showTokens || msgTokens <= 0) return null;

  const hasExplicit = Number.isFinite(Number(message.tokenCount)) && Number(message.tokenCount) > 0;
  const prefix = hasExplicit ? '' : '~';

  return (
    <div
      className={`flex items-center gap-1 self-center text-[11px] text-text-secondary-alt transition-opacity ${
        isLast ? '' : 'md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
      }`}
    >
      <Coins className="h-3 w-3 shrink-0" />
      <span className="whitespace-nowrap">
        {prefix}{msgTokens.toLocaleString()}
        {cumulative > msgTokens && (
          <>
            <span className="mx-0.5 opacity-50">/</span>
            {prefix}{cumulative.toLocaleString()}
          </>
        )}
      </span>
    </div>
  );
}
