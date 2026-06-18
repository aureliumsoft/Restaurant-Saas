'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { OrderSchedule, OrderScheduleMode } from '@/lib/order-time-slots';
import { generateOrderTimeSlots } from '@/lib/order-time-slots';

type OrderTimePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: OrderSchedule;
  onSave: (schedule: OrderSchedule) => void;
};

export function OrderTimePickerDialog({
  open,
  onOpenChange,
  schedule,
  onSave,
}: OrderTimePickerDialogProps) {
  const { t } = useTranslation();
  const timeSlots = useMemo(() => generateOrderTimeSlots(), []);
  const [draftMode, setDraftMode] = useState<OrderScheduleMode>(schedule.mode);
  const [draftSlot, setDraftSlot] = useState(schedule.slot);
  const [slotsOpen, setSlotsOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftMode(schedule.mode);
    setDraftSlot(
      schedule.slot || timeSlots[0] || t('orderTimeRangePlaceholder')
    );
    setSlotsOpen(false);
  }, [open, schedule, timeSlots, t]);

  const saveAndClose = (next: OrderSchedule) => {
    onSave(next);
    onOpenChange(false);
  };

  const handleAsapSelect = () => {
    setDraftMode('asap');
    setSlotsOpen(false);
    saveAndClose({ mode: 'asap', slot: '' });
  };

  const handleLaterSelect = () => {
    setDraftMode('later');
    const slot = draftSlot || timeSlots[0] || '';
    setDraftSlot(slot);
  };

  const handleSlotSelect = (slot: string) => {
    setDraftSlot(slot);
    setSlotsOpen(false);
    saveAndClose({ mode: 'later', slot });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(100vw-2rem,420px)] gap-0 rounded-2xl border-0 p-6 shadow-xl">
        <DialogTitle className="text-center text-xl font-bold text-[#1f1f2e]">
          {t('orderForWhenTitle')}
        </DialogTitle>

        <div className="mt-6 flex rounded-full bg-[#f4f4f6] p-1">
          <button
            type="button"
            className={cn(
              'flex-1 rounded-full px-3 py-2.5 text-sm font-semibold transition',
              draftMode === 'asap'
                ? 'bg-primary text-primary-foreground'
                : 'text-[#1f1f2e]'
            )}
            onClick={handleAsapSelect}
          >
            {t('orderAsap')}
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 rounded-full px-3 py-2.5 text-sm font-semibold transition',
              draftMode === 'later'
                ? 'bg-primary text-primary-foreground'
                : 'text-[#1f1f2e]'
            )}
            onClick={handleLaterSelect}
          >
            {t('orderForLater')}
          </button>
        </div>

        {draftMode === 'later' ? (
          <div className="relative mt-4">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl bg-[#f4f4f6] px-4 py-3.5 text-left text-sm text-[#8e8e9a]"
              onClick={() => setSlotsOpen((open) => !open)}
            >
              <span>{draftSlot}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
            </button>

            {slotsOpen ? (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[#ececf0] bg-white py-1 shadow-lg">
                {timeSlots.map((slot) => {
                  const isSelected = draftSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between px-4 py-3.5 text-left text-sm text-[#1f1f2e] transition',
                        isSelected && 'bg-[#fff8e1]'
                      )}
                      onClick={() => handleSlotSelect(slot)}
                    >
                      <span>{slot}</span>
                      {isSelected ? (
                        <span className="h-6 w-1 shrink-0 rounded-full bg-[#8e8e9a]" />
                      ) : (
                        <span className="h-6 w-1 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
