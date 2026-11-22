/**
 * SeedFit Lemon Squeezy Official Webhook Endpoint (Cloudflare Pages Function)
 * 
 * 기능:
 * 1. Lemon Squeezy 웹훅의 HMAC-SHA256 서명(X-Signature) 검증
 * 2. 결제 승인/구독 시작(subscription_created, order_created) 시 Supabase DB user_id의 subscription_tier를 'pro'로 자동 승격
 * 3. 구독 취소/만료(subscription_cancelled, subscription_expired) 시 subscription_tier를 'free'로 갱신
 * 4. 운영자 텔레그램 실시간 관제 봇으로 즉각적인 비즈니스 지표 알림 발송
 */

const DEFAULT_SIGNING_SECRET = 'Wowns0428!';
const DEFAULT_BOT_TOKEN = '8704610228:AAFyINuxeWxSBfMVbPfhvj4oUNPjatIcfnM';
const DEFAULT_CHAT_ID = '642319428';
const SUPABASE_URL = 'https://qeuiqvisuscvkgjvqxpe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldWlxdmlzdXNjdmtnanZxeHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MDM5MDcsImV4cCI6MjEwNjM3OTkwN30.yj-hRe5zQ3eUV20hjDYhzZRfzc4WJYDxUkoNVfLlWIM';

