import { redirect } from 'next/navigation';

import { DEMO_RESTAURANT_SLUG } from '@/lib/demo-restaurant';

export default function WebAppIndexPage() {
  redirect(`/web-app/${DEMO_RESTAURANT_SLUG}`);
}
