// Simple local gateway for plans checkout & session verification
// No external dependencies (uses Node built-ins)

import http from 'node:http';
import https from 'node:https';

const sessions = new Map();

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function badRequest(res, message) {
  json(res, { error: message }, 400);
}

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (req.method === 'POST' && url.pathname === '/checkout') {
    let body;
    try { body = await parseJson(req); } catch { return badRequest(res, 'invalid json'); }
    const { plan, billing, user_id, success_url, cancel_url } = body || {};
    if (!plan || !billing || !success_url) return badRequest(res, 'missing fields: plan, billing, success_url');
    const session_id = Math.random().toString(36).slice(2);
    sessions.set(session_id, { plan, billing, user_id, paid: true });
    const checkout_url = `${success_url}${success_url.includes('?') ? '&' : '?'}session_id=${session_id}`;
    return json(res, { checkout_url });
  }

  if (req.method === 'POST' && url.pathname === '/bubble-checkout') {
    let body;
    try { body = await parseJson(req); } catch { return badRequest(res, 'invalid json'); }
    const { plan, billing, user_id, success_url, cancel_url } = body || {};
    if (!plan || !billing || !success_url) return badRequest(res, 'missing fields: plan, billing, success_url');

    // Helpers para valores
    const toCents = (valueStr) => {
      if (typeof valueStr !== 'string') return 0;
      const normalized = valueStr.replace(/\./g, '').replace(',', '.');
      const num = Number(normalized);
      if (!isFinite(num)) return 0;
      return Math.round(num * 100);
    };
    const getAmountCents = (planKey, billingCycle) => {
      if (planKey === 'teste' || planKey === 'qa') return 100;
      const prices = {
        start: { mensal: '99,00', anual: '79,00' },
        pro: { mensal: '299,00', anual: '249,00' },
        premium: { mensal: '599,00', anual: '499,00' },
      };
      const p = prices[planKey];
      if (!p) return 0;
      const perMonthCents = toCents(billingCycle === 'anual' ? p.anual : p.mensal);
      const multiplier = billingCycle === 'anual' ? 12 : 1;
      return perMonthCents * multiplier;
    };
    const pad2 = (n) => String(n).padStart(2, '0');
    const formatValidUntil = (date) => {
      const y = date.getFullYear();
      const m = pad2(date.getMonth() + 1);
      const d = pad2(date.getDate());
      const hh = pad2(date.getHours());
      const mm = pad2(date.getMinutes());
      return `${y}-${m}-${d} ${hh}:${mm}`;
    };

    const amountCents = getAmountCents(plan, billing);
    const toBRLStringFromCents = (cents) => {
      try {
        const v = Number(cents || 0) / 100;
        return v.toFixed(2).replace('.', ',');
      } catch (_) { return '0,00'; }
    };
    const validUntil = new Date(Date.now() + 15 * 60 * 1000);
    const title = `${plan} (${billing})`;
    const params = new URLSearchParams({
      preço: toBRLStringFromCents(amountCents),
      título: title,
      assinatura: plan,
      valid_until: formatValidUntil(validUntil),
      min_installment: '1',
      max_installment: '12',
      max_sales: '1',
      show_form_add: '0',
      customer_intere: '0',
      plan_id: String(plan),
      billing: String(billing),
      user_id: String(user_id || ''),
      success_url: success_url,
      cancel_url: cancel_url || '',
    });

    const base = process.env.BUBBLE_WORKFLOW_BASE_URL || 'https://konect-64671.bubbleapps.io/version-test/api/1.1/wf';
    const endpoint = process.env.BUBBLE_PLANOS_ENDPOINT || 'planos_connekt';
    const bubbleUrl = `${base.replace(/\/$/, '')}/${endpoint}?${params.toString()}`;

    try {
      const resp = await fetch(bubbleUrl, { method: 'POST' });
      if (!resp.ok) return json(res, { error: `bubble_http_${resp.status}` }, resp.status);
      let data = null;
      try { data = await resp.json(); } catch (_) {}
      const body = (data && typeof data === 'object' && data.body) ? data.body : data;
      const checkoutUrl = body?.checkout_url || body?.url || body?.payment_url || body?.href || null;
      if (!checkoutUrl) return json(res, { error: 'checkout_url_missing', raw: data }, 502);
      return json(res, { checkout_url: checkoutUrl });
    } catch (e) {
      return json(res, { error: e?.message || 'bubble_fetch_error' }, 500);
    }
  }

  if (req.method === 'POST' && url.pathname === '/sessions/verify') {
    let body;
    try { body = await parseJson(req); } catch { return badRequest(res, 'invalid json'); }
    const { session_id, user_id } = body || {};
    if (!session_id) return badRequest(res, 'missing field: session_id');
    const s = sessions.get(session_id);
    const valid = !!s && s.paid === true && (user_id ? s.user_id === user_id : true);
    return json(res, { valid });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Plans gateway dev server running on http://localhost:${PORT}`);
});
