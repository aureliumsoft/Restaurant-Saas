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

export default function AnalyticsProductHubPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-full flex-col items-center p-4 dark:bg-[#0F0F0F]">
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 lg:flex-row">
        <Card className="flex h-full w-full flex-col lg:w-1/2">
          <CardHeader>
            <CardTitle>
              {t('dashboard.analyticsPages.productTotalSalesTitle')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.analyticsPages.productTotalSalesDescription')}
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
                {[
                  { cx: 5, cy: 45 },
                  { cx: 15, cy: 30 },
                  { cx: 25, cy: 25 },
                  { cx: 35, cy: 20 },
                  { cx: 45, cy: 15 },
                  { cx: 55, cy: 10 },
                  { cx: 65, cy: 5 },
                  { cx: 75, cy: 8 },
                  { cx: 85, cy: 12 },
                  { cx: 95, cy: 10 },
                ].map((point, index) => (
                  <circle
                    key={index}
                    cx={point.cx}
                    cy={point.cy}
                    r="1"
                    fill="blue"
                  />
                ))}
              </svg>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/analytics/product/sales">
                {t('dashboard.analyticsPages.go')}
              </Link>
            </Button>
          </CardFooter>
        </Card>
        <Separator orientation="vertical" className="hidden lg:block" />
        <Card className="flex h-full w-full flex-col lg:w-1/2">
          <CardHeader>
            <CardTitle>
              {t('dashboard.analyticsPages.productFavoritesTitle')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.analyticsPages.productFavoritesDescription')}
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
                {[
                  { x: 10, y: 40, height: 5 },
                  { x: 25, y: 35, height: 10 },
                  { x: 40, y: 30, height: 15 },
                  { x: 55, y: 25, height: 20 },
                  { x: 70, y: 20, height: 25 },
                  { x: 85, y: 15, height: 30 },
                ].map((bar, index) => (
                  <rect
                    key={index}
                    x={bar.x}
                    y={50 - bar.y}
                    width="10"
                    height={bar.height}
                    fill="blue"
                  />
                ))}
              </svg>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/analytics/product/favorites">
                {t('dashboard.analyticsPages.go')}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
