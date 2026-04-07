import { useState, useId, useRef, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { useQueryClient } from '@tanstack/react-query';
import * as Ariakit from '@ariakit/react';
import { Download, Upload, Share2 } from 'lucide-react';
import { DropdownPopup, TooltipAnchor, useMediaQuery, useToastContext } from '@librechat/client';
import { QueryKeys, TStartupConfig } from 'librechat-data-provider';
import type * as t from '~/common';
import ExportModal from '~/components/Nav/ExportConversation/ExportModal';
import { useUploadSingleConversationMutation } from '~/data-provider';
import { ShareButton } from '~/components/Conversations/ConvoOptions';
import { useLocalize } from '~/hooks';
import { NotificationSeverity } from '~/common';
import { logger } from '~/utils';
import store from '~/store';

export default function ExportAndShareMenu({
  isSharedButtonEnabled,
}: {
  isSharedButtonEnabled: boolean;
}) {
  const localize = useLocalize();
  const [showExports, setShowExports] = useState(false);
  const [isPopoverActive, setIsPopoverActive] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();

  const menuId = useId();
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const conversation = useRecoilValue(store.conversationByIndex(0));

  const exportable =
    conversation &&
    conversation.conversationId != null &&
    conversation.conversationId !== 'new' &&
    conversation.conversationId !== 'search';

  const shareHandler = () => {
    setShowShareDialog(true);
  };

  const exportHandler = () => {
    setShowExports(true);
  };

  const handleImportSuccess = useCallback(() => {
    showToast({
      message: localize('com_ui_import_conversation_success'),
      status: NotificationSeverity.SUCCESS,
    });
    setIsImporting(false);
  }, [localize, showToast]);

  const handleImportError = useCallback(
    (error: unknown) => {
      logger.error('Single conversation import error:', error);
      setIsImporting(false);

      const errorMessage = error?.toString() ?? '';
      const isUnsupportedType = errorMessage.includes('Unsupported import type');

      showToast({
        message: localize(
          isUnsupportedType
            ? 'com_ui_import_conversation_file_type_error'
            : 'com_ui_import_conversation_error',
        ),
        status: NotificationSeverity.ERROR,
      });
    },
    [localize, showToast],
  );

  const uploadSingleConversation = useUploadSingleConversationMutation({
    onSuccess: handleImportSuccess,
    onError: handleImportError,
    onMutate: () => setIsImporting(true),
  });

  const handleFileUpload = useCallback(
    (file: File) => {
      try {
        const startupConfig = queryClient.getQueryData<TStartupConfig>([QueryKeys.startupConfig]);
        const maxFileSize = startupConfig?.conversationImportMaxFileSize;
        if (maxFileSize && file.size > maxFileSize) {
          const size = (maxFileSize / (1024 * 1024)).toFixed(2);
          showToast({
            message: localize('com_error_files_upload_too_large', { 0: size }),
            status: NotificationSeverity.ERROR,
          });
          setIsImporting(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', file, encodeURIComponent(file.name || 'File'));
        uploadSingleConversation.mutate(formData);
      } catch (error) {
        logger.error('Single conversation file processing error:', error);
        setIsImporting(false);
        showToast({
          message: localize('com_ui_import_conversation_upload_error'),
          status: NotificationSeverity.ERROR,
        });
      }
    },
    [localize, queryClient, showToast, uploadSingleConversation],
  );

  const handleImportClick = useCallback(() => {
    if (!isImporting) {
      importFileRef.current?.click();
    }
  }, [isImporting]);

  const handleImportFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setIsImporting(true);
        handleFileUpload(file);
      }
      event.target.value = '';
    },
    [handleFileUpload],
  );

  const dropdownItems: t.MenuItemProps[] = [
    {
      label: localize('com_ui_share'),
      onClick: shareHandler,
      icon: <Share2 className="icon-md mr-2 text-text-secondary" />,
      show: isSharedButtonEnabled,
      /** NOTE: THE FOLLOWING PROPS ARE REQUIRED FOR MENU ITEMS THAT OPEN DIALOGS */
      hideOnClick: false,
      ref: shareButtonRef,
      render: (props) => <button {...props} />,
    },
    {
      label: localize('com_nav_export_conversation'),
      onClick: exportHandler,
      icon: <Upload className="icon-md mr-2 text-text-secondary" />,
      /** NOTE: THE FOLLOWING PROPS ARE REQUIRED FOR MENU ITEMS THAT OPEN DIALOGS */
      hideOnClick: false,
      ref: exportButtonRef,
      render: (props) => <button {...props} />,
    },
    {
      label: isImporting ? localize('com_ui_importing') : localize('com_ui_import'),
      onClick: handleImportClick,
      icon: <Download className="icon-md mr-2 text-text-secondary" />,
      disabled: isImporting,
      render: (props) => <button {...props} />,
    },
  ];

  if (exportable === false) {
    return null;
  }

  return (
    <>
      <DropdownPopup
        portal={true}
        menuId={menuId}
        focusLoop={true}
        unmountOnHide={true}
        isOpen={isPopoverActive}
        setIsOpen={setIsPopoverActive}
        trigger={
          <TooltipAnchor
            description={localize('com_endpoint_export_share')}
            render={
              <Ariakit.MenuButton
                id="export-menu-button"
                aria-label="Export options"
                className="inline-flex size-9 flex-shrink-0 items-center justify-center rounded-xl border border-border-light bg-presentation text-text-primary transition-all ease-in-out hover:bg-surface-tertiary disabled:pointer-events-none disabled:opacity-50 radix-state-open:bg-surface-tertiary"
              >
                <Share2
                  className="icon-md text-text-primary"
                  aria-hidden="true"
                  focusable="false"
                />
              </Ariakit.MenuButton>
            }
          />
        }
        items={dropdownItems}
        className={isSmallScreen ? '' : 'absolute right-0 top-0 mt-2'}
      />
      <ExportModal
        open={showExports}
        onOpenChange={setShowExports}
        conversation={conversation}
        triggerRef={exportButtonRef}
        aria-label={localize('com_ui_export_convo_modal')}
      />
      <ShareButton
        triggerRef={shareButtonRef}
        conversationId={conversation.conversationId ?? ''}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
      />
      <input
        ref={importFileRef}
        type="file"
        className="hidden"
        accept=".json"
        onChange={handleImportFileChange}
        aria-hidden="true"
      />
    </>
  );
}
