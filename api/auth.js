import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
  GetUserCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

// ─── AWS Clients & Configuration ─────────────────────────────────────────────
const AWS_REGION = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'ap-southeast-2';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_u439PunGB';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || 'ohrgclhcm98kbrimrtttss2a4';

const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });
const rawDdbClient = new DynamoDBClient({ region: AWS_REGION });
const ddbDoc = DynamoDBDocumentClient.from(rawDdbClient);

const WATCHLIST_TABLE = process.env.DYNAMODB_WATCHLIST_TABLE || 'movieflix_watchlist';
const HISTORY_TABLE = process.env.DYNAMODB_HISTORY_TABLE || 'movieflix_watch_history';

// ─── Rate Limiting for Auth ──────────────────────────────────────────────────
const authRateLimitMap = new Map();
const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_AUTH_ATTEMPTS = 15;

function getClientIp(req) {
  const realIp = req.headers?.['x-real-ip'];
  if (realIp && typeof realIp === 'string') return realIp.trim();
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '127.0.0.1';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = authRateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    authRateLimitMap.set(ip, { count: 1, resetTime: now + AUTH_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_AUTH_ATTEMPTS) {
    return false;
  }
  record.count += 1;
  return true;
}

// ─── Token Verification (AWS Cognito) ────────────────────────────────────────
async function authenticateUser(req, body = {}, query = {}) {
  const authHeader = req.headers?.authorization || body?.token || query?.token || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const res = await cognitoClient.send(new GetUserCommand({ AccessToken: token }));
    const emailAttr = res.UserAttributes?.find((a) => a.Name === 'email');
    const email = emailAttr?.Value || res.Username;
    return {
      userId: email.toLowerCase(),
      username: res.Username,
      email: email.toLowerCase(),
      attributes: res.UserAttributes,
    };
  } catch (err) {
    // Also support decoding payload if token is valid Cognito ID token
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
          const email = (payload.email || payload['cognito:username'] || payload.sub || '').toLowerCase();
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

// ─── Shots Likes Store (In-Memory Resilient Store) ───────────────────────────
const memoryLikes = new Map();
function getMemoryLikesCount(shotId) {
  return memoryLikes.has(shotId) ? memoryLikes.get(shotId).size : 0;
}
function hasMemoryLiked(shotId, id) {
  return memoryLikes.has(shotId) ? memoryLikes.get(shotId).has(id) : false;
}
function addMemoryLike(shotId, id) {
  if (!memoryLikes.has(shotId)) memoryLikes.set(shotId, new Set());
  memoryLikes.get(shotId).add(id);
  return memoryLikes.get(shotId).size;
}
function removeMemoryLike(shotId, id) {
  if (memoryLikes.has(shotId)) {
    memoryLikes.get(shotId).delete(id);
    return memoryLikes.get(shotId).size;
  }
  return 0;
}

// ─── CORS Configuration ──────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://mws.wallpaperdomain.xyz',
  'https://netfilm.world',
  'https://mws.wallpaperdomain.xyz',
  'http://mws.wallpaperdomain.xyz',
  'http://localhost:8081',
  'http://localhost:3000',
  'http://localhost:19006',
]);

