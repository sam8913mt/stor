import { supabase } from './supabase';

/** Calls a Supabase Edge Function and surfaces its `{ error: CODE }` payload as an Error whose message is the CODE. */
export async function invokeFn<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    let code = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) code = String(j.error); } catch { /* not JSON */ }
    throw new Error(code);
  }
  return data as T;
}

/** Redirects the browser to the provider's hosted payment page for an existing unpaid order. */
export async function startPayment(orderId: string): Promise<void> {
  const { url } = await invokeFn<{ url: string }>('create-payment', { order_id: orderId });
  if (!/^https:\/\//.test(url)) throw new Error('PROVIDER_ERROR');
  window.location.assign(url);
}

/** Best-effort: drain queued notification emails right after an order event. Failures are harmless (cron retries). */
export function kickEmailQueue(): void {
  void invokeFn('process-email-queue', {}).catch(() => { /* email not configured or disabled */ });
}
