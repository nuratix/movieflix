/**
 * NextViper 1.0 (Apex) Recommendation Service for Movieflix
 * Implements high-performance content-based and personalized vector similarity scoring
 * based on the NextViper Apex architecture specification.
 */

// 15 Standardized Genre & Theme Feature Dimensions
export const GENRE_FEATURES = [
  'action',
  'adventure',
  'animation',
  'anime',
  'comedy',
  'crime',
  'drama',
  'fantasy',
  'horror',
  'mystery',
  'romance',
  'sci-fi',
  'thriller',
  'series',
  'hindi',
];

/**
 * Convert a movie object to a 15-dimensional L2-normalized feature vector
 */
export function vectorizeMovie(movie) {
  if (!movie) return new Array(GENRE_FEATURES.length).fill(0);

  const vec = new Array(GENRE_FEATURES.length).fill(0);
  const rawGenre = [
    movie.genre || '',
    movie.category || '',
    movie.name || '',
    movie.title || '',
    movie.synopsis || '',
    Array.isArray(movie.tags) ? movie.tags.join(' ') : '',
  ]
    .join(' ')
    .toLowerCase();

  for (let k = 0; k < GENRE_FEATURES.length; k++) {
    const tag = GENRE_FEATURES[k];
    if (rawGenre.includes(tag)) {
      vec[k] = 1.0;
    }
  }

  // Anime heuristics
  if (
    rawGenre.includes('demon') ||
    rawGenre.includes('slayer') ||
    rawGenre.includes('naruto') ||
    rawGenre.includes('jojo') ||
    rawGenre.includes('kaisen') ||
    rawGenre.includes('attack on titan') ||
    rawGenre.includes('bleach')
  ) {
    vec[3] = 1.0; // anime
    vec[2] = 1.0; // animation
    vec[7] = 1.0; // fantasy
  }

  // Series indicator
  if (movie.isSeries || rawGenre.includes('series') || rawGenre.includes('season')) {
    vec[13] = 1.0;
  }

  // Bollywood / Hindi indicator
  if (rawGenre.includes('bollywood') || rawGenre.includes('hindi')) {
    vec[14] = 1.0;
  }

  // L2 Normalization
  let sumSq = 0;
  for (let j = 0; j < vec.length; j++) {
    sumSq += vec[j] * vec[j];
  }

  if (sumSq > 0) {
    const norm = Math.sqrt(sumSq);
    for (let j = 0; j < vec.length; j++) {
      vec[j] = vec[j] / norm;
    }
  }

  return vec;
}

/**
 * Compute Cosine Similarity between two L2-normalized vectors
 */
export function cosineSimilarity(v1, v2) {
  if (!v1 || !v2 || v1.length !== v2.length) return 0;
  let dot = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
  }
  return Math.max(0, Math.min(1, dot));
}

/**
 * Compute content similarity between a target movie and a candidate movie
 */
export function scoreContentSimilarity(targetMovie, candidateMovie) {
  if (!targetMovie || !candidateMovie) return -1;

  const targetSlug = targetMovie.slug || '';
  const candSlug = candidateMovie.slug || '';
  const targetId = String(targetMovie.subject_id || targetMovie.id || '');
  const candId = String(candidateMovie.subject_id || candidateMovie.id || '');

  // Exclude identical item
  if ((targetSlug && targetSlug === candSlug) || (targetId && targetId === candId)) {
    return -1;
  }

  const v1 = vectorizeMovie(targetMovie);
  const v2 = vectorizeMovie(candidateMovie);
  const sim = cosineSimilarity(v1, v2);

  // Quality rating weight (normalized 0..1)
  const rating = parseFloat(candidateMovie.rating) || 7.0;
  const ratingWeight = Math.min(10, Math.max(0, rating)) / 10.0;

  // Composite: 75% semantic vector match + 25% rating weight
  return sim * 0.75 + ratingWeight * 0.25;
}

/**
 * Compute user personalized affinity score based on watchHistory & myList
 */
