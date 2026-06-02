import type { Client, Contract } from '@/types/contracts';
import { formatBRL } from '@/components/admin/CurrencyInput';

/**
 * Variáveis disponíveis para inserir nos modelos de documento.
 * O usuário seleciona pelo label; o token [VAR] é inserido no editor.
 * Ao gerar o .docx, substituímos cada [VAR] pelo valor real.
 */
export interface ReceiptContext {
  installment_label?: string; // "Entrada", "1ª parcela", etc
  amount?: number;
  paid_at?: string; // ISO
  payment_method?: string;
  sender_name?: string;
  receipt_date?: string; // ISO; default = hoje
}

export interface DocVariableContext {
  client?: Client | null;
  contract?: Contract | null;
  receipt?: ReceiptContext | null;
}

export interface DocVariable {
  token: string;
  label: string;
  group: 'Cliente' | 'Endereço' | 'Contrato' | 'Processo' | 'Honorários' | 'Recibo' | 'Outros';
  resolve: (ctx: DocVariableContext) => string;
}

const fmt = (v: unknown) => (v == null || v === '' ? '____' : String(v));
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '____');

// Valor por extenso simples para reais (pt-BR)
function numberToWordsBRL(n: number): string {
  if (!isFinite(n)) return '';
  const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const teens = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const sub1000 = (num: number): string => {
    if (num === 0) return '';
    if (num === 100) return 'cem';
    const h = Math.floor(num / 100);
    const r = num % 100;
    const parts: string[] = [];
    if (h) parts.push(hundreds[h]);
    if (r) {
      if (r < 10) parts.push(units[r]);
      else if (r < 20) parts.push(teens[r - 10]);
      else {
        const t = Math.floor(r / 10), u = r % 10;
        parts.push(tens[t] + (u ? ' e ' + units[u] : ''));
      }
    }
    return parts.join(' e ');
  };
  const intPart = Math.floor(n);
  const cents = Math.round((n - intPart) * 100);
  const groups: string[] = [];
  let rest = intPart;
  const scale = ['', 'mil', 'milhões', 'bilhões'];
  const scaleSing = ['', 'mil', 'milhão', 'bilhão'];
  let i = 0;
  if (rest === 0) groups.push('zero');
  while (rest > 0) {
    const g = rest % 1000;
    if (g > 0) {
      const w = sub1000(g);
      const s = g === 1 ? scaleSing[i] : scale[i];
      groups.unshift(w + (s ? ' ' + s : ''));
    }
    rest = Math.floor(rest / 1000);
    i++;
  }
  let result = groups.join(', ');
  result += intPart === 1 ? ' real' : ' reais';
  if (cents > 0) {
    const c = sub1000(cents);
    result += ' e ' + c + (cents === 1 ? ' centavo' : ' centavos');
  }
  return result;
}

