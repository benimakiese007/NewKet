import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function normalizePriority(priority) {
  if (priority === 'P0' || priority === 'P1' || priority === 'P2') return priority;
  return 'P2';
}

function toSeverity(priority) {
  if (priority === 'P0') return 'critical';
  if (priority === 'P1') return 'medium';
  return 'low';
}

async function upsertIncident(incident) {
  const fingerprint = incident.fingerprint || sha256(`${incident.category}|${incident.title}|${incident.summary}`);

  const payload = {
    detected_at: new Date().toISOString(),
    priority: normalizePriority(incident.priority),
    severity: toSeverity(normalizePriority(incident.priority)),
    category: incident.category,
    title: incident.title,
    summary: incident.summary,
    evidence: incident.evidence || {},
    action_immediate: incident.action_immediate || null,
    action_robust: incident.action_robust || null,
    owner: incident.owner || null,
    status: 'open',
    fingerprint,
  };

  const { data, error } = await supabaseAdmin
    .from('system_health_incidents')
    .upsert(payload, { onConflict: 'fingerprint' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function detectPaymentOrderMismatches() {
  const { data, error } = await supabaseAdmin
    .from('v_system_payment_order_mismatches')
    .select('order_id,order_status,order_created_at,payment_id,payment_status,payment_created_at')
    .limit(50);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map((row) => ({
    priority: 'P0',
    category: 'payments',
    title: 'Paiement/commande incoherents',
    summary: `Paiement '${row.payment_status}' mais commande '${row.order_status}' (order_id=${row.order_id}).`,
    evidence: row,
    action_immediate: 'Verifier webhook + corriger statut commande/paiement.',
    action_robust: 'Idempotence + ledger + job de reconciliation.',
    owner: 'backend/db',
    fingerprint: sha256(`payments:mismatch:${row.order_id}:${row.payment_id}:${row.payment_status}:${row.order_status}`),
  }));
}

async function detectStuckOrders() {
  // Best-effort: orders pending older than 48h
  const sinceIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,status,created_at')
    .lt('created_at', sinceIso)
    .in('status', ['En attente', 'PENDING', 'pending', 'WAITING_PAYMENT', 'PROCESSING'])
    .limit(50);

  if (error) return []; // status values vary across migrations; do not hard-fail system check
  if (!data || data.length === 0) return [];

  return data.map((o) => ({
    priority: 'P1',
    category: 'orders',
    title: 'Commandes bloquees (48h+)',
    summary: `Commande en statut '${o.status}' depuis ${o.created_at} (order_id=${o.id}).`,
    evidence: o,
    action_immediate: 'Notifier vendeur + verifier workflow de paiement/livraison.',
    action_robust: 'Automatiser escalation + job de rattrapage.',
    owner: 'backend',
    fingerprint: sha256(`orders:stuck:${o.id}:${o.status}`),
  }));
}

export async function runSystemCheck(req, res, next) {
  try {
    const incidents = [];

    incidents.push(...(await detectPaymentOrderMismatches()));
    incidents.push(...(await detectStuckOrders()));

    const stored = [];
    for (const incident of incidents) {
      stored.push(await upsertIncident(incident));
    }

    res.json({
      ok: true,
      detected: incidents.length,
      stored: stored.length,
      incidents: stored,
    });
  } catch (error) {
    next(error);
  }
}

export async function listIncidents(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const { data, error } = await supabaseAdmin
      .from('system_health_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ ok: true, incidents: data || [] });
  } catch (error) {
    next(error);
  }
}

export async function ackIncident(req, res, next) {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('system_health_incidents')
      .update({ status: 'acknowledged' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, incident: data });
  } catch (error) {
    next(error);
  }
}

export async function resolveIncident(req, res, next) {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('system_health_incidents')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, incident: data });
  } catch (error) {
    next(error);
  }
}

