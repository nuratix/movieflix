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

// ─── Environment & Clients ───────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = (
  process.env.TELEGRAM_BOT_TOKEN ||
  '8999491309:AAHhg0MQZijkr7umxN-IgcXox7NOJykuxuY'
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
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error(`[Telegram API Error on ${method}]`, data);
    }
    return data;
  } catch (err) {
    console.error(`[Telegram API Network Error: ${method}]`, err);
    return { ok: false, error: err.message };
  }
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
  const body = req.body || {};
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
  if (!update || typeof update !== 'object') {
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

      let payloadData = {};
      try {
        payloadData = JSON.parse(sp.invoice_payload);
      } catch (_) {
        payloadData = { raw: sp.invoice_payload };
      }

      const planKey = payloadData.planId || '1_month';
      const plan = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS['1_month'];
      const userCode = payloadData.code;

      let user = null;
      if (userCode) {
        user = await getUserByCode(userCode);
      }
      const targetUserId = (user?.userId || payloadData.userId || payloadData.email || 'telegram_user').toLowerCase().trim();
      const targetEmail = (user?.userEmail || payloadData.email || targetUserId).toLowerCase().trim();

      const orderId = payloadData.orderId || `mf_ord_tg_${Date.now()}`;
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

        const orderId = `mf_ord_tg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const invoicePayload = JSON.stringify({
          orderId,
          code,
          planId: plan.id,
          userId: user?.userId,
          email: user?.userEmail,
        });

        // Send Native Telegram Stars Invoice (currency: 'XTR', provider_token: '')
        await callTelegram('sendInvoice', {
          chat_id: chatId,
          title: `Movieflix Pro: ${plan.name}`,
          description: `Unlock 4K Streaming & Zero Ads on Movieflix for ${plan.durationDays} days.`,
          payload: invoicePayload,
          provider_token: '', // MUST be empty for Telegram Stars!
          currency: 'XTR',    // Telegram Stars currency
          prices: [
            {
              label: `${plan.name} (${plan.durationDays} Days)`,
              amount: plan.stars, // 1 Star = 1 unit in XTR
            },
          ],
        });
        return res.status(200).json({ ok: true });
      }

      // C3: User requested to enter a different account
      if (data === 'change_account') {
        await callTelegram('sendMessage', {
          chat_id: chatId,
          text:
            `👉 Please reply with your <b>6-digit Movieflix Account ID</b> (found under Pricing on Movieflix), ` +
            `or type your registered <b>email address</b>:`,
          parse_mode: 'HTML',
        });
        return res.status(200).json({ ok: true });
      }
    }

    // ─── D. Incoming Messages (/start or text ID/email) ────────────────────
    if (update.message?.text) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text.trim();

      // Case D1: /start with or without parameter
      if (text.startsWith('/start')) {
        const param = text.replace('/start', '').trim();

        // Parameter is 6 digits: /start 123456
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
                `We identified your Movieflix account:\n` +
                `📧 <b>Email:</b> <code>${user.userEmail}</code>\n` +
                `🆔 <b>Account ID:</b> <code>${user.code}</code>\n\n` +
                `Is this your account?`,
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
            await callTelegram('sendMessage', {
              chat_id: chatId,
              text:
                `👋 <b>Welcome to Movieflix Pro Bot!</b>\n\n` +
                `🆔 <b>Detected Account ID:</b> <code>${param}</code>\n\n` +
                `👉 Please reply with your <b>email address</b> to link your Movieflix account:`,
              parse_mode: 'HTML',
            });
            return res.status(200).json({ ok: true });
          }
        }

        // Generic /start greeting
        await callTelegram('sendMessage', {
          chat_id: chatId,
          text:
            `👋 <b>Welcome to the official Movieflix Pro Bot!</b>\n\n` +
            `Upgrade your Movieflix account to <b>Pro</b> to unlock:\n` +
            `• 🎬 Stream all titles in <b>4K Ultra HD & 1080p</b>\n` +
            `• 🚫 <b>Zero Ads</b> in Movies, Series & Shorts\n` +
            `• 🍿 All Premium & VIP Episodes\n\n` +
            `👉 To link your account, reply with your <b>6-digit Movieflix Account ID</b> ` +
            `(found under Pro/Pricing in Movieflix), or type your registered <b>email address</b>:`,
          parse_mode: 'HTML',
        });
        return res.status(200).json({ ok: true });
      }

      // Case D2: User sent 6-digit numeric ID (e.g. "749215")
      if (/^\d{6}$/.test(text)) {
        let user = await getUserByCode(text);
        if (!user) {
          await getOrGenerateUserCode(`guest_${text}`, null);
          user = await getUserByCode(text);
        }

        if (user && user.userEmail && !user.userEmail.startsWith('guest_')) {
          await callTelegram('sendMessage', {
            chat_id: chatId,
            text:
              `🔍 <b>Account Found!</b>\n\n` +
              `📧 <b>Email:</b> <code>${user.userEmail}</code>\n` +
              `🆔 <b>Account ID:</b> <code>${user.code}</code>\n\n` +
              `Confirm to proceed with subscription:`,
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
                    text: '🔄 Enter Different ID',
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
              `🔍 <b>Account ID:</b> <code>${text}</code>\n\n` +
              `👉 Please reply with your <b>email address</b> so we can link your Movieflix subscription:`,
            parse_mode: 'HTML',
          });
        }
        return res.status(200).json({ ok: true });
      }

      // Case D3: User sent an email address (e.g. "alex@gmail.com")
      if (text.includes('@') && text.includes('.')) {
        const email = text.toLowerCase().trim();
        const code = await getOrGenerateUserCode(email, email);

        await callTelegram('sendMessage', {
          chat_id: chatId,
          text:
            `🔍 <b>Account Linked!</b>\n\n` +
            `📧 <b>Email:</b> <code>${email}</code>\n` +
            `🆔 <b>Assigned ID:</b> <code>${code}</code>\n\n` +
            `Do you want to activate Movieflix Pro for this email?`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ Yes, Continue',
                  callback_data: `confirm_yes:${code}`,
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
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text:
          `👉 Please enter your <b>6-digit Movieflix Account ID</b> (from the app), or your registered <b>email address</b>:`,
        parse_mode: 'HTML',
      });
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('[Telegram Webhook Handler Error]', err);
  }

  return res.status(200).json({ ok: true });
}
