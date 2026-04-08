import type { DemoVisitor } from '@/components/Auth/DemoLeadGate';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export async function submitDemoLead(visitor: DemoVisitor): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[DemoLeads] Supabase not configured, skipping lead capture');
    return;
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/demo_leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      first_name: visitor.firstName,
      last_name: visitor.lastName,
      company: visitor.company,
      email: visitor.email,
      source: 'website_demo',
      created_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown error');
    console.error('[DemoLeads] Insert failed:', text);
    throw new Error('Failed to submit lead');
  }
}