export const DOC_VARIABLES: DocVariable[] = [
  // Cliente
  { token: '[NOMECLIENTE]', label: 'Nome / Razão Social', group: 'Cliente', resolve: ({ client }) => fmt(client?.full_name) },
  { token: '[CPFCLIENTE]', label: 'CPF', group: 'Cliente', resolve: ({ client }) => fmt(client?.cpf) },
  { token: '[CNPJCLIENTE]', label: 'CNPJ', group: 'Cliente', resolve: ({ client }) => fmt(client?.cnpj) },
  { token: '[RGCLIENTE]', label: 'RG', group: 'Cliente', resolve: ({ client }) => fmt(client?.rg) },
  { token: '[NACIONALIDADE]', label: 'Nacionalidade', group: 'Cliente', resolve: ({ client }) => fmt(client?.nationality) },
  { token: '[PROFISSAO]', label: 'Profissão', group: 'Cliente', resolve: ({ client }) => fmt(client?.profession) },
  { token: '[ESTADOCIVIL]', label: 'Estado Civil', group: 'Cliente', resolve: ({ client }) => fmt(client?.marital_status) },
  { token: '[NASCIMENTO]', label: 'Nascimento', group: 'Cliente', resolve: ({ client }) => fmtDate(client?.birth_date) },
  { token: '[EMAILCLIENTE]', label: 'E-mail', group: 'Cliente', resolve: ({ client }) => fmt(client?.emails?.[0]?.value) },
  { token: '[TELEFONECLIENTE]', label: 'Telefone', group: 'Cliente', resolve: ({ client }) => fmt(client?.phones?.[0]?.value) },
  { token: '[PERFIL]', label: 'Perfil', group: 'Cliente', resolve: ({ client }) => fmt(client?.profile_type) },
  // Endereço
  { token: '[CEP]', label: 'CEP', group: 'Endereço', resolve: ({ client }) => fmt(client?.cep) },
  { token: '[ENDERECO]', label: 'Logradouro', group: 'Endereço', resolve: ({ client }) => fmt(client?.address) },
  { token: '[BAIRRO]', label: 'Bairro', group: 'Endereço', resolve: ({ client }) => fmt(client?.neighborhood) },
  { token: '[CIDADE]', label: 'Cidade', group: 'Endereço', resolve: ({ client }) => fmt(client?.city) },
  { token: '[ESTADO]', label: 'UF', group: 'Endereço', resolve: ({ client }) => fmt(client?.state) },
  { token: '[ENDERECOCOMPLETO]', label: 'Endereço completo', group: 'Endereço',
    resolve: ({ client }) => [client?.address, client?.neighborhood, client?.city, client?.state].filter(Boolean).join(', ') || '____' },
  // Processo
  { token: '[NUMEROCNJ]', label: 'Número CNJ', group: 'Processo', resolve: ({ contract }) => fmt(contract?.process_data?.cnj_number) },
  { token: '[NUMEROINTERNO]', label: 'Número interno', group: 'Processo', resolve: ({ contract }) => fmt(contract?.process_data?.process_number) },
  { token: '[TIPOPARTE]', label: 'Tipo de parte', group: 'Processo', resolve: ({ contract }) => fmt(contract?.party_type) },
  { token: '[CLASSEPROCESSO]', label: 'Classe processual', group: 'Processo', resolve: ({ contract }) => fmt(contract?.process_data?.class_name) },
  { token: '[ORGAOJULGADOR]', label: 'Órgão julgador', group: 'Processo', resolve: ({ contract }) => fmt(contract?.process_data?.court_unit) },
  { token: '[VALORCAUSA]', label: 'Valor da causa', group: 'Processo',
    resolve: ({ contract }) => formatBRL(parseFloat(contract?.process_data?.cause_value ?? '0')) || '____' },
  // Honorários
  { token: '[HONORARIOSENTRADA]', label: 'Entrada', group: 'Honorários',
    resolve: ({ contract }) => formatBRL(parseFloat(contract?.fees?.entry ?? '0')) || '____' },
  { token: '[HONORARIOSPARCELAS]', label: 'Parcelas', group: 'Honorários', resolve: ({ contract }) => fmt(contract?.fees?.installments) },
  { token: '[FORMAPAGAMENTO]', label: 'Forma de pagamento', group: 'Honorários', resolve: ({ contract }) => fmt(contract?.fees?.payment_method) },
  { token: '[HONORARIOSTOTAL]', label: 'Total dos honorários', group: 'Honorários', resolve: ({ contract }) => {
    const f = contract?.fees ?? {};
    const entry = parseFloat(f.entry ?? '') || 0;
    const customs = (f.custom_installments ?? []).reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
    return formatBRL(entry + customs);
  } },
  { token: '[PARCELASLISTA]', label: 'Lista de parcelas (texto)', group: 'Honorários', resolve: ({ contract }) => {
    const customs = contract?.fees?.custom_installments ?? [];
    if (!customs.length) return '____';
    return customs.map((p, i) => `${i + 1}ª: ${formatBRL(parseFloat(p.value) || 0)}${p.due_date ? ' (venc. ' + new Date(p.due_date).toLocaleDateString('pt-BR') + ')' : ''}`).join('; ');
  } },
  // Recibo
  { token: '[PARCELAREFERENCIA]', label: 'Parcela (referência)', group: 'Recibo', resolve: ({ receipt }) => fmt(receipt?.installment_label) },
  { token: '[PARCELAVALOR]', label: 'Valor da parcela (cheia)', group: 'Recibo', resolve: ({ receipt }) => formatBRL(receipt?.amount ?? 0) },
  { token: '[PARCELAVALORPAGO]', label: 'Valor pago (recibo)', group: 'Recibo', resolve: ({ receipt }) => formatBRL(receipt?.amount ?? 0) },
  { token: '[PARCELAVALOREXTENSO]', label: 'Valor por extenso', group: 'Recibo', resolve: ({ receipt }) => receipt?.amount != null ? numberToWordsBRL(receipt.amount) : '____' },
  { token: '[PARCELAVALORPAGOEXTENSO]', label: 'Valor pago por extenso', group: 'Recibo', resolve: ({ receipt }) => receipt?.amount != null ? numberToWordsBRL(receipt.amount) : '____' },
  { token: '[PARCELADATAPAGAMENTO]', label: 'Data do pagamento', group: 'Recibo', resolve: ({ receipt }) => fmtDate(receipt?.paid_at) },
  { token: '[PARCELAFORMAPAGAMENTO]', label: 'Forma de pagamento da parcela', group: 'Recibo', resolve: ({ receipt }) => fmt(receipt?.payment_method) },
  { token: '[RECIBODATA]', label: 'Data de emissão do recibo', group: 'Recibo', resolve: ({ receipt }) => fmtDate(receipt?.receipt_date ?? new Date().toISOString()) },
  { token: '[RECIBOEMISSOR]', label: 'Emissor do recibo', group: 'Recibo', resolve: ({ receipt }) => fmt(receipt?.sender_name) },
  // Outros
  { token: '[DATAHOJE]', label: 'Data de hoje', group: 'Outros', resolve: () => new Date().toLocaleDateString('pt-BR') },
  { token: '[CIDADEHOJE]', label: 'Cidade (do cliente) + data', group: 'Outros',
    resolve: ({ client }) => `${client?.city ?? '____'}, ${new Date().toLocaleDateString('pt-BR')}` },
];

/** Substitui todos os tokens [VAR] em um HTML pelos valores resolvidos. */
export function applyVariables(html: string, ctx: DocVariableContext): string {
  let out = html;
  for (const v of DOC_VARIABLES) {
    out = out.split(v.token).join(v.resolve(ctx));
  }
  return out;
}