function setCorsHeaders(req, res) {
  const origin = req.headers?.origin;
  if (origin && (ALLOWED_ORIGINS.has(origin) || origin.includes('wallpaperdomain.xyz'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-App-Key'
  );
}

// ─── Main Handler ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }
  const query = req.query || {};
  const action = (body.action || query.action || '').toLowerCase();
  const clientIp = getClientIp(req);

  // 1. GET: Validate session & return user info
  if (action === 'me' || (req.method === 'GET' && !action)) {
    const user = await authenticateUser(req, body, query);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid or expired AWS session' });
    }
    return res.status(200).json({
      status: 'success',
      user: { id: user.userId, email: user.email },
    });
  }

  // 2. WATCHLIST: GET (Only authenticated user can see their own saved movies)
  if (action === 'get-watchlist') {
    const user = await authenticateUser(req, body, query);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Please sign in to access your saved movies.' });
    }

    try {
      const qRes = await ddbDoc.send(
        new QueryCommand({
          TableName: WATCHLIST_TABLE,
          KeyConditionExpression: 'userId = :uid',
          ExpressionAttributeValues: { ':uid': user.userId },
        })
      );
      const items = (qRes.Items || []).sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
      return res.status(200).json({ status: 'success', watchlist: items });
    } catch (err) {
      console.error('DynamoDB get-watchlist error:', err);
      return res.status(500).json({ error: 'Failed to retrieve saved movies.' });
    }
  }

  // 3. WATCHLIST: TOGGLE / SAVE
  if (action === 'toggle-watchlist' || action === 'save-watchlist') {
    const user = await authenticateUser(req, body, query);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Please sign in to save movies.' });
    }

    const movie = body.movie || body;
    const movieId = String(movie.slug || movie.subject_id || body.movieId || '').trim();
    if (!movieId) {
      return res.status(400).json({ error: 'Missing movie identifier (slug or subject_id).' });
    }

    try {
      // Check if already in watchlist
      const existing = await ddbDoc.send(
        new GetCommand({
          TableName: WATCHLIST_TABLE,
          Key: { userId: user.userId, movieId },
        })
      );

      let isAdded = false;
      if (existing.Item && action === 'toggle-watchlist') {
        // Remove
        await ddbDoc.send(
          new DeleteCommand({
            TableName: WATCHLIST_TABLE,
            Key: { userId: user.userId, movieId },
          })
        );
        isAdded = false;
      } else {
        // Add
        const item = {
          userId: user.userId,
          movieId,
          name: movie.name || '',
          slug: movie.slug || '',
          subject_id: movie.subject_id || '',
          poster_url: movie.poster_url || '',
          rating: movie.rating || null,
          year: movie.year || null,
          badge: movie.badge || null,
          isSeries: Boolean(movie.isSeries),
          addedAt: new Date().toISOString(),
        };
        await ddbDoc.send(
          new PutCommand({
            TableName: WATCHLIST_TABLE,
            Item: item,
          })
        );
        isAdded = true;
      }

      // Return updated list
      const updated = await ddbDoc.send(
        new QueryCommand({
          TableName: WATCHLIST_TABLE,
          KeyConditionExpression: 'userId = :uid',
          ExpressionAttributeValues: { ':uid': user.userId },
        })
      );
      const items = (updated.Items || []).sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));

      return res.status(200).json({
        status: 'success',
        isAdded,
        watchlist: items,
      });
    } catch (err) {
      console.error('DynamoDB toggle-watchlist error:', err);
      return res.status(500).json({ error: 'Failed to update saved movies list.' });
    }
  }

  // 4. WATCHLIST: REMOVE
  if (action === 'remove-watchlist') {
    const user = await authenticateUser(req, body, query);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const movieId = String(body.movieId || body.slug || query.movieId || '').trim();
    if (!movieId) {
      return res.status(400).json({ error: 'Missing movieId to remove.' });
    }

    try {
      await ddbDoc.send(
        new DeleteCommand({
          TableName: WATCHLIST_TABLE,
          Key: { userId: user.userId, movieId },
        })
      );
      return res.status(200).json({ status: 'success', message: 'Movie removed from saved list.' });
    } catch (err) {
      console.error('DynamoDB remove-watchlist error:', err);
      return res.status(500).json({ error: 'Failed to remove movie from list.' });
    }
  }

  // 5. WATCH HISTORY: GET (Only authenticated user can see their own history)
  if (action === 'get-history') {
    const user = await authenticateUser(req, body, query);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Please sign in to access watch history.' });
    }

    try {
      const qRes = await ddbDoc.send(
        new QueryCommand({
          TableName: HISTORY_TABLE,
          KeyConditionExpression: 'userId = :uid',
          ExpressionAttributeValues: { ':uid': user.userId },
        })
      );
      const items = (qRes.Items || [])
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .slice(0, 100);

      return res.status(200).json({ status: 'success', history: items });
    } catch (err) {
      console.error('DynamoDB get-history error:', err);
      return res.status(500).json({ error: 'Failed to retrieve watch history.' });
    }
  }

  // 6. WATCH HISTORY: SAVE PROGRESS
  if (action === 'save-progress') {
    const user = await authenticateUser(req, body, query);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const movie = body.movie || {};
    const movieId = movie.slug || movie.subject_id || body.movieId;
    if (!movieId) {
      return res.status(400).json({ error: 'Missing movie details' });
    }

    const se = Number(body.se) || 0;
    const ep = Number(body.ep) || 0;
    const positionMillis = Math.round(Number(body.positionMillis) || 0);
    const durationMillis = Math.round(Number(body.durationMillis) || 0);
    const progressPercent =
      durationMillis > 0
        ? Math.min(100, Math.max(1, Math.round((positionMillis / durationMillis) * 100)))
        : 0;

    const historyId = `${movieId}_s${se}_e${ep}`;
    const entry = {
      userId: user.userId,
      historyId,
      id: historyId,
      movie: {
        name: movie.name || 'Untitled Title',
        slug: movie.slug || '',
        subject_id: movie.subject_id || '',
        poster_url: movie.poster_url || '',
      },
      isSeries: Boolean(body.isSeries),
      se,
      ep,
      positionMillis,
      durationMillis,
      progressPercent,
      updatedAt: new Date().toISOString(),
    };

    try {
      await ddbDoc.send(
        new PutCommand({
          TableName: HISTORY_TABLE,
          Item: entry,
        })
      );
      return res.status(200).json({ status: 'success', entry });
    } catch (err) {
      console.error('DynamoDB save-progress error:', err);
      return res.status(500).json({ error: 'Failed to save watch progress.' });
    }
  }

  // 7. WATCH HISTORY: REMOVE ITEM
  if (action === 'remove-history') {
    const user = await authenticateUser(req, body, query);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const historyId = String(body.id || body.historyId || query.id || '').trim();
    if (!historyId) return res.status(400).json({ error: 'Missing history id to remove.' });

    try {
      await ddbDoc.send(
        new DeleteCommand({
          TableName: HISTORY_TABLE,
          Key: { userId: user.userId, historyId },
        })
      );
      return res.status(200).json({ status: 'success', message: 'History item removed.' });
    } catch (err) {
      console.error('DynamoDB remove-history error:', err);
      return res.status(500).json({ error: 'Failed to remove history item.' });
    }
  }

  // 8. WATCH HISTORY: CLEAR ALL
  if (action === 'clear-history') {
    const user = await authenticateUser(req, body, query);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const qRes = await ddbDoc.send(
        new QueryCommand({
          TableName: HISTORY_TABLE,
          KeyConditionExpression: 'userId = :uid',
          ExpressionAttributeValues: { ':uid': user.userId },
        })
      );
      const items = qRes.Items || [];
      if (items.length > 0) {
        const deleteRequests = items.map((it) => ({
          DeleteRequest: { Key: { userId: user.userId, historyId: it.historyId } },
        }));
        // Batch in groups of 25
        for (let i = 0; i < deleteRequests.length; i += 25) {
          await ddbDoc.send(
            new BatchWriteCommand({
              RequestItems: {
                [HISTORY_TABLE]: deleteRequests.slice(i, i + 25),
              },
            })
          );
        }
      }
      return res.status(200).json({ status: 'success', message: 'History cleared.' });
    } catch (err) {
      console.error('DynamoDB clear-history error:', err);
      return res.status(500).json({ error: 'Failed to clear watch history.' });
    }
  }

  // ─── POST Auth Handlers (AWS Cognito) ────────────────────────────────────────
  if (req.method === 'POST') {
    // 9. AWS REGISTER
    if (action === 'register') {
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many attempts. Please try again shortly.' });
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
        // Create user in AWS Cognito User Pool with email verified
        await cognitoClient.send(
          new AdminCreateUserCommand({
            UserPoolId: COGNITO_USER_POOL_ID,
            Username: email,
            UserAttributes: [
              { Name: 'email', Value: email },
              { Name: 'email_verified', Value: 'true' },
            ],
            MessageAction: 'SUPPRESS',
          })
        );

        // Set permanent password
        await cognitoClient.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: COGNITO_USER_POOL_ID,
            Username: email,
            Password: password,
            Permanent: true,
          })
        );

        // Authenticate immediately
        const authRes = await cognitoClient.send(
          new InitiateAuthCommand({
            ClientId: COGNITO_CLIENT_ID,
            AuthFlow: 'USER_PASSWORD_AUTH',
            AuthParameters: {
              USERNAME: email,
              PASSWORD: password,
            },
          })
        );

        const result = authRes.AuthenticationResult;
        return res.status(200).json({
          status: 'success',
          user: { id: email, email },
          access_token: result.AccessToken,
          refresh_token: result.RefreshToken,
          id_token: result.IdToken,
          expires_in: result.ExpiresIn || 3600,
        });
      } catch (err) {
        console.error('AWS Cognito Registration Error:', err);
        if (err.name === 'UsernameExistsException') {
          return res.status(409).json({ error: 'This email is already registered. Please sign in.' });
        }
        if (err.name === 'InvalidPasswordException') {
          return res.status(400).json({ error: err.message || 'Password does not meet requirements.' });
        }
        return res.status(500).json({ error: err.message || 'Registration failed. Please try again.' });
      }
    }

    // 10. AWS LOGIN
    if (action === 'login') {
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many login attempts. Please wait a moment.' });
      }

      const email = (body.email || '').trim().toLowerCase();
      const password = (body.password || '').trim();

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      try {
        const authRes = await cognitoClient.send(
          new InitiateAuthCommand({
            ClientId: COGNITO_CLIENT_ID,
            AuthFlow: 'USER_PASSWORD_AUTH',
            AuthParameters: {
              USERNAME: email,
              PASSWORD: password,
            },
          })
        );

        const result = authRes.AuthenticationResult;
        return res.status(200).json({
          status: 'success',
          user: { id: email, email },
          access_token: result.AccessToken,
          refresh_token: result.RefreshToken,
          id_token: result.IdToken,
          expires_in: result.ExpiresIn || 3600,
        });
      } catch (err) {
        console.error('AWS Cognito Login Error:', err);
        if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
          return res.status(401).json({ error: 'Incorrect email or password.' });
        }
        if (err.name === 'UserNotConfirmedException') {
          return res.status(403).json({ error: 'Account not confirmed. Please check your email.' });
        }
        return res.status(500).json({ error: err.message || 'Login failed. Please try again.' });
      }
    }

    // 11. AWS REFRESH TOKEN
    if (action === 'refresh') {
      const refreshToken = body.refresh_token;
      if (!refreshToken) {
        return res.status(400).json({ error: 'refresh_token is required.' });
      }

      try {
        const authRes = await cognitoClient.send(
          new InitiateAuthCommand({
            ClientId: COGNITO_CLIENT_ID,
            AuthFlow: 'REFRESH_TOKEN_AUTH',
            AuthParameters: {
              REFRESH_TOKEN: refreshToken,
            },
          })
        );

        const result = authRes.AuthenticationResult;
        let userInfo = null;
        try {
          if (result.IdToken) {
            const parts = result.IdToken.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
              const email = (payload.email || payload['cognito:username'] || payload.sub || '').toLowerCase();
              if (email) {
                userInfo = { id: email, email };
              }
            }
          }
        } catch (_) {}

        return res.status(200).json({
          status: 'success',
          access_token: result.AccessToken,
          refresh_token: result.RefreshToken || refreshToken,
          id_token: result.IdToken,
          expires_in: result.ExpiresIn || 3600,
          user: userInfo,
        });
      } catch (err) {
        console.error('AWS Cognito Refresh Error:', err);
        return res.status(401).json({ error: 'Token refresh failed. Please sign in again.' });
      }
    }

    // 12. AWS LOGOUT
    if (action === 'logout') {
      const token = (body.access_token || req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (token) {
        try {
          await cognitoClient.send(new GlobalSignOutCommand({ AccessToken: token }));
        } catch (_) {}
      }
      return res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
    }

    // 13. SHOTS LIKES SYSTEM
    if (action === 'like-shot') {
      const shotId = String(body.shot_id || body.shotId || '').trim();
      const identifier = String(body.device_id || clientIp).trim();
      if (!shotId) return res.status(400).json({ error: 'Missing shot_id' });
      const likesCount = addMemoryLike(shotId, identifier);
      return res.status(200).json({ status: 'success', liked: true, likes_count: likesCount });
    }

    if (action === 'unlike-shot') {
      const shotId = String(body.shot_id || body.shotId || '').trim();
      const identifier = String(body.device_id || clientIp).trim();
      if (!shotId) return res.status(400).json({ error: 'Missing shot_id' });
      const likesCount = removeMemoryLike(shotId, identifier);
      return res.status(200).json({ status: 'success', liked: false, likes_count: likesCount });
    }

    if (action === 'get-shot-likes') {
      const shotId = String(body.shot_id || query.shot_id || '').trim();
      const identifier = String(body.device_id || clientIp).trim();
      const likesCount = getMemoryLikesCount(shotId);
      const userLiked = hasMemoryLiked(shotId, identifier);
      return res.status(200).json({ status: 'success', likes_count: likesCount, user_liked: userLiked });
    }

    if (action === 'batch-shot-likes') {
      const idsRaw = body.shot_ids || query.shot_ids || '';
      const shotIds = Array.isArray(idsRaw) ? idsRaw : String(idsRaw).split(',').filter(Boolean);
      const identifier = String(body.device_id || clientIp).trim();
      const countsMap = {};
      const userLikedSet = [];
      for (const id of shotIds) {
        countsMap[id] = getMemoryLikesCount(id);
        if (hasMemoryLiked(id, identifier)) userLikedSet.push(id);
      }
      return res.status(200).json({ status: 'success', counts: countsMap, user_liked_ids: userLikedSet });
    }
  }

  return res.status(400).json({ error: `Unknown or unhandled action: '${action}'` });
}
