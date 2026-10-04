import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

// ─── Security & JWT Helpers ──────────────────────────────────────────────────
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error('Server configuration error: JWT_SECRET environment variable is missing.');
    }
    return 'dev_secret_only_local_movieflix_2026';
  }
  return secret;
}
const ACCESS_TOKEN_HOURS = 2;
const REFRESH_TOKEN_DAYS = 30;

// Rate limiting for sensitive auth actions (login, register)
const authRateLimitMap = new Map();
const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_AUTH_ATTEMPTS_PER_WINDOW = 10;

// In-memory resilient store for shots likes (JavaScript backend)
const memoryLikes = new Map(); // shot_id -> Set of identifiers

function getMemoryLikesCount(shotId) {
  return memoryLikes.has(shotId) ? memoryLikes.get(shotId).size : 0;
}
function hasMemoryLiked(shotId, identifier) {
  return memoryLikes.has(shotId) ? memoryLikes.get(shotId).has(identifier) : false;
}
function addMemoryLike(shotId, identifier) {
  if (!memoryLikes.has(shotId)) memoryLikes.set(shotId, new Set());
  memoryLikes.get(shotId).add(identifier);
  return memoryLikes.get(shotId).size;
}
function removeMemoryLike(shotId, identifier) {
  if (memoryLikes.has(shotId)) {
    memoryLikes.get(shotId).delete(identifier);
    return memoryLikes.get(shotId).size;
  }
  return 0;
}

function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp.trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

function checkAuthRateLimit(ip) {
  const now = Date.now();
  const record = authRateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    authRateLimitMap.set(ip, { count: 1, resetTime: now + AUTH_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_AUTH_ATTEMPTS_PER_WINDOW) {
    return false;
  }
  record.count += 1;
  return true;
}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function createJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_HOURS * 3600;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signatureInput}.${signature}`;
}

function verifyJwt(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  let secret;
  try {
    secret = getJwtSecret();
  } catch (_) {
    return null;
  }
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (_) {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, originalHash] = stored.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(checkHash), Buffer.from(originalHash));
}

// ─── Neon DB Connection & Auto-Migration ─────────────────────────────────────
let tablesInitialized = false;

function getDb() {
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED;

  if (!dbUrl) {
    throw new Error('DATABASE_URL is not configured in environment variables.');
  }
  return neon(dbUrl);
}

async function ensureTables(sql) {
  if (tablesInitialized) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS mf_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS mf_refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES mf_users(id) ON DELETE CASCADE,
        token VARCHAR(512) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS mf_downloads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES mf_users(id) ON DELETE SET NULL,
        user_email VARCHAR(255) NOT NULL,
        version VARCHAR(50) DEFAULT '1.1.6',
        ip_address VARCHAR(100),
        user_agent TEXT,
        downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS mf_shots_likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES mf_users(id) ON DELETE CASCADE,
        shot_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_user_shot_like UNIQUE (user_id, shot_id)
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS mf_shots_guest_likes (
        id SERIAL PRIMARY KEY,
        guest_id VARCHAR(120) NOT NULL,
        shot_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_guest_shot_like UNIQUE (guest_id, shot_id)
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS mf_rate_limits (
        key VARCHAR(255) PRIMARY KEY,
        count INTEGER DEFAULT 1,
        reset_time BIGINT NOT NULL
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_mf_shots_likes_shot ON mf_shots_likes(shot_id);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_mf_shots_likes_user ON mf_shots_likes(user_id);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_mf_shots_guest_likes_shot ON mf_shots_guest_likes(shot_id);
    `;
    tablesInitialized = true;
  } catch (err) {
    console.error('Database migration/init error:', err);
  }
}