export function scoreUserAffinity(userProfile, candidateMovie) {
  if (!candidateMovie) return 0;

  const candVec = vectorizeMovie(candidateMovie);
  const userVec = new Array(GENRE_FEATURES.length).fill(0);
  let totalWeight = 0;

  // 1. Accumulate weights from watch history
  const history = userProfile?.watchHistory || [];
  for (const item of history) {
    const hMovie = item?.movie || item;
    if (!hMovie) continue;
    const hVec = vectorizeMovie(hMovie);
    let w = 1.0;
    if (typeof item?.progress === 'number') {
      w = 0.5 + Math.min(1, item.progress) * 0.5;
    }
    for (let d = 0; d < userVec.length; d++) {
      userVec[d] += hVec[d] * w;
    }
    totalWeight += w;
  }

  // 2. Accumulate weights from user's watchlist (1.8x explicit bookmark intent)
  const listItems = userProfile?.myList || [];
  for (const item of listItems) {
    if (!item) continue;
    const lVec = vectorizeMovie(item);
    const w = 1.8;
    for (let d = 0; d < userVec.length; d++) {
      userVec[d] += lVec[d] * w;
    }
    totalWeight += w;
  }

  // If user has zero history/list, fallback to movie rating
  if (totalWeight === 0) {
    const rating = parseFloat(candidateMovie.rating) || 7.5;
    return (rating / 10.0) * 0.85;
  }

  // L2-Normalize user profile vector
  let sumSq = 0;
  for (let d = 0; d < userVec.length; d++) {
    userVec[d] /= totalWeight;
    sumSq += userVec[d] * userVec[d];
  }
  if (sumSq > 0) {
    const norm = Math.sqrt(sumSq);
    for (let d = 0; d < userVec.length; d++) {
      userVec[d] /= norm;
    }
  }

  const sim = cosineSimilarity(userVec, candVec);
  const rating = parseFloat(candidateMovie.rating) || 7.0;
  const ratingWeight = Math.min(10, Math.max(0, rating)) / 10.0;

  return sim * 0.80 + ratingWeight * 0.20;
}

/**
 * Get Content-Based Recommendations ("More Like This") for a specific movie
 */
export function getContentBasedRecommendations({ targetMovie, catalog = [], limit = 10 }) {
  if (!targetMovie || !Array.isArray(catalog) || catalog.length === 0) {
    return [];
  }

  const scored = [];
  const seen = new Set();
  const targetSlug = targetMovie.slug || '';
  const targetId = String(targetMovie.subject_id || targetMovie.id || '');
  if (targetSlug) seen.add(targetSlug);
  if (targetId) seen.add(targetId);

  for (const item of catalog) {
    if (!item) continue;
    const s = item.slug || '';
    const id = String(item.subject_id || item.id || '');
    if (s && seen.has(s)) continue;
    if (id && seen.has(id)) continue;

    const score = scoreContentSimilarity(targetMovie, item);
    if (score > 0) {
      if (s) seen.add(s);
      if (id) seen.add(id);
      scored.push({ movie: item, score });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.movie);
}

/**
 * Get Personalized Recommendations ("Recommended For You") tailored to user taste
 */
export function getPersonalizedRecommendations({ userProfile = {}, catalog = [], limit = 12 }) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return [];
  }

  const scored = [];
  const seen = new Set();

  // Deduplicate against items already in watchHistory
  const history = userProfile?.watchHistory || [];
  for (const h of history) {
    const m = h?.movie || h;
    if (m?.slug) seen.add(m.slug);
    if (m?.subject_id) seen.add(String(m.subject_id));
  }

  // Deduplicate against items already in user's saved myList
  const list = userProfile?.myList || [];
  for (const m of list) {
    if (m?.slug) seen.add(m.slug);
    if (m?.subject_id) seen.add(String(m.subject_id));
  }

  for (const item of catalog) {
    if (!item) continue;
    const s = item.slug || '';
    const id = String(item.subject_id || item.id || '');
    if (s && seen.has(s)) continue;
    if (id && seen.has(id)) continue;

    const score = scoreUserAffinity(userProfile, item);
    if (s) seen.add(s);
    if (id) seen.add(id);
    scored.push({ movie: item, score });
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.movie);
}
