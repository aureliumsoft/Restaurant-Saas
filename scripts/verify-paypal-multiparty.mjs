/**
 * Quick sanity checks for PayPal multiparty auth assertion (no network).
 * Run: node scripts/verify-paypal-multiparty.mjs
 */
function buildPayPalAuthAssertion(platformClientId, sellerMerchantId) {
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

const assertion = buildPayPalAuthAssertion('PLATFORM_CLIENT_ID', 'SELLER_MERCHANT_ID');
const parts = assertion.split('.');
if (parts.length !== 3 || parts[2] !== '') {
  throw new Error('Auth assertion must be header.payload. format');
}
const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
if (payload.iss !== 'PLATFORM_CLIENT_ID' || payload.payer_id !== 'SELLER_MERCHANT_ID') {
  throw new Error('Auth assertion payload mismatch');
}

console.log('PayPal multiparty helper checks passed.');