// ─── Durable Neon Rate Limiter ───────────────────────────────────────────────
async function checkDurableRateLimit(sql, key, maxAttempts, windowMs) {
  const now = Date.now();
  if (!sql) {
    return checkAuthRateLimit(key);
  }
  try {
    const rows = await sql`
      INSERT INTO mf_rate_limits (key, count, reset_time)
      VALUES (${key}, 1, ${now + windowMs})
      ON CONFLICT (key) DO UPDATE
      SET count = CASE
        WHEN mf_rate_limits.reset_time < ${now} THEN 1
        ELSE mf_rate_limits.count + 1
      END,
      reset_time = CASE
        WHEN mf_rate_limits.reset_time < ${now} THEN ${now + windowMs}
        ELSE mf_rate_limits.reset_time
      END
      RETURNING count, reset_time;
    `;
    const record = rows[0];
    if (record && record.count > maxAttempts) {
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[RateLimit] Durable check fallback to memory:', err.message);
    return checkAuthRateLimit(key);
  }
}

// ─── Main API Handler ────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://movieflix-pi-six.vercel.app',
  'https://netfilm.world',
  'http://localhost:8081',
  'http://localhost:3000',
  'http://localhost:19006',
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://movieflix-pi-six.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-App-Key'
  );
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let sql = null;
  try {
    sql = getDb();
    await ensureTables(sql);
  } catch (dbErr) {
    console.warn('Database connection notice:', dbErr?.message);
  }

  // Parse body safely (supports parsed JSON or raw string)
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }
  const query = req.query || {};
  const action = (body.action || query.action || '').toLowerCase();

  // If this action requires persistent database and DB is down, return 503
  const isShotLikeAction = ['batch-shot-likes', 'like-shot', 'unlike-shot', 'get-shot-likes'].includes(action);
  if (!sql && !isShotLikeAction) {
    return res.status(503).json({
      error: 'Database connection failed. Please try again later.',
    });
  }

  // 1. GET: Validate token & return user info (ONLY when action is 'me' or empty action on GET)
  if (action === 'me' || (req.method === 'GET' && !action)) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = verifyJwt(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid or expired token' });
    }
    return res.status(200).json({ status: 'success', user: { id: user.id, email: user.email } });
  }

  // 2. GET or POST: Retrieve likes count for a single shot
  if (action === 'get-shot-likes') {
    const shotId = String(body.shot_id || query.shot_id || '').trim();
    const authHeader = req.headers.authorization || body.token || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = verifyJwt(token);

    try {
      let userLiked = false;
      if (user && shotId) {
        const userCheck = await sql`
          SELECT 1 FROM mf_shots_likes WHERE user_id = ${user.id} AND shot_id = ${shotId} LIMIT 1
        `;
        userLiked = userCheck.length > 0;
      }

      const countRes = shotId ? await sql`
        SELECT COUNT(*)::int AS count FROM mf_shots_likes WHERE shot_id = ${shotId}
      ` : [{ count: 0 }];

      return res.status(200).json({
        status: 'success',
        shot_id: shotId,
        likes_count: countRes[0]?.count || 0,
        user_liked: userLiked,
      });
    } catch (err) {
      console.error('get-shot-likes error:', err);
      return res.status(500).json({ error: 'Failed to retrieve shot likes.' });
    }
  }

  // 3. GET or POST: Batch retrieve likes count for multiple shots
  if (action === 'batch-shot-likes') {
    const rawIds = body.shot_ids || query.shot_ids;
    let shotIds = [];
    if (Array.isArray(rawIds)) {
      shotIds = rawIds.map(String);
    } else if (typeof rawIds === 'string') {
      shotIds = rawIds.split(',').map((s) => s.trim()).filter(Boolean);
    }

    const authHeader = req.headers.authorization || body.token || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = verifyJwt(token);
    const guestId = String(body.device_id || query.device_id || getClientIp(req) || '').trim();

    try {
      let countsMap = {};
      let userLikedSet = [];

      if (shotIds.length > 0) {
        if (sql) {
          try {
            const rows = await sql`
              SELECT shot_id, COUNT(*)::int AS count
              FROM (
                SELECT shot_id FROM mf_shots_likes WHERE shot_id = ANY(${shotIds})
                UNION ALL
                SELECT shot_id FROM mf_shots_guest_likes WHERE shot_id = ANY(${shotIds})
              ) combined
              GROUP BY shot_id
            `;
            for (const r of rows) {
              countsMap[r.shot_id] = r.count;
            }
          } catch (_) {
            try {
              const rows = await sql`
                SELECT shot_id, COUNT(*)::int AS count
                FROM mf_shots_likes
                WHERE shot_id = ANY(${shotIds})
                GROUP BY shot_id
              `;
              for (const r of rows) {
                countsMap[r.shot_id] = r.count;
              }
            } catch (_) {}
          }
        }

        // Merge any in-memory store likes
        for (const sId of shotIds) {
          const memCount = getMemoryLikesCount(sId);
          if (memCount > 0) {
            countsMap[sId] = Math.max(countsMap[sId] || 0, memCount);
          }
        }

        const identifier = user ? `user:${user.id}` : (guestId ? `guest:${guestId}` : '');
        if (sql && user) {
          try {
            const userRows = await sql`
              SELECT shot_id
              FROM mf_shots_likes
              WHERE user_id = ${user.id} AND shot_id = ANY(${shotIds})
            `;
            userLikedSet = userRows.map((r) => r.shot_id);
          } catch (_) {}
        } else if (sql && guestId) {
          try {
            const guestRows = await sql`
              SELECT shot_id
              FROM mf_shots_guest_likes
              WHERE guest_id = ${guestId} AND shot_id = ANY(${shotIds})
            `;
            userLikedSet = guestRows.map((r) => r.shot_id);
          } catch (_) {}
        }

        if (identifier) {
          for (const sId of shotIds) {
            if (hasMemoryLiked(sId, identifier) && !userLikedSet.includes(sId)) {
              userLikedSet.push(sId);
            }
          }
        }
      }

      return res.status(200).json({
        status: 'success',
        counts: countsMap,
        user_liked_ids: userLikedSet,
      });
    } catch (err) {
      console.error('batch-shot-likes error:', err);
      return res.status(500).json({ error: 'Failed to batch retrieve likes.' });
    }
  }

  // POST Handlers
  if (req.method === 'POST') {
    const clientIp = getClientIp(req);

    // 1. REGISTER
    if (action === 'register') {
      const isAllowed = await checkDurableRateLimit(sql, `register:${clientIp}`, 5, 60000);
      if (!isAllowed) {
        return res.status(429).json({ error: 'Too many registration attempts. Please try again shortly.' });
      }

      const email = (body.email || '').trim().toLowerCase();
      const password = (body.password || '').trim();

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      }

      try {
        const existing = await sql`SELECT id FROM mf_users WHERE email = ${email} LIMIT 1`;
        if (existing.length > 0) {
          return res.status(409).json({ error: 'This email is already registered. Please sign in.' });
        }

        const passHash = hashPassword(password);
        const rows = await sql`
          INSERT INTO mf_users (email, password_hash)
          VALUES (${email}, ${passHash})
          RETURNING id, email
        `;
        const newUser = rows[0];

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 3600 * 1000);

        await sql`
          INSERT INTO mf_refresh_tokens (user_id, token, expires_at)
          VALUES (${newUser.id}, ${refreshToken}, ${expiresAt.toISOString()})
        `;

        const accessToken = createJwt({ id: newUser.id, email: newUser.email });

        return res.status(200).json({
          status: 'success',
          user: { id: newUser.id, email: newUser.email },
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: ACCESS_TOKEN_HOURS * 3600,
        });
      } catch (e) {
        console.error('Registration error:', e);
        return res.status(500).json({ error: 'Registration failed. Please try again.' });
      }
    }

    // 2. LOGIN
    if (action === 'login') {
      const isAllowed = await checkDurableRateLimit(sql, `login:${clientIp}`, 10, 60000);
      if (!isAllowed) {
        return res.status(429).json({ error: 'Too many login attempts. Please try again shortly.' });
      }

      const email = (body.email || '').trim().toLowerCase();
      const password = (body.password || '').trim();

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      try {
        const users = await sql`
          SELECT id, email, password_hash FROM mf_users WHERE email = ${email} LIMIT 1
        `;
        if (users.length === 0) {
          return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        const user = users[0];
        const match = verifyPassword(password, user.password_hash);
        if (!match) {
          return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        // Update last login
        await sql`UPDATE mf_users SET last_login = NOW() WHERE id = ${user.id}`;

        // Create new refresh token
        const refreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 3600 * 1000);

        await sql`
          INSERT INTO mf_refresh_tokens (user_id, token, expires_at)
          VALUES (${user.id}, ${refreshToken}, ${expiresAt.toISOString()})
        `;

        const accessToken = createJwt({ id: user.id, email: user.email });

        return res.status(200).json({
          status: 'success',
          user: { id: user.id, email: user.email },
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: ACCESS_TOKEN_HOURS * 3600,
        });
      } catch (e) {
        console.error('Login error:', e);
        return res.status(500).json({ error: 'Login failed. Please try again.' });
      }
    }

    // 3. REFRESH TOKEN
    if (action === 'refresh') {
      const refreshToken = body.refresh_token;
      if (!refreshToken) {
        return res.status(400).json({ error: 'refresh_token is required.' });
      }

      try {
        const rows = await sql`
          SELECT r.id, r.user_id, r.expires_at, u.email
          FROM mf_refresh_tokens r
          JOIN mf_users u ON r.user_id = u.id
          WHERE r.token = ${refreshToken}
          LIMIT 1
        `;

        if (rows.length === 0) {
          return res.status(401).json({ error: 'Invalid refresh token.' });
        }

        const record = rows[0];
        if (new Date(record.expires_at) < new Date()) {
          await sql`DELETE FROM mf_refresh_tokens WHERE id = ${record.id}`;
          return res.status(401).json({ error: 'Refresh token has expired. Please sign in again.' });
        }

        // Rotate token
        const newRefreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 3600 * 1000);

        await sql`
          UPDATE mf_refresh_tokens
          SET token = ${newRefreshToken}, expires_at = ${expiresAt.toISOString()}
          WHERE id = ${record.id}
        `;

        const accessToken = createJwt({ id: record.user_id, email: record.email });

        return res.status(200).json({
          status: 'success',
          user: { id: record.user_id, email: record.email },
          access_token: accessToken,
          refresh_token: newRefreshToken,
          expires_in: ACCESS_TOKEN_HOURS * 3600,
        });
      } catch (e) {
        console.error('Refresh error:', e);
        return res.status(500).json({ error: 'Token refresh failed.' });
      }
    }

    // 4. LOGOUT
    if (action === 'logout') {
      const refreshToken = body.refresh_token;
      if (refreshToken) {
        try {
          await sql`DELETE FROM mf_refresh_tokens WHERE token = ${refreshToken}`;
        } catch (_) {}
      }
      return res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
    }

    // 5. SHOTS LIKES SYSTEM (JavaScript Backend: Real-time Neon Database + In-Memory Fallback)
    if (action === 'like-shot') {
      const authHeader = req.headers.authorization || body.token || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const user = verifyJwt(token);
      const guestId = String(body.device_id || getClientIp(req) || '').trim();

      const shotId = String(body.shot_id || body.shotId || '').trim();
      if (!shotId) {
        return res.status(400).json({ error: 'shot_id is required.' });
      }

      try {
        const identifier = user ? `user:${user.id}` : (guestId ? `guest:${guestId}` : '');
        let currentCount = 1;
        if (identifier) {
          currentCount = addMemoryLike(shotId, identifier);
        }

        if (sql) {
          try {
            if (user) {
              await sql`
                INSERT INTO mf_shots_likes (user_id, shot_id)
                VALUES (${user.id}, ${shotId})
                ON CONFLICT (user_id, shot_id) DO NOTHING
              `;
            } else if (guestId) {
              await sql`
                INSERT INTO mf_shots_guest_likes (guest_id, shot_id)
                VALUES (${guestId}, ${shotId})
                ON CONFLICT (guest_id, shot_id) DO NOTHING
              `;
            }

            const countRes = await sql`
              SELECT COUNT(*)::int AS count
              FROM (
                SELECT shot_id FROM mf_shots_likes WHERE shot_id = ${shotId}
                UNION ALL
                SELECT shot_id FROM mf_shots_guest_likes WHERE shot_id = ${shotId}
              ) combined
            `;
            if (countRes && countRes[0]?.count) {
              currentCount = Math.max(currentCount, countRes[0].count);
            }
          } catch (_) {}
        }

        return res.status(200).json({
          status: 'success',
          liked: true,
          shot_id: shotId,
          likes_count: currentCount,
        });
      } catch (err) {
        console.error('like-shot error:', err);
        return res.status(500).json({ error: 'Failed to record like.' });
      }
    }

    if (action === 'unlike-shot') {
      const authHeader = req.headers.authorization || body.token || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const user = verifyJwt(token);
      const guestId = String(body.device_id || getClientIp(req) || '').trim();

      const shotId = String(body.shot_id || body.shotId || '').trim();
      if (!shotId) {
        return res.status(400).json({ error: 'shot_id is required.' });
      }

      try {
        const identifier = user ? `user:${user.id}` : (guestId ? `guest:${guestId}` : '');
        let currentCount = 0;
        if (identifier) {
          currentCount = removeMemoryLike(shotId, identifier);
        }

        if (sql) {
          try {
            if (user) {
              await sql`
                DELETE FROM mf_shots_likes
                WHERE user_id = ${user.id} AND shot_id = ${shotId}
              `;
            } else if (guestId) {
              await sql`
                DELETE FROM mf_shots_guest_likes
                WHERE guest_id = ${guestId} AND shot_id = ${shotId}
              `;
            }

            const countRes = await sql`
              SELECT COUNT(*)::int AS count
              FROM (
                SELECT shot_id FROM mf_shots_likes WHERE shot_id = ${shotId}
                UNION ALL
                SELECT shot_id FROM mf_shots_guest_likes WHERE shot_id = ${shotId}
              ) combined
            `;
            if (countRes && countRes[0]?.count !== undefined) {
              currentCount = countRes[0].count;
            }
          } catch (_) {}
        }

        return res.status(200).json({
          status: 'success',
          liked: false,
          shot_id: shotId,
          likes_count: currentCount,
        });
      } catch (err) {
        console.error('unlike-shot error:', err);
        return res.status(500).json({ error: 'Failed to remove like.' });
      }
    }
  }

  return res.status(400).json({ error: 'Invalid request or action' });
}
