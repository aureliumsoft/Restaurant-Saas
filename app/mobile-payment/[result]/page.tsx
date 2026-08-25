type PageProps = { params: Promise<{ result: string }> };

/** Landing page after JazzCash hosted checkout redirects back to the origin. */
export default async function MobilePaymentResultPage({ params }: PageProps) {
  const { result } = await params;
  const cancelled = result === 'cancel' || result === 'cancelled';
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <p>
        {cancelled
          ? 'Payment cancelled. You can return to the app.'
          : 'Payment complete. Return to the app.'}
      </p>
    </main>
  );
}
