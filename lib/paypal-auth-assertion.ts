/**
 * Builds the PayPal-Auth-Assertion header for multiparty (third-party) API calls.
 * @see https://developer.paypal.com/docs/multiparty/checkout/immediate-capture/
 */
export function buildPayPalAuthAssertion(
  platformClientId: string,
  sellerMerchantId: string
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' }), 'utf8').toString(
    'base64url'
  );
  const payload = Buffer.from(
    JSON.stringify({
      iss: platformClientId,
      payer_id: sellerMerchantId,
    }),
    'utf8'
  ).toString('base64url');
  return `${header}.${payload}.`;
}
