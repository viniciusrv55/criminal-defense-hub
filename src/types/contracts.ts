export interface ContactItem { label: string; value: string; }

export interface Client {
  id: string;
  person_type: 'pf' | 'pj';
  full_name: string;
  social_name: string | null;
  nationality: string | null;
  profession: string | null;
  education: string | null;
  marital_status: string | null;
  birth_date: string | null;
  cpf: string | null;
  rg: string | null;
  pis: string | null;
  cnpj: string | null;
  trade_name: string | null;
  state_registration: string | null;
  emails: ContactItem[];
  phones: ContactItem[];
  cep: string | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  father_name: string | null;
  mother_name: string | null;
  notes: string | null;
  group_name: string | null;
  group_id: string | null;
  profile_type: string | null;
  lead_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessData {
  cnj_number?: string;
  process_number?: string;
  party_type?: string; // Autor, Réu, Terceiro Interessado, etc.
  phase?: string;
  responsible?: string;
  locator?: string;
  partner?: string;
  prognosis?: string;
  contract_date?: string;
  closure_date?: string;
  distribution_date?: string;
  judgment_date?: string;
  sentence_date?: string;
  execution_date?: string;
  cause_value?: string;
  other_value?: string;
  request?: string;
  notes?: string;
  secrecy?: boolean;
  capture_updates?: boolean;
  // Auto-preenchidos via DataJud
  court?: string;
  court_unit?: string;
  class_name?: string;
  subjects?: string[];
}

export interface AdverseParty {
  person_type?: 'pf' | 'pj';
  name?: string;
  cpf?: string;
  cnpj?: string;
  rg?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
}

export interface CustomInstallment { value: string; due_date?: string }

export interface FeesData {
  /** Valor total dos honorários */
  total_value?: string;
  /** Honorários (entrada) */
  entry?: string;
  entry_due_date?: string;
  /** Parcelas: "1" para à vista ou "2".."60" */
  installments?: string;
  payment_method?: string;
  /** Parcelas personalizadas (ex: 7x R$500 + saldo R$450 gera 8ª) */
  custom_installments?: CustomInstallment[];
  /** Honorários sucumbenciais e contratuais (mantidos como observação) */
  contractual_fees?: string;
  succumbence_fees?: string;
  notes?: string;
}

export interface Contract {
  id: string;
  client_id: string;
  contract_number: string | null;
  practice_area_id: string | null;
  attorney_id: string | null;
  status: 'draft' | 'active' | 'concluded' | 'cancelled';
  process_type: 'judicial' | 'administrative';
  group_id: string | null;
  comarca_id: string | null;
  vara_id: string | null;
  party_type: string | null;
  process_data: ProcessData;
  additional_data: Record<string, unknown>;
  adverse_party: AdverseParty;
  fees: FeesData;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  archived_by?: string | null;
  process_completed?: boolean;
}

export interface ContractDocument {
  id: string;
  contract_id: string;
  document_type: string;
  template_name: string | null;
  copies: number;
  file_url: string | null;
  file_name: string | null;
  generated_html: string | null;
  generated_by: string | null;
  created_at: string;
}

export interface ClientPortalAccess {
  id: string;
  client_id: string;
  user_id: string;
  username: string | null;
  nickname: string | null;
  birthday_day: number | null;
  birthday_month: number | null;
  active: boolean;
}
