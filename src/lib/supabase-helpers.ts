import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/lib/error-logger';

// Ações que queremos rastrear (mutações + leitura sob demanda)
const TRACKED_ACTIONS = new Set(['insert', 'update', 'delete', 'upsert', 'select', 'rpc']);

// Envolve uma cadeia de queries do supabase (thenable) para registrar erros no
// menu "Logs de Erros" automaticamente, indicando tabela + ação + rota.
function wrapThenable<T extends { then?: unknown }>(
  builder: T,
  meta: { table: string; action: string },
): T {
  if (!builder || typeof (builder as { then?: unknown }).then !== 'function') return builder;
  const originalThen = (builder as unknown as PromiseLike<unknown>).then.bind(builder);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (builder as any).then = (onFulfilled?: any, onRejected?: any) =>
    originalThen(
      (res: unknown) => {
        const err = (res as { error?: unknown } | null)?.error;
        if (err) {
          logError({
            action: meta.action,
            screen: typeof window !== 'undefined'
              ? window.location.pathname.split('/').filter(Boolean).slice(-2).join('/') || 'root'
              : undefined,
            table: meta.table,
            error: err,
          });
        }
        return onFulfilled ? onFulfilled(res) : res;
      },
      (err: unknown) => {
        logError({ action: meta.action, table: meta.table, error: err });
        if (onRejected) return onRejected(err);
        throw err;
      },
    );
  return builder;
}

// Proxy que embrulha automaticamente insert/update/delete/upsert/select
function wrapQueryBuilder(qb: unknown, table: string): unknown {
  return new Proxy(qb as object, {
    get(target, prop, receiver) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = Reflect.get(target as any, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = value.apply(target, args as any);
        const action = typeof prop === 'string' ? prop : '';
        if (TRACKED_ACTIONS.has(action)) {
          return wrapThenable(result as object, { table, action });
        }
        // Encadeamentos (.eq, .select, .order, .limit, .single...) continuam envolvidos
        if (result && typeof result === 'object' && 'then' in (result as object)) {
          // O then final também vai capturar erros do PostgREST
          return wrapQueryBuilder(result, table);
        }
        return result;
      };
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseClient = supabase as any;

export const db = new Proxy(baseClient, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (table: string) => wrapQueryBuilder(target.from(table), table);
    }
    if (prop === 'rpc') {
      return (fn: string, args?: unknown) => {
        const res = target.rpc(fn, args);
        return wrapThenable(res, { table: `rpc:${fn}`, action: 'rpc' });
      };
    }
    return Reflect.get(target, prop, receiver);
  },
}) as typeof baseClient;
