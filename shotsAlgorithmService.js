/**
 * NextViper 1.0 (Apex) Shots Feed Algorithm (JavaScript Engine)
 * Mirrors /root/reel-app/backend-nextviper/shots_algorithm.nv
 * Provides vectorized affinity matching, session novelty decay, and Instagram-style feed ranking.
 */

export const SHOT_FEATURES = [
  'romance',
  'billionaire',
  'ceo',
  'revenge',
  'drama',
  'thriller',
  'action',
  'fantasy',
  'mystery',
  'comedy',
  'suspense',
  'urban',
];

export function vectorizeShot(item) {
  if (!item) return new Array(SHOT_FEATURES.length).fill(0);
  const vec = new Array(SHOT_FEATURES.length).fill(0);

  const text = [
    item.title || item.name || '',
    item.author || '',
    item.slug || '',
    item.category || '',
    item.description || item.synopsis || '',
  ]
    .join(' ')
    .toLowerCase();

  for (let k = 0; k < SHOT_FEATURES.length; k++) {
    const tag = SHOT_FEATURES[k];
    if (text.includes(tag)) {
      vec[k] = 1.0;
    }
  }

  // Short-drama specific keyword ontology
  if (text.includes('boss') || text.includes('president') || text.includes('contract')) {
    vec[1] = 1.0; // billionaire
    vec[2] = 1.0; // ceo
    vec[0] = 1.0; // romance
  }
  if (text.includes('divorce') || text.includes('betray') || text.includes('strike back')) {
    vec[3] = 1.0; // revenge
    vec[4] = 1.0; // drama
  }
  if (text.includes('love') || text.includes('bride') || text.includes('marriage')) {
    vec[0] = 1.0; // romance
  }

  // L2 Normalization
  let sumSq = 0;
  for (let j = 0; j < vec.length; j++) {
    sumSq += vec[j] * vec[j];
  }
  if (sumSq > 0) {
    const norm = Math.sqrt(sumSq);
    for (let j = 0; j < vec.length; j++) {
      vec[j] /= norm;
    }
  }

  return vec;
}

export function cosineSimilarity(v1, v2) {
  if (!v1 || !v2 || v1.length !== v2.length) return 0;
  let dot = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
  }
  return dot;
}

export function buildUserInterestVector(likedItems = [], watchedItems = []) {
  const profile = new Array(SHOT_FEATURES.length).fill(0);
  let totalW = 0;

  for (const item of likedItems) {
    const v = vectorizeShot(item);
    for (let i = 0; i < profile.length; i++) {
      profile[i] += v[i] * 2.5; // Likes provide strong positive signal
    }
    totalW += 2.5;
  }

  for (const item of watchedItems) {
    const v = vectorizeShot(item);
    for (let i = 0; i < profile.length; i++) {
      profile[i] += v[i] * 1.0; // Watches provide baseline interest
    }
    totalW += 1.0;
  }

  if (totalW > 0) {
    let sumSq = 0;
    for (let j = 0; j < profile.length; j++) {
      sumSq += profile[j] * profile[j];
    }
    if (sumSq > 0) {
      const norm = Math.sqrt(sumSq);
      for (let j = 0; j < profile.length; j++) {
        profile[j] /= norm;
      }
    }
  }

  return profile;
}

/**
 * Rank shots feed:
 * 1. Filters out seen items or places them at the end.
 * 2. Scores candidates based on cosine similarity with user profile vector.
 * 3. Adds deterministic pseudo-random exploration factor using sessionSeed so every load is fresh.
 */
export function rankShotsFeed(candidates = [], userProfileVec = null, seenIds = new Set(), sessionSeed = Date.now()) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const effectiveProfile = userProfileVec || new Array(SHOT_FEATURES.length).fill(1 / Math.sqrt(SHOT_FEATURES.length));

  const scored = candidates.map((shot, idx) => {
    const rawId = String(shot.subject_id || shot.id || '');
    const isSeen = seenIds.has(rawId);

    const shotVec = vectorizeShot(shot);
    const sim = cosineSimilarity(effectiveProfile, shotVec);

    // Instagram-style pseudo-random exploration noise (keeps the feed non-identical every time)
    const exploration = Math.sin(idx * 23.45 + (sessionSeed % 10000)) * 0.22;

    // Episode bonus
    const epBonus = (shot.total_episodes && shot.total_episodes > 1) ? 0.15 : 0.05;

    // Seen penalty to guarantee new content
    const penalty = isSeen ? 3.0 : 0.0;

    const score = (sim * 0.6) + epBonus + exploration - penalty;

    return {
      shot,
      score,
      isSeen,
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.shot);
}
