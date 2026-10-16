import https from 'https';
import dns from 'dns';
import fs from 'fs';
import path from 'path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// Force Node.js to prioritize IPv4 so Telegram API connections never hang on unreachable IPv6
try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (_) {}

// ─── Environment & Clients ───────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = (
  process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.trim().length > 10
    ? process.env.TELEGRAM_BOT_TOKEN
    : '8999491309:AAHhg0MQZijkr7umxN-IgcXox7NOJykuxuY'
).trim();

const BOT_USERNAME = (
  process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME ||
  'movieflix_pro_bot'
).trim();

const AWS_REGION = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'ap-southeast-2';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_u439PunGB';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || 'ohrgclhcm98kbrimrtttss2a4';

const awsCredentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
  ...(awsCredentials ? { credentials: awsCredentials } : {}),
});

const rawDdbClient = new DynamoDBClient({
  region: AWS_REGION,
  ...(awsCredentials ? { credentials: awsCredentials } : {}),
});
const ddbDoc = DynamoDBDocumentClient.from(rawDdbClient);

const SUBSCRIPTIONS_TABLE = process.env.DYNAMODB_SUBSCRIPTIONS_TABLE || 'movieflix_subscriptions';
const ORDERS_TABLE = process.env.DYNAMODB_ORDERS_TABLE || 'movieflix_orders';

// ─── Telegram Stars Pricing Plans ────────────────────────────────────────────
export const SUBSCRIPTION_PLANS = {
  '1_month': {
    id: '1_month',
    name: '1 Month Pro',
    price: 1.0,
    stars: 50, // 50 Telegram Stars (~$1 USD)
    currency: 'USD',
    durationDays: 30,
    durationMs: 30 * 24 * 60 * 60 * 1000,
    badge: 'Starter VIP',
    description: 'Stream 4K Ultra HD & Zero Ads for 30 Days (50 Stars)',
  },
  '3_months': {
    id: '3_months',
    name: '3 Months Pro',
    price: 3.0,
    stars: 150, // 150 Telegram Stars (~$3 USD)
    currency: 'USD',
    durationDays: 90,
    durationMs: 90 * 24 * 60 * 60 * 1000,
    badge: 'Most Popular',
    description: 'Stream 4K Ultra HD & Zero Ads for 90 Days (150 Stars)',
  },
  '6_months': {
    id: '6_months',
    name: '6 Months Pro',
    price: 5.0,
    stars: 250, // 250 Telegram Stars (~$5 USD)
    currency: 'USD',
    durationDays: 180,
    durationMs: 180 * 24 * 60 * 60 * 1000,
    badge: 'Best Value · Save 17%',
    description: 'Stream 4K Ultra HD & Zero Ads for 180 Days (250 Stars)',
  },
};

