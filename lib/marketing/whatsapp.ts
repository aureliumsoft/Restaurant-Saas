/** Spain sales WhatsApp (digits only for wa.me). */
export const MARKETING_WHATSAPP_NUMBER = '34634603929';

export function marketingWhatsAppUrl(prefillMessage?: string): string {
  const base = `https://wa.me/${MARKETING_WHATSAPP_NUMBER}`;
  const text = prefillMessage?.trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}
