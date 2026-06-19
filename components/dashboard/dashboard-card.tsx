import * as React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

import {
  dashboardCardClass,
  dashboardCardDescriptionClass,
  dashboardCardHeaderClass,
  dashboardCardTitleClass,
  dashboardGridCardClass,
  dashboardNestedCardClass,
  dashboardStatCardClass,
} from './dashboard-surface';

export function DashboardCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return <Card className={cn(dashboardCardClass, className)} {...props} />;
}

export function DashboardGridCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return <Card className={cn(dashboardGridCardClass, className)} {...props} />;
}

export function DashboardStatCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return <Card className={cn(dashboardStatCardClass, className)} {...props} />;
}

export function DashboardNestedCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return <Card className={cn(dashboardNestedCardClass, className)} {...props} />;
}

export function DashboardCardHeader({
  className,
  ...props
}: React.ComponentProps<typeof CardHeader>) {
  return (
    <CardHeader className={cn(dashboardCardHeaderClass, className)} {...props} />
  );
}

export function DashboardCardTitle({
  className,
  ...props
}: React.ComponentProps<typeof CardTitle>) {
  return (
    <CardTitle className={cn(dashboardCardTitleClass, className)} {...props} />
  );
}

export function DashboardCardDescription({
  className,
  ...props
}: React.ComponentProps<typeof CardDescription>) {
  return (
    <CardDescription
      className={cn(dashboardCardDescriptionClass, className)}
      {...props}
    />
  );
}

export {
  CardContent as DashboardCardContent,
  CardFooter as DashboardCardFooter,
};