// ─── Telegram Bot API Helper ─────────────────────────────────────────────────
async function callTelegram(method, body = {}) {
  const token = (
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.trim().length > 10
      ? process.env.TELEGRAM_BOT_TOKEN
      : '8999491309:AAHhg0MQZijkr7umxN-IgcXox7NOJykuxuY'
  ).trim();

  const postData = JSON.stringify(body || {});

  return new Promise((resolve) => {
    try {
      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/${method}`,
        method: 'POST',
        family: 4, // Strict IPv4 to bypass dead IPv6 route on AWS host
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 15000,
      };

      const req = https.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(rawData);
            if (!data.ok) {
              console.error(`[Telegram API Error on ${method}]`, data);
            }
            resolve(data);
          } catch (e) {
            console.error(`[Telegram API JSON Parse Error on ${method}]`, rawData);
            resolve({ ok: false, error: e.message, raw: rawData });
          }
        });
      });

      req.on('error', (err) => {
        const msg = err?.message || err?.code || 'HTTPS network error';
        console.error(`[Telegram https Request Error: ${method}]`, msg);
        resolve({ ok: false, error: msg });
      });

      req.on('timeout', () => {
        req.destroy();
        console.error(`[Telegram Request Timeout: ${method}]`);
        resolve({ ok: false, error: 'Request timeout to Telegram API' });
      });

      req.write(postData);
      req.end();
    } catch (topErr) {
      console.error(`[Telegram callTelegram Exception: ${method}]`, topErr);
      resolve({ ok: false, error: topErr?.message || 'callTelegram failed' });
    }
  });
}

// ─── Module Scope Constants & State ──────────────────────────────────────────
const effectiveApiBase = (
  process.env.EXPO_PUBLIC_API_BASE || 'https://mws.wallpaperdomain.xyz'
).replace(/\/+$/, '');

let cachedPhotoFileId = null;

// ─── Helper: Send Account ID Guide Photo via Telegram ────────────────────────
async function sendGuidePhoto(chatId, caption, replyMarkup = null) {
  const token = TELEGRAM_BOT_TOKEN;

  // 1. Instant delivery via cached Telegram file_id if previously uploaded
  if (cachedPhotoFileId) {
    const res = await callTelegram('sendPhoto', {
      chat_id: chatId,
      photo: cachedPhotoFileId,
      caption: caption,
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
    if (res?.ok) return res;
    cachedPhotoFileId = null;
  }

  // 2. Upload the local WebP image via multipart/form-data directly to Telegram
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), 'public/assets/account_id_guide.webp'),
      path.resolve(process.cwd(), 'assets/account_id_guide.webp'),
      path.resolve(process.cwd(), 'dist/assets/account_id_guide.webp'),
      '/storage/emulated/0/Download/Untitled design_20261016_122522_0000.webp',
    ];
    const photoPath = candidatePaths.find((p) => {
      try { return fs.existsSync(p); } catch (_) { return false; }
    });

    if (photoPath) {
      const fileBuf = fs.readFileSync(photoPath);
      const boundary = '----TgBot' + Math.random().toString(36).substring(2);

      const parts = [];
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`));
      if (caption) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`));
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`));
      }
      if (replyMarkup) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reply_markup"\r\n\r\n${JSON.stringify(replyMarkup)}\r\n`));
      }
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="account_id_guide.webp"\r\nContent-Type: image/webp\r\n\r\n`));
      parts.push(fileBuf);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const payload = Buffer.concat(parts);

      const uploadRes = await new Promise((resolve) => {
        try {
          const req = https.request({
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${token}/sendPhoto`,
            method: 'POST',
            family: 4,
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': payload.length,
            },
            timeout: 25000,
          }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
              try { resolve(JSON.parse(data)); } catch (e) { resolve({ ok: false, error: e.message }); }
            });
          });
          req.on('error', (err) => resolve({ ok: false, error: err?.message }));
          req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Upload timeout' }); });
          req.write(payload);
          req.end();
        } catch (err) {
          resolve({ ok: false, error: err?.message });
        }
      });

      if (uploadRes?.ok && uploadRes?.result?.photo?.length) {
        cachedPhotoFileId = uploadRes.result.photo[uploadRes.result.photo.length - 1].file_id;
        return uploadRes;
      }
    }
  } catch (err) {
    console.error('[sendGuidePhoto multipart error]', err);
  }

  // 3. Fallback to sending public URL directly to Telegram
  const photoUrl = `${effectiveApiBase}/assets/account_id_guide.webp`;
  const urlRes = await callTelegram('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption,
    parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
  if (urlRes?.ok && urlRes?.result?.photo?.length) {
    cachedPhotoFileId = urlRes.result.photo[urlRes.result.photo.length - 1].file_id;
    return urlRes;
  }

  // 4. Final fallback to text message
  return await callTelegram('sendMessage', {
    chat_id: chatId,
    text: caption,
    parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

// ─── Helper: Authenticate Cognito User from Authorization Header ─────────────
async function authenticateUser(req, body = {}, query = {}) {
  const authHeader = req.headers?.authorization || body?.token || query?.token || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const res = await cognitoClient.send(new GetUserCommand({ AccessToken: token }));
    const emailAttr = res.UserAttributes?.find((a) => a.Name === 'email');
    const email = (emailAttr?.Value || res.Username || '').toLowerCase().trim();
    return {
      userId: email,
      username: res.Username,
      email: email,
    };
  } catch (_) {
    // JWT Payload fallback
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
          const email = (payload.email || payload['cognito:username'] || payload.sub || '').toLowerCase().trim();
          if (email) {
            return {
              userId: email,
              username: payload['cognito:username'] || email,
              email: email,
            };
          }
        }
      }
    } catch (_) {}
  }
  return null;
}

