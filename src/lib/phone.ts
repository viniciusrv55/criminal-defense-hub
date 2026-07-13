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
//   "556492843221"        → "5564992843221"   (adiciona 9º dígito de celular)
export function normalizeBrazilianPhone(phone: unknown): string {
  if (phone === null || phone === undefined) return '';
  // 1) remove tudo que não é dígito
  let d = String(phone).replace(/\D/g, '');
  if (!d) return '';
  // 2) se tem 11 dígitos (DDD + celular 9) ou 10 (DDD + fixo), adiciona 55
  if (d.length === 10 || d.length === 11) {
    d = '55' + d;
  }
  // 3) equivalência do 9º dígito de celular (padrão Brasil desde 2016):
  //    WhatsApp/Evolution às vezes entrega o número sem o "9" adicional.
  //    Se vier 55 + DDD (2) + 8 dígitos (total 12) e o 1º dos 8 dígitos for 6-9
  //    (faixa de celular), insere "9" após o DDD → 13 dígitos canônicos.
  if (d.length === 12 && d.startsWith('55')) {
    const firstSubscriberDigit = d.charAt(4);
    if (firstSubscriberDigit >= '6' && firstSubscriberDigit <= '9') {
      d = d.slice(0, 4) + '9' + d.slice(4);
    }
  }
  return d;
}

// Compara dois telefones brasileiros já considerando normalização.
// Também aceita a equivalência com/sem 9º dígito por segurança
// (se um lado tiver ficado no formato antigo por algum motivo).
export function samePhone(a: unknown, b: unknown): boolean {
  const na = normalizeBrazilianPhone(a);
  const nb = normalizeBrazilianPhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // fallback: comparar últimos 10 dígitos (DDD + 8) — cobre casos residuais
  const tailA = na.slice(-10);
  const tailB = nb.slice(-10);
  return tailA.length === 10 && tailA === tailB;
}
