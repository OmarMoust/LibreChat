import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useRecoilValue } from 'recoil';
import { TextareaAutosize, TooltipAnchor } from '@librechat/client';
import { useUpdateMessageMutation } from 'librechat-data-provider/react-query';
import type { TEditProps, ExtendedFile } from '~/common';
import { useMessagesOperations, useMessagesConversation } from '~/Providers';
import { useGetAddedConvo } from '~/hooks/Chat';
import { cn, removeFocusRings } from '~/utils';
import { useLocalize } from '~/hooks';
import AttachFileChat from '~/components/Chat/Input/Files/AttachFileChat';
import FileRow from '~/components/Chat/Input/Files/FileRow';
import Container from './Container';
import store from '~/store';

function toEditFileMap(
  files: NonNullable<TEditProps['message']['files']> | undefined,
): Map<string, ExtendedFile> {
  const map = new Map<string, ExtendedFile>();
  if (!Array.isArray(files)) {
    return map;
  }

  files.forEach((file, idx) => {
    const key = file.file_id ?? file.filepath ?? `edit-file-${idx}`;
    if (!key) {
      return;
    }
    map.set(key, {
      ...file,
      file_id: file.file_id ?? key,
      progress: 1,
      size: file.bytes ?? 0,
      attached: true,
    });
  });

  return map;
}

function toMessageFiles(files: Map<string, ExtendedFile>) {
  const mapped = Array.from(files.values())
    .filter((file) => file.progress >= 1)
    .map((file) => ({
      file_id: file.file_id,
      filepath: file.filepath,
      filename: file.filename,
      type: file.type ?? '',
      height: file.height,
      width: file.width,
    }));

  return mapped;
}

