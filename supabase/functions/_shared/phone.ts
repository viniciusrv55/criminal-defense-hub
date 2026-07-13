// Normalização canônica de telefones brasileiros.
// Regra única e reutilizável em todo o backend (edge functions).
// Formato canônico: 55 + DDD (2) + número (8 ou 9) → 12 ou 13 dígitos.
//
// Exemplos:
//   "(64) 99284-3221"     → "5564992843221"
//   "64 99284 3221"       → "5564992843221"
//   "64992843221"         → "5564992843221"
//   "+55 (64) 99284-3221" → "5564992843221"
//   "5564992843221"       → "5564992843221"
export function normalizeBrazilianPhone(phone: unknown): string {
  if (phone === null || phone === undefined) return '';
  // 1) remove tudo que não é dígito (espaços, "(", ")", "-", "+", etc.)
  let d = String(phone).replace(/\D/g, '');
  if (!d) return '';
  // 2) se tem 11 dígitos (DDD + celular 9) ou 10 (DDD + fixo), adiciona 55
  if (d.length === 10 || d.length === 11) {
    d = '55' + d;
  }
  return d;
}

// Compara dois telefones brasileiros já considerando normalização.
export function samePhone(a: unknown, b: unknown): boolean {
  const na = normalizeBrazilianPhone(a);
  const nb = normalizeBrazilianPhone(b);
  if (!na || !nb) return false;
  return na === nb;
}
