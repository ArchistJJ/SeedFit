/**
 * SeedFit Lemon Squeezy Subscription Cancellation Endpoint (Cloudflare Pages Function)
 *
 * 기능:
 * 1. 앱 내 [구독 취소] 시 실제 Lemon Squeezy 정기결제를 즉시 해지(DELETE /v1/subscriptions/{id})
 * 2. Supabase seedfit_user_data의 subscription_tier='free', cancelled_at, data_retention_until, settings 동기화
 * 3. 마스터 관리자 전용 소급 해지 동기화(action: 'sync_cancelled_users') 지원
 */

const DEFAULT_SIGNING_SECRET = 'Wowns0428!';
const MASTER_ADMIN_USER_ID = 'google:113883361165667197261';
const SUPABASE_URL = 'https://qeuiqvisuscvkgjvqxpe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldWlxdmlzdXNjdmtnanZxeHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MDM5MDcsImV4cCI6MjEwNjM3OTkwN30.yj-hRe5zQ3eUV20hjDYhzZRfzc4WJYDxUkoNVfLlWIM';
const LEMON_API_BASE = 'https://api.lemonsqueezy.com/v1';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function supabaseHeaders(userId) {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'x-seedfit-user': userId,
    'Content-Type': 'application/json'
  };
}

function extractSubscriptionId(row) {
  const fromSettings = row?.settings?.lemonSubscriptionId;
  if (fromSettings) return String(fromSettings).trim();
  const cardUrl = row?.update_card_url || '';
  const match = String(cardUrl).match(/\/subscription\/(\d+)\//);
  return match ? match[1] : null;
}

async function findActiveLemonSubscriptionByEmail(apiKey, email) {
  if (!apiKey || !email) return null;
  try {
    const res = await fetch(
      `${LEMON_API_BASE}/subscriptions?filter[user_email]=${encodeURIComponent(email.trim())}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/vnd.api+json'
        }
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const list = Array.isArray(json?.data) ? json.data : [];
    const activeStatuses = new Set(['active', 'on_trial', 'past_due', 'paused', 'unpaid']);
    const match = list.find(item => {
      const attrs = item?.attributes || {};
      return attrs.test_mode !== true && activeStatuses.has(attrs.status);
    });
    return match?.id ? String(match.id) : null;
  } catch (err) {
    console.warn('Lemon subscription email lookup error:', err);
    return null;
  }
}

async function cancelLemonSubscription(apiKey, subscriptionId) {
  try {
    const res = await fetch(
      `${LEMON_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        }
      }
    );
    const bodyText = await res.text();
    let parsed = null;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : null;
    } catch (_) {
      parsed = null;
    }

    if (res.ok) {
      return {
        cancelled: true,
        alreadyCancelled: false,
        status: parsed?.data?.attributes?.status || 'cancelled'
      };
    }
    if (res.status === 404) {
      return { cancelled: false, notFound: true, httpStatus: 404 };
    }
    if (res.status === 422) {
      const lower = (bodyText || '').toLowerCase();
      if (lower.includes('already') || lower.includes('cancelled') || lower.includes('expired')) {
        return { cancelled: true, alreadyCancelled: true };
      }
      return { cancelled: false, error: bodyText, httpStatus: 422 };
    }
    return { cancelled: false, error: bodyText, httpStatus: res.status };
  } catch (err) {
    return { cancelled: false, error: err.message || 'Network error', httpStatus: 500 };
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol === 'https:') {
      if (host === 'seedfit.pro' || host === 'www.seedfit.pro') return true;
      if (/^seedfit[a-z0-9-]*\.pages\.dev$/.test(host)) return true;
    }
    if (host === 'localhost' || host === '127.0.0.1') return true;
    return false;
  } catch (_) {
    return false;
  }
}