const EditMessage = ({
  text,
  message,
  isSubmitting,
  ask,
  enterEdit,
  siblingIdx,
  setSiblingIdx,
}: TEditProps) => {
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const { conversation } = useMessagesConversation();
  const { getMessages, setMessages } = useMessagesOperations();
  const initialEditFiles = useMemo(() => toEditFileMap(message.files), [message.files]);
  const [editFiles, setEditFiles] = useState<Map<string, ExtendedFile>>(initialEditFiles);
  const [filesLoading, setFilesLoading] = useState(false);

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const { conversationId, parentMessageId, messageId } = message;
  const updateMessageMutation = useUpdateMessageMutation(conversationId ?? '');
  const localize = useLocalize();

  const chatDirection = useRecoilValue(store.chatDirection).toLowerCase();
  const isRTL = chatDirection === 'rtl';

  const getAddedConvo = useGetAddedConvo();

  const { register, handleSubmit, setValue } = useForm({
    defaultValues: {
      text: text ?? '',
    },
  });

  useEffect(() => {
    const textArea = textAreaRef.current;
    if (textArea) {
      const length = textArea.value.length;
      textArea.focus();
      textArea.setSelectionRange(length, length);
    }
  }, []);

  useEffect(() => {
    setEditFiles(initialEditFiles);
  }, [initialEditFiles, messageId]);

  const applyLocalMessageEdits = useCallback(
    (updatedText: string, updatedFiles: ReturnType<typeof toMessageFiles>) => {
      const messages = getMessages();
      if (!messages) {
        return;
      }

      const isInMessages = messages.some((msg) => msg.messageId === messageId);
      if (!isInMessages) {
        message.text = updatedText;
        if (message.isCreatedByUser) {
          message.files = updatedFiles;
        }
        return;
      }

      setMessages(
        messages.map((msg) =>
          msg.messageId === messageId
            ? {
                ...msg,
                text: updatedText,
                ...(message.isCreatedByUser ? { files: updatedFiles } : {}),
              }
            : msg,
        ),
      );
    },
    [getMessages, message, messageId, setMessages],
  );

  const resubmitMessage = (data: { text: string }) => {
    const editedFiles = toMessageFiles(editFiles);
    if (message.isCreatedByUser) {
      updateMessageMutation.mutate({
        conversationId: conversationId ?? '',
        model: conversation?.model ?? 'gpt-3.5-turbo',
        text: data.text,
        messageId,
        files: editedFiles,
      });
      applyLocalMessageEdits(data.text, editedFiles);
      ask(
        {
          text: data.text,
          parentMessageId,
          conversationId,
        },
        {
          overrideFiles: editedFiles,
          /** Pills on the edited user message stay visible after save-and-submit;
           *  carry the picks forward so the new turn primes the same skills
           *  instead of running unprimed. */
          overrideManualSkills: message.manualSkills,
          addedConvo: getAddedConvo() || undefined,
        },
      );

      setSiblingIdx((siblingIdx ?? 0) - 1);
    } else {
      const messages = getMessages();
      const parentMessage = messages?.find((msg) => msg.messageId === parentMessageId);

      if (!parentMessage) {
        return;
      }
      ask(
        { ...parentMessage },
        {
          editedText: data.text,
          editedMessageId: messageId,
          isRegenerate: true,
          isEdited: true,
          /** Edit-assistant-response flow replays the parent user turn; keep
           *  the same manual skills so the regenerated response is primed
           *  identically. */
          overrideManualSkills: parentMessage.manualSkills,
          addedConvo: getAddedConvo() || undefined,
        },
      );

      setSiblingIdx((siblingIdx ?? 0) - 1);
    }

    enterEdit(true);
  };

  const updateMessage = (data: { text: string }) => {
    const editedFiles = toMessageFiles(editFiles);
    const updatedPayload = {
      conversationId: conversationId ?? '',
      model: conversation?.model ?? 'gpt-3.5-turbo',
      text: data.text,
      messageId,
      ...(message.isCreatedByUser ? { files: editedFiles } : {}),
    };

    updateMessageMutation.mutate({
      ...updatedPayload,
    });
    applyLocalMessageEdits(data.text, editedFiles);

    enterEdit(true);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitButtonRef.current?.click();
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveButtonRef.current?.click();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        enterEdit(true);
      }
    },
    [enterEdit],
  );

  const { ref, ...registerProps } = register('text', {
    required: true,
    onChange: (e) => {
      setValue('text', e.target.value, { shouldValidate: true });
    },
  });

  const isUserMessage = message.isCreatedByUser;
  const messageForContainer = isUserMessage ? { ...message, files: undefined } : message;

  return (
    <Container message={messageForContainer}>
      {isUserMessage && (
        <>
          <FileRow
            files={editFiles}
            setFiles={setEditFiles}
            isRTL={isRTL}
            setFilesLoading={setFilesLoading}
            Wrapper={({ children }) => (
              <div className="mx-2 mt-2 flex w-full max-w-full flex-wrap gap-2">{children}</div>
            )}
          />
          <div className="mx-2 -mt-1 mb-1">
            <AttachFileChat
              conversation={conversation}
              disableInputs={isSubmitting}
              files={editFiles}
              setFiles={setEditFiles}
              setFilesLoading={setFilesLoading}
            />
          </div>
        </>
      )}
      <div className="bg-token-main-surface-primary relative mt-2 flex w-full flex-grow flex-col overflow-hidden rounded-2xl border border-border-medium text-text-primary [&:has(textarea:focus)]:border-border-heavy [&:has(textarea:focus)]:shadow-[0_2px_6px_rgba(0,0,0,.05)]">
        <TextareaAutosize
          {...registerProps}
          ref={(e) => {
            ref(e);
            textAreaRef.current = e;
          }}
          onKeyDown={handleKeyDown}
          data-testid="message-text-editor"
          className={cn(
            'markdown prose dark:prose-invert light whitespace-pre-wrap break-words pl-3 md:pl-4',
            'm-0 w-full resize-none border-0 bg-transparent py-[10px]',
            'placeholder-text-secondary focus:ring-0 focus-visible:ring-0 md:py-3.5',
            isRTL ? 'text-right' : 'text-left',
            'max-h-[65vh] pr-3 md:max-h-[75vh] md:pr-4',
            removeFocusRings,
          )}
          aria-label={localize('com_ui_message_input')}
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      </div>
      <div className="mt-2 flex w-full justify-center text-center">
        <TooltipAnchor
          description="Ctrl + Enter / ⌘ + Enter"
          render={
            <button
              ref={submitButtonRef}
              className="btn btn-primary relative mr-2"
              disabled={isSubmitting || filesLoading}
              onClick={handleSubmit(resubmitMessage)}
            >
              {localize('com_ui_save_submit')}
            </button>
          }
        />
        <TooltipAnchor
          description="Shift + Enter"
          render={
            <button
              ref={saveButtonRef}
              className="btn btn-secondary relative mr-2"
              disabled={isSubmitting || filesLoading}
              onClick={handleSubmit(updateMessage)}
            >
              {localize('com_ui_save')}
            </button>
          }
        />
        <TooltipAnchor
          description="Esc"
          render={
            <button className="btn btn-neutral relative" onClick={() => enterEdit(true)}>
              {localize('com_ui_cancel')}
            </button>
          }
        />
      </div>
    </Container>
  );
};

export default EditMessage;
