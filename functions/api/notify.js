/**
 * SeedFit Telegram Notification Endpoint (Cloudflare Pages Function)
 * 
 * 운영자 전용 실시간 관제 백엔드:
 * - 신규 회원 가입 (signup)
 * - Pro 멤버십 구독 (subscription)
 * 
 * 보안:
 * - 텔레그램 봇 토큰 및 채팅방 ID는 서버리스 환경에서만 실행되며 클라이언트 브라우저에 절대 노출되지 않음
 * - 개인정보(이메일, 이름 등)는 일절 포함하지 않고 운영 통계(가입자수, 구독자수, MRR)만 집계하여 전송
 */

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

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-seedfit-client',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const botToken = (env && env.TELEGRAM_BOT_TOKEN) || DEFAULT_BOT_TOKEN;
  const chatId = (env && env.TELEGRAM_CHAT_ID) || DEFAULT_CHAT_ID;

  try {
    let payload = {};
    try {
      payload = await request.json();
    } catch (e) {
      payload = {};
    }

    const event = payload.event || 'signup';
    const isSignup = (event === 'signup');
    const eventTitle = isSignup ? '신규 회원 가입' : 'SEEDFIT PRO 신규 구독';

    // Supabase RPC에서 실시간 비즈니스 통계 조회 (총 가입자수, Pro 구독자수, MRR)
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
      console.warn('Supabase stats fetch error:', err);
    }

    // 텔레그램 메시지 조립 (계정, 이메일 일절 미포함)
    const timeStr = getKSTTimeString();
    
    let statsSection = '';
    if (totalUsers !== null && proUsers !== null) {
      const mrrFormatted = (mrrUsd !== null ? mrrUsd : (proUsers * 7.77)).toFixed(2);
      const krwApprox = Math.round(Number(mrrFormatted) * 1350).toLocaleString('ko-KR');
      statsSection = `[실시간 비즈니스 현황]\n• 현재 총 가입자: ${totalUsers}명\n• 현재 Pro 구독자: ${proUsers}명\n• 매달 구독료 (MRR): $${mrrFormatted} (약 ${krwApprox}원)`;
    } else {
      statsSection = `[실시간 비즈니스 현황]\n• 현재 총 가입자: 집계 반영 중\n• 현재 Pro 구독자: 집계 반영 중\n• 플랜 요금: $7.77 / month`;
    }

    const messageText = `[SeedFit 실시간 알림]\n\n이벤트: ${eventTitle}\n일시: ${timeStr}\n\n${statsSection}`;

    // 텔레그램 Bot API 전송
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText
      })
    });

    const tgData = await tgRes.json();

    return new Response(JSON.stringify({ ok: true, result: tgData }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Notify handler error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