// ─── Helper: Get or Generate Unique 6-Digit User Account Code ─────────────────
export async function getOrGenerateUserCode(userId, email) {
  const cleanId = String(userId || email || '').toLowerCase().trim();
  const cleanEmail = email ? String(email).toLowerCase().trim() : '';

  // 1. Check if user already has an active code
  if (cleanId) {
    try {
      const existing = await ddbDoc.send(
        new GetCommand({
          TableName: ORDERS_TABLE,
          Key: { orderId: `user_account_code_${cleanId}` },
        })
      );
      if (existing?.Item?.code) {
        return existing.Item.code;
      }
    } catch (e) {
      console.warn('[Get Code Note]', e.message);
    }
  }

  // 2. Generate random 6-digit numeric ID (e.g. 748192)
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const targetId = cleanId || `guest_${code}`;

  try {
    // Store forward lookup: user_code_748192 -> { userId, userEmail, code }
    await ddbDoc.send(
      new PutCommand({
        TableName: ORDERS_TABLE,
        Item: {
          orderId: `user_code_${code}`,
          code: code,
          userId: targetId,
          userEmail: cleanEmail,
          isGuest: !cleanEmail,
          type: 'account_code_link',
          createdAt: new Date().toISOString(),
        },
      })
    );

    // Store reverse lookup: user_account_code_targetId -> code
    await ddbDoc.send(
      new PutCommand({
        TableName: ORDERS_TABLE,
        Item: {
          orderId: `user_account_code_${targetId}`,
          code: code,
          userId: targetId,
          userEmail: cleanEmail,
          type: 'account_code_reverse',
          updatedAt: new Date().toISOString(),
        },
      })
    );
  } catch (e) {
    console.error('[Save Code Error]', e);
  }

  return code;
}

// ─── Helper: Look up User by 6-digit Code ─────────────────────────────────────
export async function getUserByCode(code) {
  if (!code) return null;
  const cleanCode = String(code).trim();
  if (cleanCode.length !== 6) return null;
  try {
    const res = await ddbDoc.send(
      new GetCommand({
        TableName: ORDERS_TABLE,
        Key: { orderId: `user_code_${cleanCode}` },
      })
    );
    return res.Item || null;
  } catch (err) {
    console.error('[Lookup Code Error]', err);
    return null;
  }
}

// ─── Helper: Link Email to an Existing Account Code ───────────────────────────
async function linkEmailToCode(code, email) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  if (!code || !cleanEmail) return null;

  try {
    // 1. Update forward lookup
    await ddbDoc.send(
      new PutCommand({
        TableName: ORDERS_TABLE,
        Item: {
          orderId: `user_code_${code}`,
          code: String(code),
          userId: cleanEmail,
          userEmail: cleanEmail,
          isGuest: false,
          type: 'account_code_link',
          updatedAt: new Date().toISOString(),
        },
      })
    );

    // 2. Update reverse lookup
    await ddbDoc.send(
      new PutCommand({
        TableName: ORDERS_TABLE,
        Item: {
          orderId: `user_account_code_${cleanEmail}`,
          code: String(code),
          userId: cleanEmail,
          userEmail: cleanEmail,
          type: 'account_code_reverse',
          updatedAt: new Date().toISOString(),
        },
      })
    );

    return { code, userId: cleanEmail, userEmail: cleanEmail };
  } catch (err) {
    console.error('[Link Email Error]', err);
    return null;
  }
}

