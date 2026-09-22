'use client';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'react-toastify';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { taxSchema } from '@/schema';
import { ZodError } from 'zod';
import { ReloadIcon } from '@radix-ui/react-icons';
import eventBus from '@/lib/even';
import { SaveConfirmation } from '@/components/ui/confirmation-dialogs';

interface TaxrateCardProps {
  tax: number | 0;
  storeId: string | null;
}
const TaxrateCard: React.FC<TaxrateCardProps> = ({ tax, storeId }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [editableTaxrate, setEditableTaxrate] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const taxNumber = parseFloat(editableTaxrate) || 0;
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditableTaxrate(e.target.value);
  };
  useEffect(() => {
    setEditableTaxrate(tax?.toString() ?? '');
  }, [tax]);

  const handleSaveClick = () => {
    if (taxNumber === tax) {
      toast.info(t('settings.cards.shopName.noChanges'));
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmSave = async () => {
    // Check if the user is online
    const isOnline = navigator.onLine;

    if (!isOnline) {
      toast.error(t('settings.cards.shopName.offline'));
      return;
    }

    if (!storeId) {
      toast.error(t('settings.cards.shopName.storeIdRequired'));
      return;
    }

    setIsLoading(true);
    try {
      const validatedData = taxSchema.parse({
        tax: taxNumber,
      });

      await axios.patch(`/api/shopdata/${storeId}`, validatedData);

      toast.success('Tax updated successfully.');
      setShowConfirmation(false);
      eventBus.emit('fetchStoreData');
    } catch (error) {
      if (error instanceof ZodError) {
        // Handle ZodError
        const fieldErrors = error.errors.map((err) => err.message);
        toast.error(`${fieldErrors.join(', ')}`);
      } else {
        toast.error('Failed to update store tax.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card x-chunk="dashboard-04-chunk-1" className="my-5">
        <CardHeader>
          <CardTitle>{t('settings.cards.tax.title')}</CardTitle>
          <CardDescription>{t('settings.cards.tax.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <Input
              type="number"
              value={editableTaxrate}
              onChange={handleInputChange}
            />
          </form>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button
            className="text-white"
            onClick={handleSaveClick}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                {t('settings.cards.shopName.pleaseWait')}
              </>
            ) : (
              t('settings.cards.shopName.save')
            )}
          </Button>
        </CardFooter>
      </Card>
      <SaveConfirmation
        open={showConfirmation}
        title={t('settings.cards.tax.confirmTitle')}
        description={t('settings.cards.tax.confirmDescription')}
        itemName={editableTaxrate + '%'}
        loading={isLoading}
        onConfirm={handleConfirmSave}
        onCancel={() => setShowConfirmation(false)}
      />
    </>
  );
};

export default TaxrateCard;
