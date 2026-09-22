'use client';

import Link from 'next/link';
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
import { Separator } from '@/components/ui/separator';

export default function AnalyticsHubPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-full flex-col items-center p-4 dark:bg-[#0F0F0F]">
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 lg:flex-row">
        <Card className="flex h-full w-full flex-col lg:w-1/2">
          <CardHeader>
            <CardTitle>{t('dashboard.analyticsPages.hubProductTitle')}</CardTitle>
            <CardDescription>
              {t('dashboard.analyticsPages.hubProductDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow pt-5">
            <div className="p-4">
              <svg viewBox="0 0 100 50" className="h-auto w-full">
                <line
                  x1="0"
                  y1="45"
                  x2="100"
                  y2="45"
                  stroke="black"
                  strokeWidth="0.5"
                />
                <line
                  x1="5"
                  y1="0"
                  x2="5"
                  y2="50"
                  stroke="black"
                  strokeWidth="0.5"
                />
                <polyline
                  fill="none"
                  stroke="blue"
                  strokeWidth="0.5"
                  points="5,45 15,30 25,25 35,20 45,15 55,10 65,5 75,8 85,12 95,10"
                />
                <circle cx="5" cy="45" r="1" fill="blue" />
                <circle cx="15" cy="30" r="1" fill="blue" />
                <circle cx="25" cy="25" r="1" fill="blue" />
                <circle cx="35" cy="20" r="1" fill="blue" />
                <circle cx="45" cy="15" r="1" fill="blue" />
                <circle cx="55" cy="10" r="1" fill="blue" />
                <circle cx="65" cy="5" r="1" fill="blue" />
                <circle cx="75" cy="8" r="1" fill="blue" />
                <circle cx="85" cy="12" r="1" fill="blue" />
                <circle cx="95" cy="10" r="1" fill="blue" />
              </svg>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/analytics/product">
                {t('dashboard.analyticsPages.go')}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Separator orientation="vertical" className="hidden lg:block" />
        <Card className="flex h-full w-full flex-col lg:w-1/2">
          <CardHeader>
            <CardTitle>{t('dashboard.analyticsPages.hubIncomeTitle')}</CardTitle>
            <CardDescription>
              {t('dashboard.analyticsPages.hubIncomeDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow pt-5">
            <div className="p-4">
              <svg viewBox="0 0 100 50" className="h-auto w-full">
                <line
                  x1="0"
                  y1="45"
                  x2="100"
                  y2="45"
                  stroke="black"
                  strokeWidth="0.5"
                />
                <line
                  x1="5"
                  y1="0"
                  x2="5"
                  y2="50"
                  stroke="black"
                  strokeWidth="0.5"
                />
                <polyline
                  fill="none"
                  stroke="blue"
                  strokeWidth="0.5"
                  points="5,45 15,40 25,35 35,30 45,25 55,20 65,15 75,20 85,25 95,30"
                />
                <circle cx="5" cy="45" r="1" fill="blue" />
                <circle cx="15" cy="40" r="1" fill="blue" />
                <circle cx="25" cy="35" r="1" fill="blue" />
                <circle cx="35" cy="30" r="1" fill="blue" />
                <circle cx="45" cy="25" r="1" fill="blue" />
                <circle cx="55" cy="20" r="1" fill="blue" />
                <circle cx="65" cy="15" r="1" fill="blue" />
                <circle cx="75" cy="20" r="1" fill="blue" />
                <circle cx="85" cy="25" r="1" fill="blue" />
                <circle cx="95" cy="30" r="1" fill="blue" />
              </svg>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/analytics/income">
                {t('dashboard.analyticsPages.go')}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
