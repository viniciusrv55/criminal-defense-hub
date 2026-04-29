export function buildWhatsappLink(number?: string | null, message?: string | null) {
  const num = (number || '5500000000000').replace(/\D/g, '');
  const msg = encodeURIComponent(message || 'Olá, gostaria de solicitar um atendimento jurídico.');
  return `https://wa.me/${num}?text=${msg}`;
}
