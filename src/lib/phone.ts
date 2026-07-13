// Normalização canônica de telefones brasileiros (frontend).
// Mantém a MESMA regra usada em supabase/functions/_shared/phone.ts.
// Formato canônico: 55 + DDD (2) + número (8 ou 9) → 12 ou 13 dígitos.
export function normalizeBrazilianPhone(phone: unknown): string {
  if (phone === null || phone === undefined) return '';
  let d = String(phone).replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10 || d.length === 11) {
    d = '55' + d;
  }
  return d;
}

export function samePhone(a: unknown, b: unknown): boolean {
  const na = normalizeBrazilianPhone(a);
  const nb = normalizeBrazilianPhone(b);
  if (!na || !nb) return false;
  return na === nb;
}
