import { supabase } from '@/integrations/supabase/client';

interface LogErrorInput {
  action: string;          // ex: 'save', 'update', 'delete', 'load'
  screen?: string;         // ex: 'DocumentTemplateForm'
  table?: string;          // ex: 'document_templates'
  error: unknown;
  payload?: Record<string, unknown>;
}

function extractMessage(error: unknown): { message: string; code?: string; details?: string } {
  if (!error) return { message: 'unknown' };
  if (typeof error === 'string') return { message: error };
  const e = error as { message?: string; code?: string; details?: string; hint?: string; stack?: string };
  return {
    message: e.message ?? JSON.stringify(error).slice(0, 500),
    code: e.code,
    details: e.details ?? e.hint ?? e.stack?.split('\n').slice(0, 5).join('\n'),
  };
}

// Erros transitórios/ruído que NÃO devem ir para o painel de Logs de Erros.
// Falhas de rede (offline, CDN, cancelamento) e aborts não são bugs do sistema.
function isTransientError(msg: string, code?: string): boolean {
  const m = (msg || '').toLowerCase();
  if (m.includes('failed to fetch')) return true;
  if (m.includes('networkerror')) return true;
  if (m.includes('load failed')) return true;
  if (m.includes('aborted') || m.includes('aborterror')) return true;
  if (m.includes('the user aborted')) return true;
  if (code === '20' /* DOMException AbortError */) return true;
  return false;
}

export async function logError({ action, screen, table, error, payload }: LogErrorInput) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    const { message, code, details } = extractMessage(error);
    if (isTransientError(message, code)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('error_logs').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      user_name: (user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? null,
      route: typeof window !== 'undefined' ? window.location.pathname + window.location.search : null,
      screen: screen ?? null,
      action,
      table_name: table ?? null,
      error_code: code ?? null,
      error_message: message,
      error_details: details ?? null,
      payload: payload ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch {
    // never throw from logger
  }
}

/** Install global handlers (window.onerror + unhandledrejection). */
export function installGlobalErrorLogger() {
  if (typeof window === 'undefined') return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).__lvErrorLoggerInstalled) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__lvErrorLoggerInstalled = true;

  window.addEventListener('error', (event) => {
    logError({
      action: 'window.error',
      screen: 'global',
      error: event.error ?? event.message,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError({
      action: 'unhandledrejection',
      screen: 'global',
      error: event.reason,
    });
  });
}