async function fetchSupabaseUserRow(userId) {
  const selectCols = 'user_id,name,email,subscription_tier,cancelled_at,data_retention_until,update_card_url,settings';
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/seedfit_user_data?user_id=eq.${encodeURIComponent(userId)}&select=${selectCols}`,
    { headers: supabaseHeaders(userId) }
  );
  if (!res.ok) return { ok: false, status: res.status };
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return { ok: true, row: null };
  return { ok: true, row: rows[0] };
}

async function patchSupabaseUserRow(userId, patchData) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/seedfit_user_data?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(userId),
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(patchData)
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: errText };
  }
  return { ok: true };
}

async function handleSyncCancelledUsers(request, env, payload) {
  const expectedSecret = (env && env.LEMON_SIGNING_SECRET) || DEFAULT_SIGNING_SECRET;
  const adminSecret = request.headers.get('x-admin-secret');
  if (!adminSecret || adminSecret !== expectedSecret) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  const lemonApiKey = env && env.LEMON_API_KEY;
  if (!lemonApiKey) {
    return jsonResponse({
      ok: false,
      code: 'LEMON_API_KEY_MISSING',
      error: 'LEMON_API_KEY is not configured in Cloudflare Pages environment variables'
    }, 503);
  }

  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_admin_users_list`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ caller_user_id: MASTER_ADMIN_USER_ID })
  });

  if (!listRes.ok) {
    return jsonResponse({ ok: false, error: 'Failed to fetch admin user list' }, 502);
  }

  const users = await listRes.json();
  if (!Array.isArray(users)) {
    return jsonResponse({ ok: false, error: 'Invalid user list response' }, 502);
  }

  const results = [];
  const forceSync = payload.force === true;

  for (const u of users) {
    if (!u || !u.user_id) continue;
    const fetched = await fetchSupabaseUserRow(u.user_id);
    if (!fetched.ok || !fetched.row) continue;

    const row = fetched.row;
    const subscriptionId = extractSubscriptionId(row);
    const shouldTarget = Boolean(
      row.cancelled_at &&
      row.subscription_tier !== 'pro' &&
      subscriptionId &&
      (forceSync || !row.settings?.lemonCancelledAt)
    );
    if (!shouldTarget) continue;

    const cancelResult = await cancelLemonSubscription(lemonApiKey, subscriptionId);
    let dbPatched = false;
    let dbError = null;

    if (cancelResult.cancelled || cancelResult.alreadyCancelled) {
      const nowIso = new Date().toISOString();
      const patchRes = await patchSupabaseUserRow(row.user_id, {
        subscription_tier: 'free',
        payment_failed_at: null,
        settings: {
          ...(row.settings || {}),
          lemonSubscriptionId: subscriptionId,
          lemonCancelledAt: nowIso
        },
        updated_at: nowIso
      });
      dbPatched = patchRes.ok;
      dbError = patchRes.error || null;
    }

    results.push({
      user_id: row.user_id,
      name: row.name,
      subscriptionId,
      result: cancelResult,
      dbPatched,
      dbError
    });
  }

  return jsonResponse({
    ok: true,
    processedCount: results.length,
    results
  }, 200);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-seedfit-client, x-admin-secret'
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let payload = {};
  try {
    payload = await request.json();
  } catch (_) {
    return jsonResponse({ ok: false, error: 'Invalid JSON payload' }, 400);
  }

  if (payload && payload.action === 'sync_cancelled_users') {
    return handleSyncCancelledUsers(request, env, payload);
  }

  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ ok: false, error: 'Forbidden origin' }, 403);
  }

  const { userId, name, email } = payload || {};
  if (typeof userId !== 'string' || !/^(kakao|google|email):.+/.test(userId)) {
    return jsonResponse({ ok: false, error: 'Invalid userId' }, 400);
  }

  const fetched = await fetchSupabaseUserRow(userId);
  if (!fetched.ok) {
    return jsonResponse({ ok: false, error: 'Database lookup failed' }, 502);
  }
  if (!fetched.row) {
    return jsonResponse({ ok: false, error: 'User not found' }, 404);
  }

  const row = fetched.row;
  if (
    typeof row.email === 'string' && row.email.trim() &&
    typeof email === 'string' && email.trim() &&
    row.email.trim().toLowerCase() !== email.trim().toLowerCase()
  ) {
    return jsonResponse({ ok: false, error: 'User verification failed' }, 403);
  }
  if (
    typeof row.name === 'string' && row.name.trim() &&
    typeof name === 'string' && name.trim() &&
    row.name.trim() !== name.trim()
  ) {
    return jsonResponse({ ok: false, error: 'User verification failed' }, 403);
  }

  let subscriptionId = extractSubscriptionId(row);
  const needsLemonCancel = Boolean(subscriptionId) || row.subscription_tier === 'pro' || row.subscription_tier === 'past_due';
  let cancelResult = null;

  if (needsLemonCancel) {
    const lemonApiKey = env && env.LEMON_API_KEY;
    if (!lemonApiKey) {
      return jsonResponse({
        ok: false,
        code: 'LEMON_API_KEY_MISSING',
        error: '결제 시스템 해지 연동 설정이 아직 완료되지 않았습니다.'
      }, 503);
    }

    if (!subscriptionId && row.email) {
      subscriptionId = await findActiveLemonSubscriptionByEmail(lemonApiKey, row.email);
    }

    if (subscriptionId) {
      cancelResult = await cancelLemonSubscription(lemonApiKey, subscriptionId);
      if (!cancelResult.cancelled && !cancelResult.notFound) {
        return jsonResponse({
          ok: false,
          code: 'LEMON_CANCEL_FAILED',
          error: '정기 결제 해지 처리 중 오류가 발생했습니다.',
          detail: cancelResult.error
        }, 502);
      }
    }
  }

  const nowIso = new Date().toISOString();
  const cancelledAt = row.cancelled_at || nowIso;
  const retentionUntil = row.data_retention_until || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const mergedSettings = {
    ...(row.settings || {}),
    ...(subscriptionId ? { lemonSubscriptionId: subscriptionId, lemonCancelledAt: nowIso } : {})
  };

  const patchRes = await patchSupabaseUserRow(userId, {
    subscription_tier: 'free',
    cancelled_at: cancelledAt,
    data_retention_until: retentionUntil,
    payment_failed_at: null,
    settings: mergedSettings,
    updated_at: nowIso
  });

  if (!patchRes.ok) {
    return jsonResponse({
      ok: false,
      error: '구독 상태 저장 중 오류가 발생했습니다.',
      detail: patchRes.error
    }, 500);
  }

  return jsonResponse({
    ok: true,
    lemonCancelled: Boolean(subscriptionId && cancelResult?.cancelled),
    alreadyCancelled: Boolean(cancelResult?.alreadyCancelled),
    subscriptionId: subscriptionId || null,
    cancelledAt,
    retentionUntil
  }, 200);
}
