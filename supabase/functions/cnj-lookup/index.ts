const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Mapeia o segmento de tribunal do CNJ para o alias DataJud
function getTribunalAlias(cnj: string): string | null {
  const clean = cnj.replace(/\D/g, '');
  if (clean.length !== 20) return null;
  // Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
  const j = clean.charAt(13); // segmento
  const tr = clean.substring(14, 16); // tribunal
  const segMap: Record<string, string> = {
    '1': 'stf', '2': 'cnj', '3': 'stj', '4': 'jf', '5': 'trf', '6': 'tjm',
    '7': 'tjm', '8': 'tj', '9': 'tjm',
  };
  if (j === '8') return `api_publica_tjmt`.replace('tjmt', `tj${tr === '11' ? 'mt' : trToUF(tr)}`);
  if (j === '5') return `api_publica_trf${parseInt(tr)}`;
  if (j === '4') return `api_publica_trt${parseInt(tr)}`;
  return null;
}

const UF_BY_TR: Record<string, string> = {
  '01':'ac','02':'al','03':'ap','04':'am','05':'ba','06':'ce','07':'df','08':'es','09':'go','10':'ma',
  '11':'mt','12':'ms','13':'mg','14':'pa','15':'pb','16':'pr','17':'pe','18':'pi','19':'rj','20':'rn',
  '21':'rs','22':'ro','23':'rr','24':'sc','25':'sp','26':'se','27':'to'
};
function trToUF(tr: string): string { return UF_BY_TR[tr] ?? 'sp'; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { cnj } = await req.json();
    if (!cnj || typeof cnj !== 'string') {
      return new Response(JSON.stringify({ error: 'CNJ obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('CNJ_DATAJUD_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key DataJud não configurada' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const alias = getTribunalAlias(cnj);
    if (!alias) {
      return new Response(JSON.stringify({ error: 'Não foi possível identificar o tribunal a partir do CNJ' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cleanCnj = cnj.replace(/\D/g, '');
    const url = `https://api-publica.datajud.cnj.jus.br/${alias}/_search`;
    const body = { query: { match: { numeroProcesso: cleanCnj } } };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `APIKey ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ error: `DataJud ${resp.status}: ${txt.slice(0, 200)}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await resp.json();
    const hit = data?.hits?.hits?.[0]?._source;
    if (!hit) {
      return new Response(JSON.stringify({ error: 'Processo não encontrado no DataJud', tried: alias }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const result = {
      cnj_number: hit.numeroProcesso,
      court: hit.tribunal,
      court_unit: hit.orgaoJulgador?.nome,
      class_name: hit.classe?.nome,
      subjects: (hit.assuntos ?? []).map((a: { nome: string }) => a.nome),
      distribution_date: hit.dataAjuizamento,
      cause_value: hit.valorCausa,
      level: hit.grau,
      last_movement: hit.movimentos?.[hit.movimentos.length - 1]?.nome,
    };

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
