Resumo: refatorar o bloco de identidade que o Edge Function `ai-agent-reply` injeta no system prompt da OpenAI, transformando-o de texto livre em JSON estruturado, com instruções rígidas de uso.

Escopo:
- Alterar APENAS a formatação do contexto de identificação no system prompt.
- Manter a arquitetura atual: Edge Function, tools, banco de dados, webhook, roteamento e contratos permanecem inalterados.
- Não criar novas colunas, tabelas, funções, triggers ou APIs.

Arquivos que serão modificados:
1. `supabase/functions/ai-agent-reply/index.ts`
   - Substituir o bloco `identityBlock` textual pelo novo bloco JSON.
   - Incluir cálculo de `document_type` (CPF/CNPJ) e `attorney: { exists, name }`.
   - Incluir `contact_name` e `contact_phone` apenas como informações auxiliares.
   - Adicionar estado `document_confirmed: false` no contexto inicial; a tool `confirm_client_document` já atualiza a conversa, mas ainda não re-executa a pré-identificação em follow-ups. Para este ajuste, manteremos `document_confirmed: false` sempre que o contexto for montado antes da confirmação (o que é o caso atual). A confirmação real ocorre pela tool e a conversa é pausada, então o contexto de follow-up não é necessário.

2. `src/pages/admin/AiAgents.tsx`
   - Atualizar o `DEFAULT_PROMPT` para remover referências ao formato antigo de texto e instruir que o agente deve usar o bloco JSON como única fonte de verdade.

Campos que farão parte do bloco JSON:

```json
{
  "client_found": true,
  "client_name": "João da Silva",
  "document_hint": "123.***.***-**",
  "document_type": "CPF",
  "document_confirmed": false,
  "attorney": {
    "exists": true,
    "name": "Felipe Moraes"
  },
  "contact_name": "João",
  "contact_phone": "5564999999999"
}
```

Quando cliente não for encontrado:

```json
{
  "client_found": false,
  "client_name": null,
  "document_hint": null,
  "document_type": null,
  "document_confirmed": false,
  "attorney": {
    "exists": false,
    "name": null
  },
  "contact_name": "João",
  "contact_phone": "5564999999999"
}
```

Instruções que serão adicionadas ao system prompt:

```text
########################################
## CONTEXTO DO SISTEMA (NÃO ALTERAR)
########################################

As informações abaixo foram obtidas diretamente pelo backend.
Elas são a única fonte de verdade para identificação do cliente.
Nunca tente deduzir informações diferentes.
Nunca consulte novamente o telefone.
Nunca utilize lookup_client_by_phone novamente.
Nunca utilize o nome do contato do WhatsApp para identificar o cliente.
Nunca invente clientes ou advogados.

{json}

########################################
```

Riscos:
- Baixo. Apenas formatação do prompt.
- A API continua recebendo uma string; o JSON fica dentro do system prompt, mantendo compatibilidade total.

Impacto esperado:
- A IA passa a ver campos estruturados, reduzindo ambiguidade sobre identidade, advogado e etapa do fluxo.

Plano de rollback:
- Reverter os dois arquivos para a versão anterior e, se necessário, reimplantar a Edge Function.

Arquivos que NÃO serão modificados:
- Qualquer arquivo de banco de dados, migrations, RLS, triggers, webhooks, Evolution API, contratos de API ou outras Edge Functions.

Aprovação necessária antes da implementação.