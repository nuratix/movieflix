import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// ─── AWS Clients & Configuration ─────────────────────────────────────────────
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

// ─── NOWPayments Configuration ───────────────────────────────────────────────
const IS_SANDBOX = process.env.NOWPAYMENTS_SANDBOX !== 'false';
const NOWPAYMENTS_BASE_URL = IS_SANDBOX
  ? 'https://api-sandbox.nowpayments.io/v1'
  : 'https://api.nowpayments.io/v1';

const NOWPAYMENTS_API_KEY = (process.env.NOWPAYMENTS_API_KEY || '').trim();
// Default internal sandbox secret used for self-simulation if merchant secret isn't provided yet
const NOWPAYMENTS_IPN_SECRET = (
  process.env.NOWPAYMENTS_IPN_SECRET ||
  (IS_SANDBOX ? 'mf_nowpay_sandbox_secret_99x' : '')
).trim();

// ─── Ad-Free Subscription Plans ──────────────────────────────────────────────
export const SUBSCRIPTION_PLANS = {
  '1_month': {
    id: '1_month',
    name: '1 Month Ad-Free',
    price: 1.0,
    currency: 'USD',
    durationDays: 30,
    durationMs: 30 * 24 * 60 * 60 * 1000,
    badge: 'Starter VIP',
    description: 'Ad-free streaming & downloads for 30 days ($1 USD)',
  },
  '3_months': {
    id: '3_months',
    name: '3 Months Ad-Free',
    price: 3.0,
    currency: 'USD',
    durationDays: 90,
    durationMs: 90 * 24 * 60 * 60 * 1000,
    badge: 'Popular VIP',
    description: 'Ad-free streaming & downloads for 90 days ($3 USD)',
  },
  '6_months': {
    id: '6_months',
    name: '6 Months Ad-Free',
    price: 5.0,
    currency: 'USD',
    durationDays: 180,
    durationMs: 180 * 24 * 60 * 60 * 1000,
    badge: 'Best Value VIP',
    description: 'Ad-free streaming & downloads for 180 days ($5 USD)',
  },
};

// ─── Helper: Authenticate Cognito User ───────────────────────────────────────
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
      attributes: res.UserAttributes,
    };
  } catch (err) {
    // Decode standard Cognito JWT payload fallback
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
    return null;
  }
}

// ─── Helper: Sort Object Keys Alphabetically for NOWPayments IPN ─────────────
export function sortObjectKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObjectKeys(obj[key]);
      return acc;
    }, {});
}

// ─── Helper: Compute HMAC-SHA512 Signature ───────────────────────────────────
export function computeIpnSignature(payload, secretKey) {
  const sorted = sortObjectKeys(payload);
  const jsonStr = JSON.stringify(sorted);
  return crypto.createHmac('sha512', secretKey).update(jsonStr).digest('hex');
}

