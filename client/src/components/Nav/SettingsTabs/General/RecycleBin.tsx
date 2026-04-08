import { useState } from 'react';
import { OGDialogTemplate, OGDialog, OGDialogTrigger, Button } from '@librechat/client';
import RecycleBinTable from './RecycleBinTable';
import { useLocalize } from '~/hooks';

export default function RecycleBin() {
  const localize = useLocalize();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <div>{localize('com_nav_recycle_bin')}</div>
      <OGDialog open={isOpen} onOpenChange={setIsOpen}>
        <OGDialogTrigger asChild>
          <Button variant="outline" aria-label={localize('com_nav_recycle_bin')}>
            {localize('com_ui_manage')}
          </Button>
        </OGDialogTrigger>
        <OGDialogTemplate
          title={localize('com_nav_recycle_bin')}
          className="max-w-[1000px]"
          showCancelButton={false}
          main={<RecycleBinTable isOpen={isOpen} onOpenChange={setIsOpen} />}
        />
      </OGDialog>
    </div>
  );
}
