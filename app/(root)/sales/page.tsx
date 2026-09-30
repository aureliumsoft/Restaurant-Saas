import { redirect } from 'next/navigation';

/** Sales moved into Reports → Sales. */
export default function SalesPageRedirect() {
  redirect('/reports?type=sales');
}