// ─── Helper: Verify NOWPayments IPN Signature ────────────────────────────────
function verifyIpnSignature(req, payload, secretKey) {
  if (!secretKey) return false;
  const receivedSig = (req.headers?.['x-nowpayments-sig'] || '').trim();
  if (!receivedSig) return false;

  const expectedSig = computeIpnSignature(payload, secretKey);

  if (receivedSig.length !== expectedSig.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSig, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );
  } catch (_) {
    return false;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Strict edge no-cache headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-nowpayments-sig');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const parsedUrl = new URL(req.url || '', 'http://localhost');
  const pathname = parsedUrl.pathname || '';
  const query = req.query || Object.fromEntries(parsedUrl.searchParams.entries());
  const body = req.body || {};
  const action = String(query.action || body.action || '').trim().toLowerCase();

  const effectiveApiBase =
    (process.env.EXPO_PUBLIC_API_BASE || 'https://mws.wallpaperdomain.xyz').replace(/\/+$/, '');

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. GET PLANS: /api/subscription?action=plans or GET /api/subscription/plans
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'plans' || pathname.endsWith('/plans') || (!action && req.method === 'GET' && !query.action)) {
      return res.status(200).json({
        success: true,
        sandbox: IS_SANDBOX,
        plans: Object.values(SUBSCRIPTION_PLANS),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. GET STATUS: /api/subscription?action=status or GET /api/subscription/status
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'status' || pathname.endsWith('/status')) {
      const user = await authenticateUser(req, body, query);
      if (!user) {
        return res.status(200).json({
          success: true,
          authenticated: false,
          is_premium: false,
          message: 'Sign in to access your Ad-Free VIP membership.',
        });
      }

      try {
        const subRes = await ddbDoc.send(
          new GetCommand({
            TableName: SUBSCRIPTIONS_TABLE,
            Key: { userId: user.userId },
          })
        );

        const sub = subRes.Item;
        const now = Date.now();
        const isPremium = Boolean(
          sub &&
          sub.status === 'active' &&
          sub.expiresAtTimestamp &&
          sub.expiresAtTimestamp > now
        );

        const daysLeft = isPremium
          ? Math.max(1, Math.ceil((sub.expiresAtTimestamp - now) / (1000 * 60 * 60 * 24)))
          : 0;

        return res.status(200).json({
          success: true,
          authenticated: true,
          userId: user.userId,
          email: user.email,
          is_premium: isPremium,
          plan: isPremium ? sub.plan : null,
          plan_name: isPremium ? sub.planName : null,
          starts_at: isPremium ? sub.startsAt : null,
          expires_at: isPremium ? sub.expiresAt : null,
          expires_at_timestamp: isPremium ? sub.expiresAtTimestamp : null,
          days_left: daysLeft,
          sandbox: IS_SANDBOX,
        });
      } catch (ddbErr) {
        console.error('[Subscription Status Error]', ddbErr);
        return res.status(500).json({ error: 'Failed to read subscription status.' });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CREATE INVOICE: /api/subscription?action=create_invoice
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'create_invoice' || action === 'create-invoice' || pathname.endsWith('/create-invoice')) {
      const user = await authenticateUser(req, body, query);
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          detail: 'You must be logged in to purchase an ad-free subscription.',
        });
      }

      const planKey = String(body.plan || query.plan || '1_month').trim();
      const plan = SUBSCRIPTION_PLANS[planKey];
      if (!plan) {
        return res.status(400).json({
          error: 'Invalid plan selected.',
          availablePlans: Object.keys(SUBSCRIPTION_PLANS),
        });
      }

      const orderId = `mf_ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const callbackUrl = `${effectiveApiBase}/api/subscription?action=webhook`;
      const successUrl = `${effectiveApiBase}/?payment=success&order_id=${encodeURIComponent(orderId)}`;
      const cancelUrl = `${effectiveApiBase}/?payment=cancelled`;

      let invoiceId = null;
      let invoiceUrl = null;

      // Call NOWPayments API if API key is configured
      if (NOWPAYMENTS_API_KEY) {
        try {
          const npRes = await fetch(`${NOWPAYMENTS_BASE_URL}/invoice`, {
            method: 'POST',
            headers: {
              'x-api-key': NOWPAYMENTS_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              price_amount: plan.price,
              price_currency: 'usd',
              order_id: orderId,
              order_description: plan.description,
              ipn_callback_url: callbackUrl,
              success_url: successUrl,
              cancel_url: cancelUrl,
            }),
          });

          if (!npRes.ok) {
            const errText = await npRes.text().catch(() => '');
            console.error('[NOWPayments Invoice Error]', npRes.status, errText);
            return res.status(502).json({
              error: 'Failed to create payment invoice with NOWPayments.',
              detail: errText,
            });
          }

          const npData = await npRes.json();
          invoiceId = String(npData.id || '');
          invoiceUrl = npData.invoice_url;
        } catch (npFetchErr) {
          console.error('[NOWPayments Network Error]', npFetchErr);
          return res.status(502).json({
            error: 'Could not connect to NOWPayments gateway.',
            message: npFetchErr.message,
          });
        }
      } else {
        // In Sandbox / Test Mode when merchant key is not yet configured,
        // provide a sandbox test checkout url that allows simulating the webhook
        invoiceId = `sandbox_inv_${Date.now()}`;
        invoiceUrl = `${effectiveApiBase}/?sandbox_checkout=1&order_id=${encodeURIComponent(orderId)}&plan=${plan.id}`;
      }

      // Record order in DynamoDB with status: 'pending'
      try {
        await ddbDoc.send(
          new PutCommand({
            TableName: ORDERS_TABLE,
            Item: {
              orderId,
              userId: user.userId,
              userEmail: user.email,
              plan: plan.id,
              planName: plan.name,
              amount: plan.price,
              currency: plan.currency,
              durationDays: plan.durationDays,
              invoiceId: invoiceId || '',
              invoiceUrl: invoiceUrl || '',
              status: 'pending',
              isSandbox: IS_SANDBOX,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          })
        );
      } catch (ddbErr) {
        console.error('[DynamoDB Save Order Error]', ddbErr);
        return res.status(500).json({ error: 'Database error creating subscription order.' });
      }

      return res.status(200).json({
        success: true,
        orderId,
        invoiceId,
        invoiceUrl,
        plan: plan.id,
        planName: plan.name,
        amount: plan.price,
        currency: plan.currency,
        sandbox: IS_SANDBOX,
        hasLiveKey: Boolean(NOWPAYMENTS_API_KEY),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. IPN WEBHOOK: /api/subscription?action=webhook or POST /api/subscription/webhook
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'webhook' || pathname.endsWith('/webhook')) {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Webhooks require POST.' });
      }

      const payload = typeof body === 'object' && body !== null ? body : {};
      if (!payload || Object.keys(payload).length === 0) {
        return res.status(400).json({ error: 'Empty webhook payload.' });
      }

      // ─── Cryptographic Verification (HMAC-SHA512) ───
      // Strict rule: do not activate subscription unless verified by signature
      const isVerified = verifyIpnSignature(req, payload, NOWPAYMENTS_IPN_SECRET);
      if (!isVerified) {
        console.warn('[NOWPayments IPN] Invalid signature attempt rejected!');
        return res.status(400).json({
          error: 'Invalid IPN signature. Request rejected.',
        });
      }

      const {
        payment_id,
        payment_status,
        order_id,
        price_amount,
        pay_amount,
        pay_currency,
      } = payload;

      if (!order_id) {
        return res.status(400).json({ error: 'Missing order_id in IPN payload.' });
      }

      // Look up order in database
      let orderItem = null;
      try {
        const orderRes = await ddbDoc.send(
          new GetCommand({
            TableName: ORDERS_TABLE,
            Key: { orderId: String(order_id) },
          })
        );
        orderItem = orderRes.Item;
      } catch (e) {
        console.error('[NOWPayments IPN] Order lookup error:', e);
        return res.status(500).json({ error: 'Failed to lookup order in database.' });
      }

      if (!orderItem) {
        console.warn(`[NOWPayments IPN] Order ${order_id} not found in database.`);
        return res.status(404).json({ error: 'Order not found.' });
      }

      const normalizedStatus = String(payment_status || '').toLowerCase().trim();
      console.log(`[NOWPayments IPN] Order ${order_id}: status is "${normalizedStatus}"`);

      // We activate when payment is 'finished' or 'confirmed'
      if (normalizedStatus === 'finished' || normalizedStatus === 'confirmed') {
        const userId = orderItem.userId;
        const plan = SUBSCRIPTION_PLANS[orderItem.plan] || SUBSCRIPTION_PLANS['1_month'];

        // Check if user already has an active subscription to stack time
        let startTime = Date.now();
        try {
          const currentSubRes = await ddbDoc.send(
            new GetCommand({
              TableName: SUBSCRIPTIONS_TABLE,
              Key: { userId },
            })
          );
          const currentSub = currentSubRes.Item;
          if (
            currentSub &&
            currentSub.status === 'active' &&
            currentSub.expiresAtTimestamp &&
            currentSub.expiresAtTimestamp > startTime
          ) {
            // Stack on top of existing remaining time!
            startTime = currentSub.expiresAtTimestamp;
          }
        } catch (_) {}

        const expiresAtTimestamp = startTime + plan.durationMs;
        const expiresAt = new Date(expiresAtTimestamp).toISOString();

        // 1. Update / Insert Subscription Record in DynamoDB
        await ddbDoc.send(
          new PutCommand({
            TableName: SUBSCRIPTIONS_TABLE,
            Item: {
              userId,
              userEmail: orderItem.userEmail,
              status: 'active',
              plan: plan.id,
              planName: plan.name,
              amount: Number(price_amount) || plan.price,
              currency: 'USD',
              paymentId: String(payment_id || orderItem.invoiceId || ''),
              orderId: orderItem.orderId,
              payAmount: pay_amount || null,
              payCurrency: pay_currency || null,
              paymentStatus: normalizedStatus,
              isAutoRenew: false, // Strict requirement: non-recurring, user pays manually
              startsAt: new Date().toISOString(),
              expiresAt,
              expiresAtTimestamp,
              updatedAt: new Date().toISOString(),
            },
          })
        );

        // 2. Mark Order as Finished
        await ddbDoc.send(
          new UpdateCommand({
            TableName: ORDERS_TABLE,
            Key: { orderId: orderItem.orderId },
            UpdateExpression: 'SET #st = :st, paymentId = :pid, updatedAt = :u',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: {
              ':st': 'finished',
              ':pid': String(payment_id || ''),
              ':u': new Date().toISOString(),
            },
          })
        );

        console.log(`[NOWPayments IPN] Subscription activated for user ${userId} until ${expiresAt}!`);
        return res.status(200).json({
          success: true,
          message: 'Payment confirmed. Ad-Free subscription activated.',
          orderId: orderItem.orderId,
          userId,
          expiresAt,
        });
      }

      if (normalizedStatus === 'failed' || normalizedStatus === 'expired') {
        await ddbDoc.send(
          new UpdateCommand({
            TableName: ORDERS_TABLE,
            Key: { orderId: orderItem.orderId },
            UpdateExpression: 'SET #st = :st, updatedAt = :u',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: {
              ':st': normalizedStatus,
              ':u': new Date().toISOString(),
            },
          })
        );
        return res.status(200).json({
          success: true,
          message: `Order marked as ${normalizedStatus}.`,
        });
      }

      // For waiting, sending, confirming
      return res.status(200).json({
        success: true,
        message: `Status "${normalizedStatus}" acknowledged. Awaiting finished confirmation.`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. SANDBOX SIMULATOR: /api/subscription?action=sandbox_simulate
    // Allows testing the complete cryptographically signed IPN webhook in Sandbox mode
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'sandbox_simulate' || action === 'sandbox-simulate' || pathname.endsWith('/sandbox-simulate')) {
      if (!IS_SANDBOX) {
        return res.status(403).json({ error: 'Sandbox simulator is only available in sandbox mode.' });
      }

      const user = await authenticateUser(req, body, query);
      let targetOrderId = String(body.orderId || query.orderId || '').trim();
      let order = null;

      if (targetOrderId) {
        const orderRes = await ddbDoc.send(
          new GetCommand({
            TableName: ORDERS_TABLE,
            Key: { orderId: targetOrderId },
          })
        );
        order = orderRes.Item;
      }

      // If no order exists yet, auto-create one for instant testing
      if (!order) {
        const planId = String(body.planId || query.planId || '1_month').trim();
        const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS['1_month'];
        const simulatedUserId = (user?.userId || body.userId || query.userId || 'sandbox_test_user').toLowerCase().trim();
        const simulatedEmail = (user?.email || body.userEmail || query.userEmail || simulatedUserId).toLowerCase().trim();

        targetOrderId = `mf_ord_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        order = {
          orderId: targetOrderId,
          userId: simulatedUserId,
          userEmail: simulatedEmail,
          plan: plan.id,
          planName: plan.name,
          amount: plan.price,
          currency: 'USD',
          invoiceId: `sim_inv_${Date.now()}`,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await ddbDoc.send(
          new PutCommand({
            TableName: ORDERS_TABLE,
            Item: order,
          })
        );
      } else if (user && user.userId !== order.userId) {
        // Verify user owns order if authenticated
        return res.status(403).json({ error: 'You do not own this order.' });
      }

      // Build payload matching NOWPayments IPN specification
      const simulatedPayload = {
        payment_id: 8900000000 + Math.floor(Math.random() * 999999),
        invoice_id: order.invoiceId || 9900000000,
        payment_status: 'finished',
        pay_address: '0x71C...sandboxTestAddress',
        price_amount: order.amount,
        price_currency: 'usd',
        actual_amount: order.amount,
        actually_paid: order.amount,
        pay_amount: 0.000015,
        pay_currency: 'btc',
        order_id: order.orderId,
        order_description: `${order.planName} (Sandbox Simulation)`,
        purchase_id: `pur_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Compute official signature with the secret key
      const signature = computeIpnSignature(simulatedPayload, NOWPAYMENTS_IPN_SECRET);

      // Execute webhook flow with identical headers and validation!
      const mockWebhookReq = {
        headers: {
          'x-nowpayments-sig': signature,
          'content-type': 'application/json',
        },
      };

      const isSigValid = verifyIpnSignature(mockWebhookReq, simulatedPayload, NOWPAYMENTS_IPN_SECRET);
      if (!isSigValid) {
        return res.status(500).json({ error: 'Internal signature verification failed in sandbox.' });
      }

      // Activate subscription in DynamoDB
      const plan = SUBSCRIPTION_PLANS[order.plan] || SUBSCRIPTION_PLANS['1_month'];
      let startTime = Date.now();
      try {
        const currentSubRes = await ddbDoc.send(
          new GetCommand({
            TableName: SUBSCRIPTIONS_TABLE,
            Key: { userId: order.userId },
          })
        );
        const currentSub = currentSubRes.Item;
        if (
          currentSub &&
          currentSub.status === 'active' &&
          currentSub.expiresAtTimestamp &&
          currentSub.expiresAtTimestamp > startTime
        ) {
          startTime = currentSub.expiresAtTimestamp;
        }
      } catch (_) {}

      const expiresAtTimestamp = startTime + plan.durationMs;
      const expiresAt = new Date(expiresAtTimestamp).toISOString();

      await ddbDoc.send(
        new PutCommand({
          TableName: SUBSCRIPTIONS_TABLE,
          Item: {
            userId: order.userId,
            userEmail: order.userEmail,
            status: 'active',
            plan: plan.id,
            planName: plan.name,
            amount: plan.price,
            currency: 'USD',
            paymentId: String(simulatedPayload.payment_id),
            orderId: order.orderId,
            payAmount: simulatedPayload.pay_amount,
            payCurrency: simulatedPayload.pay_currency,
            paymentStatus: 'finished',
            isAutoRenew: false,
            isSandboxSimulation: true,
            startsAt: new Date().toISOString(),
            expiresAt,
            expiresAtTimestamp,
            updatedAt: new Date().toISOString(),
          },
        })
      );

      await ddbDoc.send(
        new UpdateCommand({
          TableName: ORDERS_TABLE,
          Key: { orderId: order.orderId },
          UpdateExpression: 'SET #st = :st, paymentId = :pid, updatedAt = :u',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: {
            ':st': 'finished',
            ':pid': String(simulatedPayload.payment_id),
            ':u': new Date().toISOString(),
          },
        })
      );

      return res.status(200).json({
        success: true,
        message: 'Sandbox payment simulation succeeded. Subscription is now ACTIVE in DynamoDB.',
        orderId: order.orderId,
        userId: order.userId,
        expiresAt,
        plan: plan.id,
        is_premium: true,
      });
    }

    // Default 404
    return res.status(404).json({ error: 'Subscription endpoint not found.' });
  } catch (err) {
    console.error('[Subscription API Error]', err);
    return res.status(500).json({ error: 'Internal subscription error', message: err.message });
  }
}