// KST 포맷 일시 생성
function getKSTTimeString() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kstTime = new Date(utc + (9 * 3600000));
  
  const yyyy = kstTime.getFullYear();
  const mm = String(kstTime.getMonth() + 1).padStart(2, '0');
  const dd = String(kstTime.getDate()).padStart(2, '0');
  const hh = String(kstTime.getHours()).padStart(2, '0');
  const min = String(kstTime.getMinutes()).padStart(2, '0');
  const ss = String(kstTime.getSeconds()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} (KST)`;
}

// Web Crypto API를 사용한 Lemon Squeezy HMAC-SHA256 서명 검증
async function verifyLemonSignature(secret, rawBody, headerSignature) {
  if (!headerSignature || !secret) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(rawBody)
    );
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const digestHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return digestHex.toLowerCase() === headerSignature.toLowerCase();
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

// 운영자 텔레그램 알림 전송
async function sendTelegramAlert(botToken, chatId, messageText) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText
      })
    });
  } catch (e) {
    console.warn('Telegram alert send error:', e);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Signature',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const signingSecret = (env && env.LEMON_SIGNING_SECRET) || DEFAULT_SIGNING_SECRET;
  const botToken = (env && env.TELEGRAM_BOT_TOKEN) || DEFAULT_BOT_TOKEN;
  const chatId = (env && env.TELEGRAM_CHAT_ID) || DEFAULT_CHAT_ID;

  // 1. 요청 원문(raw text) 취득
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'Empty body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. Lemon Squeezy X-Signature 서명 검증 (필수 강제)
  const headerSignature = request.headers.get('x-signature') || request.headers.get('X-Signature');
  if (signingSecret) {
    if (!headerSignature) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing signature header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const isValid = await verifyLemonSignature(signingSecret, rawBody, headerSignature);
    if (!isValid) {
      console.warn('Lemon Squeezy signature mismatch');
      return new Response(JSON.stringify({ ok: false, error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 3. 페이로드 JSON 파싱
  let payload = {};
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const eventName = payload.meta?.event_name || request.headers.get('x-event-name') || 'unknown';
  const customData = payload.meta?.custom_data || {};
  const targetUserId = customData.user_id || null;
  const attributes = payload.data?.attributes || {};
  const isTestMode = attributes.test_mode === true || payload.meta?.test_mode === true;
  const userEmail = attributes.user_email || '알 수 없음';
  const status = attributes.status || '';

  console.log(`[Lemon Webhook] Event: ${eventName}, Target User: ${targetUserId}, Status: ${status}, Test: ${isTestMode}`);

  // 4. 상용 라이브 환경 보호: 테스트 모드(Test Mode) 웹훅은 DB 반영 및 텔레그램 알림을 원천 차단
  if (isTestMode) {
    console.log(`[Lemon Webhook] Ignored test_mode event (${eventName}) for user ${targetUserId}`);
    return new Response(JSON.stringify({
      ok: true,
      ignored: true,
      reason: 'Test mode events are ignored in live production environment'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Pro 플랜 승격/해지/연체 이벤트 판정
  let isProUpgrade = false;
  let isProCancellation = false;
  let isPaymentFailed = false;

  if (
    eventName === 'subscription_payment_failed' ||
    status === 'past_due'
  ) {
    isPaymentFailed = true;
  } else if (
    eventName === 'subscription_cancelled' ||
    eventName === 'subscription_expired' ||
    status === 'expired'
  ) {
    isProCancellation = true;
  } else if (
    eventName === 'subscription_created' ||
    eventName === 'subscription_resumed' ||
    eventName === 'subscription_payment_success' ||
    eventName === 'subscription_payment_recovered' ||
    eventName === 'order_created' ||
    status === 'active' ||
    status === 'on_trial'
  ) {
    isProUpgrade = true;
  }

  // 4. Supabase DB 사용자 subscription_tier 동기화
  let dbUpdated = false;
  let dbError = null;
  let isAlreadyCancelledRetry = false;
  let suppressTelegram = false;
  const newTier = isPaymentFailed ? 'past_due' : (isProUpgrade ? 'pro' : (isProCancellation ? 'free' : null));
  const updateCardUrl = attributes.urls?.update_payment_method || attributes.urls?.customer_portal || null;

  // Lemon Squeezy 구독 ID 추출 (직접 ID -> attributes.subscription_id -> update_card_url)
  const cardUrlMatch = updateCardUrl ? String(updateCardUrl).match(/\/subscription\/(\d+)\//) : null;
  const subscriptionId = (
    (payload.data?.type === 'subscriptions' && payload.data?.id) ? String(payload.data.id) :
    (attributes.subscription_id ? String(attributes.subscription_id) : (cardUrlMatch ? cardUrlMatch[1] : null))
  );

  if (newTier) {
    let resolvedUserId = targetUserId;

    // 만약 targetUserId가 없다면 userEmail 기준으로 사용자 식별 시도
    if (!resolvedUserId && userEmail && userEmail !== '알 수 없음') {
      try {
        const findRes = await fetch(`${SUPABASE_URL}/rest/v1/seedfit_user_data?email=eq.${encodeURIComponent(userEmail)}&select=user_id`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'x-seedfit-user': `email:${userEmail}`
          }
        });
        if (findRes.ok) {
          const rows = await findRes.json();
          if (Array.isArray(rows) && rows.length > 0 && rows[0].user_id) {
            resolvedUserId = rows[0].user_id;
          }
        }
      } catch (e) {
        console.warn('Email fallback user lookup error:', e);
      }
    }

    if (resolvedUserId) {
      try {
        // 기존 사용자 상태 및 settings 조회 (충돌·덮어쓰기 방어)
        let existingRow = null;
        let existingRowFetched = false;
        try {
          const existingRes = await fetch(
            `${SUPABASE_URL}/rest/v1/seedfit_user_data?user_id=eq.${encodeURIComponent(resolvedUserId)}&select=subscription_tier,cancelled_at,data_retention_until,payment_failed_at,settings`,
            {
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'x-seedfit-user': resolvedUserId
              }
            }
          );
          if (existingRes.ok) {
            const existingRows = await existingRes.json();
            if (Array.isArray(existingRows) && existingRows.length > 0) {
              existingRow = existingRows[0];
              existingRowFetched = true;
            }
          }
        } catch (fetchErr) {
          console.warn('Webhook existing user lookup error:', fetchErr);
        }

        // [방어 A] 이미 앱에서 해지한 무료 계정에 대해 레몬스퀴즈 재결제 실패 웹훅이 뒤늦게 도착한 경우 past_due로 되돌리지 않음
        if (isPaymentFailed && existingRow?.cancelled_at && existingRow?.subscription_tier !== 'pro') {
          isAlreadyCancelledRetry = true;
          if (existingRow?.settings?.lemonCancelledAt) {
            suppressTelegram = true;
          }
        } else {
          const now = new Date();
          const patchData = {
            subscription_tier: newTier,
            updated_at: now.toISOString()
          };

          if (isPaymentFailed) {
            // [방어 B] 이미 연체 유예 중이라면 최초 결제 실패 시각을 유지(3일 유예 카운트다운 리셋 방지)
            patchData.payment_failed_at = (existingRow?.subscription_tier === 'past_due' && existingRow?.payment_failed_at)
              ? existingRow.payment_failed_at
              : now.toISOString();
            if (updateCardUrl) patchData.update_card_url = updateCardUrl;
          } else if (isProUpgrade) {
            patchData.cancelled_at = null;
            patchData.data_retention_until = null;
            patchData.payment_failed_at = null;
            if (updateCardUrl) patchData.update_card_url = updateCardUrl;
          } else if (isProCancellation) {
            patchData.cancelled_at = existingRow?.cancelled_at || now.toISOString();
            patchData.data_retention_until = existingRow?.data_retention_until || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            patchData.payment_failed_at = null;
          }

          // [방어 C] GET으로 기존 row 조회에 성공했을 때만 settings 병합 저장 (기존 설정 유실 원천 방지)
          if (existingRowFetched) {
            const nextSettings = { ...(existingRow.settings || {}) };
            if (subscriptionId) {
              nextSettings.lemonSubscriptionId = subscriptionId;
            }
            if (isProUpgrade) {
              delete nextSettings.lemonCancelledAt;
            } else if (isProCancellation) {
              nextSettings.lemonCancelledAt = now.toISOString();
            }
            patchData.settings = nextSettings;
          }

          const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/seedfit_user_data?user_id=eq.${encodeURIComponent(resolvedUserId)}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'x-seedfit-user': resolvedUserId,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(patchData)
          });

          if (patchRes.ok) {
            const resRows = await patchRes.json();
            dbUpdated = Array.isArray(resRows) && resRows.length > 0;
          } else {
            dbError = await patchRes.text();
          }
        }
      } catch (err) {
        dbError = err.message;
      }
    }
  }

  // 5. Supabase 실시간 비즈니스 통계 조회 (총 가입자수, Pro 구독자수, MRR)
  let totalUsers = null;
  let proUsers = null;
  let mrrUsd = null;

  try {
    const statsRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_business_summary`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    if (statsRes.ok) {
      const stats = await statsRes.json();
      if (stats && typeof stats.total_users !== 'undefined') {
        totalUsers = Number(stats.total_users);
        proUsers = Number(stats.pro_users);
        mrrUsd = Number(stats.mrr_usd);
      }
    }
  } catch (err) {
    console.warn('Supabase stats fetch error in webhook:', err);
  }

  // 6. 운영자 텔레그램 실시간 관제 알림 발송
  // - 알림 대상:
  //   1) subscription_created (신규 구독 1회)
  //   2) subscription_payment_success (매달 정기 구독 갱신 결제 성공 - 2회차 이후 renewal만)
  //      * 레몬스퀴즈는 첫 결제(initial) 시에도 subscription_payment_success를 발송하므로,
  //        billing_reason === 'initial'인 첫 결제 건은 중복 방지를 위해 제외하고 오직 갱신(renewal)일 때만 알림
  //   3) subscription_cancelled / subscription_expired (구독 해지/만료 1회)
  //   4) subscription_payment_failed (갱신 결제 실패 1회)
  //   5) subscription_payment_recovered (갱신 결제 성공/연체 해소)
  const isRenewalPayment = (
    eventName === 'subscription_payment_success' &&
    attributes.billing_reason !== 'initial'
  );

  const isNotifyTarget = (
    eventName === 'subscription_created' ||
    isRenewalPayment ||
    eventName === 'subscription_cancelled' ||
    eventName === 'subscription_expired' ||
    eventName === 'subscription_payment_failed' ||
    eventName === 'subscription_payment_recovered'
  );

  if (isNotifyTarget && !suppressTelegram) {
    const timeStr = getKSTTimeString();
    let eventTitle = '';
    if (eventName === 'subscription_created') {
      eventTitle = isTestMode ? '[테스트 결제] SEEDFIT PRO 신규 구독' : 'SEEDFIT PRO 신규 구독';
    } else if (eventName === 'subscription_payment_success') {
      eventTitle = isTestMode ? '[테스트 결제] SEEDFIT PRO 정기 구독 갱신 성공' : 'SEEDFIT PRO 정기 구독 갱신 성공';
    } else if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
      eventTitle = isTestMode ? '[테스트 결제] SEEDFIT PRO 구독 취소' : 'SEEDFIT PRO 구독 취소';
    } else if (eventName === 'subscription_payment_failed') {
      if (isAlreadyCancelledRetry) {
        eventTitle = 'SEEDFIT PRO 해지 계정 재청구 실패 (무료 유지)';
      } else {
        eventTitle = isTestMode ? '[테스트 결제] SEEDFIT PRO 갱신 승인 실패 (연체 전환)' : 'SEEDFIT PRO 정기 갱신 결제 실패 (연체 유예 모드)';
      }
    } else if (eventName === 'subscription_payment_recovered') {
      eventTitle = isTestMode ? '[테스트 결제] SEEDFIT PRO 갱신 결제 성공 (연체 해소)' : 'SEEDFIT PRO 갱신 결제 성공 (연체 해소)';
    }

    let statsSection = '';
    if (totalUsers !== null && proUsers !== null) {
      const mrrFormatted = (mrrUsd !== null ? mrrUsd : (proUsers * 7.77)).toFixed(2);
      const krwApprox = Math.round(Number(mrrFormatted) * 1350).toLocaleString('ko-KR');
      statsSection = `[실시간 비즈니스 현황]\n• 현재 총 가입자: ${totalUsers}명\n• 현재 Pro 구독자: ${proUsers}명\n• 매달 구독료 (MRR): $${mrrFormatted} (약 ${krwApprox}원)`;
    } else {
      statsSection = `[실시간 비즈니스 현황]\n• 플랜 요금: $7.77 / month`;
    }

    const modeBadge = isTestMode ? ' [TEST MODE]' : ' [LIVE MODE]';
    const dbStatusText = isAlreadyCancelledRetry
      ? '무료 상태 유지 (이미 해지됨)'
      : (targetUserId ? (dbUpdated ? '정상 반영 완료' : '반영 확인 완료') : '유저 키 미지정');

    let extraNote = '';
    if (eventName === 'subscription_payment_failed') {
      extraNote = isAlreadyCancelledRetry
        ? `\n안내: 이미 해지된 계정의 자동 재시도 실패 건 (DB 무료 상태 유지)`
        : `\n안내: 카드 잔액 부족 또는 만료로 실패했습니다. 3일 내 미해결 시 무료 플랜으로 자동 강등됩니다.`;
    }

    const telegramMsg = `${eventTitle}${modeBadge}\n일시: ${timeStr}\nDB 승격: ${dbStatusText}${extraNote}\n\n${statsSection}`;

    await sendTelegramAlert(botToken, chatId, telegramMsg);
  }

  return new Response(JSON.stringify({
    ok: true,
    event: eventName,
    test_mode: isTestMode,
    user_id: targetUserId,
    subscription_id: subscriptionId,
    already_cancelled_retry: isAlreadyCancelledRetry,
    db_updated: dbUpdated,
    db_error: dbError
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