// ─── Helper: Format Date Nicely ──────────────────────────────────────────────
function formatDate(isoStr) {
  try {
    return new Date(isoStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (_) {
    return isoStr;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const parsedUrl = new URL(req.url || '', 'http://localhost');
  const query = req.query || Object.fromEntries(parsedUrl.searchParams.entries());

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  } else if (Buffer.isBuffer(body)) {
    try { body = JSON.parse(body.toString('utf8')); } catch (_) { body = {}; }
  }

  // If body is empty, read stream if unconsumed
  if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
    if (typeof req.on === 'function' && !req.complete) {
      try {
        const raw = await new Promise((resolve) => {
          let buf = '';
          req.on('data', (c) => { buf += c; });
          req.on('end', () => resolve(buf));
          req.on('error', () => resolve(''));
        });
        if (raw) {
          try { body = JSON.parse(raw); } catch (_) { body = {}; }
        }
      } catch (_) {}
    }
  }

  const action = String(query.action || body.action || '').trim().toLowerCase();

  const effectiveApiBase = (
    process.env.EXPO_PUBLIC_API_BASE || 'https://mws.wallpaperdomain.xyz'
  ).replace(/\/+$/, '');

  // ─────────────────────────────────────────────────────────────────────────
  // 1. GET USER 6-DIGIT CODE (Called from Movieflix Web / Mobile App)
  // ─────────────────────────────────────────────────────────────────────────
  if (action === 'get_user_code') {
    let user = await authenticateUser(req, body, query);
    const guestEmail = String(body.email || query.email || '').trim().toLowerCase();
    const guestCode = String(body.guest_code || query.guest_code || '').trim();

    if (!user && guestEmail) {
      user = { userId: guestEmail, email: guestEmail };
    }

    // Always generate an Account ID even for guest/unauthenticated users!
    if (!user) {
      const guestId = guestCode && /^\d{6}$/.test(guestCode)
        ? `guest_${guestCode}`
        : `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      user = { userId: guestId, email: null, isGuest: true };
    }

    const code = await getOrGenerateUserCode(user.userId, user.email);
    const botUrl = `https://t.me/${BOT_USERNAME}?start=${code}`;

    return res.status(200).json({
      success: true,
      code,
      email: user.email || '',
      isGuest: Boolean(user.isGuest),
      botUsername: BOT_USERNAME,
      botUrl,
      plans: Object.values(SUBSCRIPTION_PLANS),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. SET WEBHOOK (Convenience Endpoint to configure Telegram Webhook)
  // ─────────────────────────────────────────────────────────────────────────
  if (action === 'set_webhook') {
    const webhookUrl = `${effectiveApiBase}/api/telegram`;
    const tgRes = await callTelegram('setWebhook', {
      url: webhookUrl,
      drop_pending_updates: false,
      allowed_updates: ['message', 'callback_query', 'pre_checkout_query'],
    });
    return res.status(200).json({
      success: tgRes.ok,
      webhookUrl,
      telegramResponse: tgRes,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. GET TELEGRAM WEBHOOK INFO / PLANS
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && !action && !body.update_id && !body.message) {
    const info = await callTelegram('getWebhookInfo');
    return res.status(200).json({
      success: true,
      bot: BOT_USERNAME,
      plans: Object.values(SUBSCRIPTION_PLANS),
      webhookInfo: info,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. TELEGRAM BOT UPDATES WEBHOOK (POST from Telegram Servers)
  // ─────────────────────────────────────────────────────────────────────────
  const update = body;
  if (!update || typeof update !== 'object' || Object.keys(update).length === 0) {
    return res.status(200).json({ ok: true });
  }

  try {
    // ─── A. Pre-Checkout Query (User pressed Pay in Telegram Stars sheet) ───
    if (update.pre_checkout_query) {
      const q = update.pre_checkout_query;
      // Telegram requires answering within 10 seconds with ok: true
      await callTelegram('answerPreCheckoutQuery', {
        pre_checkout_query_id: q.id,
        ok: true,
      });
      return res.status(200).json({ ok: true });
    }

    // ─── B. Successful Payment in Telegram Stars ──────────────────────────
    if (update.message?.successful_payment) {
      const msg = update.message;
      const sp = msg.successful_payment;
      const chatId = msg.chat.id;

      const rawPayload = String(sp.invoice_payload || '').trim();
      let payloadData = {};
      try {
        payloadData = JSON.parse(rawPayload);
      } catch (_) {
        payloadData = { raw: rawPayload };
      }

      let orderId = payloadData.orderId || payloadData.o || rawPayload || `mf_ord_tg_${Date.now()}`;
      let planKey = payloadData.planId || payloadData.p || '1_month';
      let userCode = payloadData.code || payloadData.c;

      // Also parse format: mf_{code}_{planKey}_{timestamp}
      if (!userCode && rawPayload.startsWith('mf_')) {
        const parts = rawPayload.split('_');
        if (parts.length >= 4) {
          userCode = parts[1];
          planKey = `${parts[2]}_${parts[3]}`;
        }
      }

      // Check DynamoDB for pending order if needed
      if (orderId) {
        try {
          const ordRes = await ddbDoc.send(
            new GetCommand({
              TableName: ORDERS_TABLE,
              Key: { orderId },
            })
          );
          if (ordRes?.Item) {
            if (!userCode && ordRes.Item.code) userCode = ordRes.Item.code;
            if (ordRes.Item.plan) planKey = ordRes.Item.plan;
          }
        } catch (_) {}
      }

      const plan = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS['1_month'];

      let user = null;
      if (userCode) {
        user = await getUserByCode(userCode);
      }
      const targetUserId = (user?.userId || payloadData.userId || payloadData.email || 'telegram_user').toLowerCase().trim();
      const targetEmail = (user?.userEmail || payloadData.email || targetUserId).toLowerCase().trim();

      const now = Date.now();

      // Check existing subscription to extend if already active
      let startTime = now;
      try {
        const curRes = await ddbDoc.send(
          new GetCommand({
            TableName: SUBSCRIPTIONS_TABLE,
            Key: { userId: targetUserId },
          })
        );
        const cur = curRes.Item;
        if (cur && cur.status === 'active' && cur.expiresAtTimestamp && cur.expiresAtTimestamp > now) {
          startTime = cur.expiresAtTimestamp;
        }
      } catch (_) {}

      const expiresAtTimestamp = startTime + plan.durationMs;
      const expiresAt = new Date(expiresAtTimestamp).toISOString();

      // 1. Activate Subscription in DynamoDB
      await ddbDoc.send(
        new PutCommand({
          TableName: SUBSCRIPTIONS_TABLE,
          Item: {
            userId: targetUserId,
            userEmail: targetEmail,
            status: 'active',
            plan: plan.id,
            planName: plan.name,
            amount: plan.price,
            stars: sp.total_amount,
            currency: 'XTR',
            paymentMethod: 'telegram_stars',
            telegramPaymentChargeId: sp.telegram_payment_charge_id,
            providerPaymentChargeId: sp.provider_payment_charge_id || '',
            orderId,
            startsAt: new Date(now).toISOString(),
            expiresAt,
            expiresAtTimestamp,
            updatedAt: new Date(now).toISOString(),
          },
        })
      );

      // 2. Record Order in DynamoDB
      await ddbDoc.send(
        new PutCommand({
          TableName: ORDERS_TABLE,
          Item: {
            orderId,
            userId: targetUserId,
            userEmail: targetEmail,
            plan: plan.id,
            planName: plan.name,
            amount: plan.price,
            stars: sp.total_amount,
            currency: 'XTR',
            paymentMethod: 'telegram_stars',
            telegramPaymentChargeId: sp.telegram_payment_charge_id,
            status: 'finished',
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        })
      );

      // 3. Send Telegram Celebration & Confirmation Message (Using Safe HTML)
      const successHtml =
        `🎉 <b>Payment Successful!</b>\n\n` +
        `Your <b>Movieflix Pro</b> subscription is now <b>ACTIVE</b>!\n\n` +
        `⭐ <b>Plan:</b> ${plan.name} (${sp.total_amount} Stars)\n` +
        `📧 <b>Account:</b> <code>${targetEmail}</code>\n` +
        `📅 <b>Valid Until:</b> ${formatDate(expiresAt)}\n\n` +
        `🍿 <b>Pro Benefits Unlocked:</b>\n` +
        `• 4K Ultra HD & 1080p Streaming Quality\n` +
        `• 100% Zero Ads in Movies & Shorts\n` +
        `• All Premium Episodes & Faster Servers\n\n` +
        `Enjoy streaming your favourite movies and series on Movieflix!`;

      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: successHtml,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎬 Open Movieflix Website',
                url: effectiveApiBase,
              },
            ],
          ],
        },
      });

      return res.status(200).json({ ok: true });
    }

    // ─── C. Inline Keyboard Callback Queries ──────────────────────────────
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id;
      const data = String(cb.data || '');

      await callTelegram('answerCallbackQuery', { callback_query_id: cb.id });

      // C1: User clicked "Yes, Continue" -> Show Plan Cards
      if (data.startsWith('confirm_yes:')) {
        const code = data.replace('confirm_yes:', '').trim();

        const plansHtml =
          `✨ <b>Choose Your Movieflix Pro Plan:</b>\n\n` +
          `🍿 <b>Included with Pro:</b>\n` +
          `• 4K Ultra HD & 1080p Bitrate\n` +
          `• Zero Ads in Player & Shorts\n` +
          `• Access to All Premium Episodes\n\n` +
          `⭐ <b>Pay directly with Telegram Stars:</b>`;

        await callTelegram('sendMessage', {
          chat_id: chatId,
          text: plansHtml,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '⭐ 1 Month Pro — 50 Stars ($1)',
                  callback_data: `plan:1_month:${code}`,
                },
              ],
              [
                {
                  text: '🔥 3 Months Pro — 150 Stars ($3)',
                  callback_data: `plan:3_months:${code}`,
                },
              ],
              [
                {
                  text: '👑 6 Months Pro — 250 Stars ($5)',
                  callback_data: `plan:6_months:${code}`,
                },
              ],
              [
                {
                  text: '🔄 Change Account ID',
                  callback_data: 'change_account',
                },
              ],
            ],
          },
        });
        return res.status(200).json({ ok: true });
      }

      // C2: User selected a plan -> Send Telegram Stars Invoice
      if (data.startsWith('plan:')) {
        const [, planKey, code] = data.split(':');
        const plan = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS['1_month'];
        const user = await getUserByCode(code);

        const orderId = `mf_${code || 'usr'}_${plan.id}_${Date.now()}`;

        // 1. Save pending order in DynamoDB first
        try {
          await ddbDoc.send(
            new PutCommand({
              TableName: ORDERS_TABLE,
              Item: {
                orderId,
                code: String(code || ''),
                plan: plan.id,
                planName: plan.name,
                amount: plan.price,
                stars: plan.stars,
                currency: 'XTR',
                userId: user?.userId || `guest_${code}`,
                userEmail: user?.userEmail || '',
                status: 'pending_payment',
                chatId: String(chatId),
                createdAt: new Date().toISOString(),
              },
            })
          );
        } catch (e) {
          console.error('[Save Pending Order Error]', e);
        }

        // 2. Generate direct invoice link via createInvoiceLink
        let invoiceUrl = '';
        try {
          const linkRes = await callTelegram('createInvoiceLink', {
            title: `Movieflix Pro: ${plan.name}`.substring(0, 32),
            description: `Unlock 4K Streaming & Zero Ads on Movieflix for ${plan.durationDays} days.`,
            payload: orderId, // Strictly <= 128 bytes
            currency: 'XTR',
            prices: [
              {
                label: `${plan.name} (${plan.durationDays} Days)`,
                amount: plan.stars,
              },
            ],
          });
          if (linkRes?.ok && linkRes?.result) {
            invoiceUrl = linkRes.result;
          }
        } catch (_) {}

        // 3. Send Native Telegram Stars Invoice (currency: 'XTR', provider_token: '')
        const invoiceRes = await callTelegram('sendInvoice', {
          chat_id: chatId,
          title: `Movieflix Pro: ${plan.name}`.substring(0, 32),
          description: `Unlock 4K Streaming & Zero Ads on Movieflix for ${plan.durationDays} days.`,
          payload: orderId, // Strictly <= 128 bytes
          provider_token: '', // MUST be empty for Telegram Stars!
          currency: 'XTR',    // Telegram Stars currency
          prices: [
            {
              label: `${plan.name} (${plan.durationDays} Days)`,
              amount: plan.stars, // 1 Star = 1 unit in XTR
            },
          ],
        });

        // 4. Send direct payment button message if available or as backup
        if (invoiceUrl) {
          await callTelegram('sendMessage', {
            chat_id: chatId,
            text:
              `⭐️ <b>Movieflix Pro: ${plan.name}</b>\n\n` +
              `• <b>Price:</b> ⭐️ <b>${plan.stars} Telegram Stars</b> (~$${plan.price} USD)\n` +
              `• <b>Account:</b> <code>${user?.userEmail || code}</code>\n` +
              `• <b>Duration:</b> ${plan.durationDays} Days\n\n` +
              `👇 Tap the button below to pay with Telegram Stars:`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: `⭐️ Pay ${plan.stars} Stars Now`,
                    url: invoiceUrl,
                  },
                ],
                [
                  {
                    text: '🔄 Choose Different Plan',
                    callback_data: `confirm_yes:${code}`,
                  },
                ],
              ],
            },
          });
        }

        return res.status(200).json({ ok: true });
      }

      // C3: View plans summary
      if (data === 'view_plans') {
        const plansHtml =
          `💎 <b>Movieflix Pro Subscription Plans:</b>\n\n` +
          `• <b>⭐ 1 Month Pro</b> — 50 Telegram Stars (~$1)\n` +
          `• <b>🔥 3 Months Pro</b> — 150 Telegram Stars (~$3)\n` +
          `• <b>👑 6 Months Pro</b> — 250 Telegram Stars (~$5)\n\n` +
          `🍿 <b>Features Included:</b>\n` +
          `• 4K Ultra HD & 1080p Streaming Quality\n` +
          `• 100% Zero Ads in Movies & Shorts\n` +
          `• Access to All VIP & Premium Episodes\n\n` +
          `👉 Please reply with your <b>6-digit Movieflix Account ID</b> (e.g. <code>749215</code>) or registered <b>email</b> first so we can activate Pro on your account!`;

        await callTelegram('sendMessage', {
          chat_id: chatId,
          text: plansHtml,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🎬 Open Movieflix Website',
                  url: effectiveApiBase,
                },
              ],
              [
                {
                  text: '🆔 Enter Account ID / Email',
                  callback_data: 'change_account',
                },
              ],
            ],
          },
        });
        return res.status(200).json({ ok: true });
      }

      // C4: User requested to enter a different account
      if (data === 'change_account') {
        const guideCaption =
          `👉 <b>Where to find your Account ID:</b>\n\n` +
          `Look at the guide image above! Open Movieflix and go to <b>Pro / Pricing</b> to see your 6-digit Account ID.\n\n` +
          `Please reply with your <b>6-digit Account ID</b> (e.g. <code>749215</code>) or registered <b>email address</b>:`;

        await sendGuidePhoto(chatId, guideCaption, {
          inline_keyboard: [
            [
              {
                text: '🎬 Open Movieflix Website',
                url: effectiveApiBase,
              },
            ],
          ],
        });
        return res.status(200).json({ ok: true });
      }
    }

    // ─── D. Incoming Messages (/start or text ID/email) ────────────────────
    if (update.message?.text) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const rawText = msg.text.trim();
      const cleanText = rawText.replace(new RegExp(`^/start(?:@${BOT_USERNAME})?`, 'i'), '/start').trim();

      // Case D1: /start with or without parameter
      if (cleanText.startsWith('/start')) {
        const param = cleanText.replace('/start', '').trim();

        // Parameter is 6 digits: /start 749215 (from website deep link)
        if (param && /^\d{6}$/.test(param)) {
          let user = await getUserByCode(param);

          // If not in DB yet, auto-register code
          if (!user) {
            await getOrGenerateUserCode(`guest_${param}`, null);
            user = await getUserByCode(param);
          }

          if (user && user.userEmail && !user.userEmail.startsWith('guest_')) {
            await callTelegram('sendMessage', {
              chat_id: chatId,
              text:
                `👋 <b>Welcome to Movieflix Pro Bot!</b>\n\n` +
                `🔍 <b>Account Found:</b>\n` +
                `🆔 <b>Account ID:</b> <code>${user.code}</code>\n` +
                `📧 <b>Registered Email:</b> <code>${user.userEmail}</code>\n\n` +
                `Is this your Movieflix account?`,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '✅ Yes, Continue',
                      callback_data: `confirm_yes:${user.code}`,
                    },
                  ],
                  [
                    {
                      text: '🔄 Different Account',
                      callback_data: 'change_account',
                    },
                  ],
                ],
              },
            });
            return res.status(200).json({ ok: true });
          } else {
            // Guest Account ID detected — ask for email to link
            const guestCaption =
              `👋 <b>Welcome to Movieflix Pro Bot!</b>\n\n` +
              `🆔 <b>Detected Account ID:</b> <code>${param}</code>\n\n` +
              `👉 Please reply with your <b>email address</b> to link your Movieflix account and unlock Pro VIP:`;

            await sendGuidePhoto(chatId, guestCaption);
            return res.status(200).json({ ok: true });
          }
        }

        // Generic /start greeting (when user opens bot and presses [ START ])
        const startCaption =
          `👋 <b>Welcome to the official Movieflix Pro Bot!</b>\n\n` +
          `🍿 <b>Movieflix Pro VIP Features:</b>\n` +
          `• 🎬 Stream all titles in <b>4K Ultra HD & 1080p</b>\n` +
          `• 🚫 <b>100% Zero Ads</b> in Movies, Series & Shorts\n` +
          `• 👑 <b>All VIP Episodes</b> & high-speed streaming\n\n` +
          `💎 <b>Telegram Stars Pricing:</b>\n` +
          `• ⭐ 1 Month Pro — <b>50 Stars</b> ($1)\n` +
          `• 🔥 3 Months Pro — <b>150 Stars</b> ($3)\n` +
          `• 👑 6 Months Pro — <b>250 Stars</b> ($5)\n\n` +
          `👉 <b>To subscribe, please reply with your 6-digit Movieflix Account ID</b> ` +
          `(see guide picture above 👆) or type your registered <b>email address</b>:`;

        await sendGuidePhoto(chatId, startCaption, {
          inline_keyboard: [
            [
              {
                text: '🎬 Open Movieflix Website',
                url: effectiveApiBase,
              },
            ],
            [
              {
                text: '💎 View Pricing Plans',
                callback_data: 'view_plans',
              },
              {
                text: '🆔 Enter Account ID',
                callback_data: 'change_account',
              },
            ],
          ],
        });
        return res.status(200).json({ ok: true });
      }

      // Case D2: /help command
      if (rawText.startsWith('/help')) {
        await callTelegram('sendMessage', {
          chat_id: chatId,
          text:
            `🍿 <b>Movieflix Pro Help & Instructions:</b>\n\n` +
            `1️⃣ <b>Get Account ID:</b> Open Movieflix, go to Pro / Pricing to find your 6-digit Account ID.\n` +
            `2️⃣ <b>Link Account:</b> Send your 6-digit ID or registered email here.\n` +
            `3️⃣ <b>Choose Plan:</b> Select 1 Month (50 Stars), 3 Months (150 Stars), or 6 Months (250 Stars).\n` +
            `4️⃣ <b>Instant Activation:</b> Pay with Telegram Stars and your subscription is activated immediately on the website!\n\n` +
            `🌐 <b>Website:</b> ${effectiveApiBase}`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🎬 Open Movieflix Website',
                  url: effectiveApiBase,
                },
              ],
              [
                {
                  text: '💎 View Plans',
                  callback_data: 'view_plans',
                },
              ],
            ],
          },
        });
        return res.status(200).json({ ok: true });
      }

      // Case D3: /plans command
      if (rawText.startsWith('/plans')) {
        await callTelegram('sendMessage', {
          chat_id: chatId,
          text:
            `💎 <b>Movieflix Pro Subscription Plans:</b>\n\n` +
            `• <b>⭐ 1 Month Pro</b> — 50 Telegram Stars (~$1)\n` +
            `• <b>🔥 3 Months Pro</b> — 150 Telegram Stars (~$3)\n` +
            `• <b>👑 6 Months Pro</b> — 250 Telegram Stars (~$5)\n\n` +
            `👉 Reply with your <b>6-digit Account ID</b> or registered <b>email</b> to subscribe!`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🎬 Open Movieflix Website',
                  url: effectiveApiBase,
                },
              ],
              [
                {
                  text: '🆔 Enter Account ID',
                  callback_data: 'change_account',
                },
              ],
            ],
          },
        });
        return res.status(200).json({ ok: true });
      }

      // Case D4: User sent 6-digit numeric ID (e.g. "749215")
      if (/^\d{6}$/.test(rawText)) {
        let user = await getUserByCode(rawText);
        if (!user) {
          await getOrGenerateUserCode(`guest_${rawText}`, null);
          user = await getUserByCode(rawText);
        }

        if (user && user.userEmail && !user.userEmail.startsWith('guest_')) {
          await callTelegram('sendMessage', {
            chat_id: chatId,
            text:
              `🔍 <b>Account Found!</b>\n\n` +
              `🆔 <b>Account ID:</b> <code>${user.code}</code>\n` +
              `📧 <b>Registered Email:</b> <code>${user.userEmail}</code>\n\n` +
              `Is this your Movieflix account?`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '✅ Yes, This is My Email',
                    callback_data: `confirm_yes:${user.code}`,
                  },
                ],
                [
                  {
                    text: '🔄 Different Account',
                    callback_data: 'change_account',
                  },
                ],
              ],
            },
          });
        } else {
          await callTelegram('sendMessage', {
            chat_id: chatId,
            text:
              `🔍 <b>Account ID:</b> <code>${rawText}</code>\n\n` +
              `👉 Please reply with your <b>email address</b> so we can link your Movieflix subscription:`,
            parse_mode: 'HTML',
          });
        }
        return res.status(200).json({ ok: true });
      }

      // Case D5: User sent an email address (e.g. "user@gmail.com")
      if (rawText.includes('@') && rawText.includes('.')) {
        const email = rawText.toLowerCase().trim();
        const code = await getOrGenerateUserCode(email, email);

        await callTelegram('sendMessage', {
          chat_id: chatId,
          text:
            `✅ <b>Account Verified & Linked!</b>\n\n` +
            `📧 <b>Email:</b> <code>${email}</code>\n` +
            `🆔 <b>Assigned Account ID:</b> <code>${code}</code>\n\n` +
            `✨ <b>Select Your Movieflix Pro Plan:</b>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '⭐ 1 Month Pro — 50 Stars ($1)',
                  callback_data: `plan:1_month:${code}`,
                },
              ],
              [
                {
                  text: '🔥 3 Months Pro — 150 Stars ($3)',
                  callback_data: `plan:3_months:${code}`,
                },
              ],
              [
                {
                  text: '👑 6 Months Pro — 250 Stars ($5)',
                  callback_data: `plan:6_months:${code}`,
                },
              ],
              [
                {
                  text: '🔄 Change Email',
                  callback_data: 'change_account',
                },
              ],
            ],
          },
        });
        return res.status(200).json({ ok: true });
      }

      // Fallback response for unparsed text
      const fallbackCaption =
        `👉 <b>Please enter your 6-digit Movieflix Account ID</b> (see guide picture above 👆) ` +
        `or your registered <b>email address</b>:`;

      await sendGuidePhoto(chatId, fallbackCaption, {
        inline_keyboard: [
          [
            {
              text: '🎬 Open Movieflix Website',
              url: effectiveApiBase,
            },
          ],
          [
            {
              text: '💎 View Pricing Plans',
              callback_data: 'view_plans',
            },
            {
              text: '🆔 Enter Account ID',
              callback_data: 'change_account',
            },
          ],
        ],
      });
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('[Telegram Webhook Handler Error]', err);
  }

  return res.status(200).json({ ok: true });
}
