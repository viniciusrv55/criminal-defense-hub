import type { Client, Contract } from '@/types/contracts';
import { formatBRL } from '@/components/admin/CurrencyInput';

/**
 * Variáveis disponíveis para inserir nos modelos de documento.
 * O usuário seleciona pelo label; o token [VAR] é inserido no editor.
 * Ao gerar o .docx, substituímos cada [VAR] pelo valor real.
 */
export interface DocVariable {
  token: string; // ex: [NOMECLIENTE]
  label: string; // ex: Nome / Razão Social
  group: 'Cliente' | 'Endereço' | 'Contrato' | 'Processo' | 'Honorários' | 'Outros';
  resolve: (ctx: { client?: Client | null; contract?: Contract | null }) => string;
}

const fmt = (v: unknown) => (v == null || v === '' ? '____' : String(v));
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '____');

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
  // Outros
  { token: '[DATAHOJE]', label: 'Data de hoje', group: 'Outros', resolve: () => new Date().toLocaleDateString('pt-BR') },
  { token: '[CIDADEHOJE]', label: 'Cidade (do cliente) + data', group: 'Outros',
    resolve: ({ client }) => `${client?.city ?? '____'}, ${new Date().toLocaleDateString('pt-BR')}` },
];

/** Substitui todos os tokens [VAR] em um HTML pelos valores resolvidos. */
export function applyVariables(html: string, ctx: { client?: Client | null; contract?: Contract | null }): string {
  let out = html;
  for (const v of DOC_VARIABLES) {
    out = out.replaceAll(v.token, v.resolve(ctx));
  }
  return out;
}
