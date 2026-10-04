-- =============================================================================
-- MOVIEFLIX NEON DATABASE - OFFICIAL SHOTS LIKES SYSTEM DDL & QUERIES
-- =============================================================================
-- Database: Neon Serverless PostgreSQL (PostgreSQL 14+)
-- Purpose: Real authentic likes for 9:16 vertical drama shots
-- Rule: Only logged-in users (mf_users) can like; 1 like per user per shot
--
-- Instructions:
-- 1. Open Neon Console (https://console.neon.tech).
-- 2. Select your MovieFlix project.
-- 3. Click "SQL Editor" in the left navigation sidebar.
-- 4. Paste and Run the script below.
-- =============================================================================

BEGIN;

-- 1. Table for real user likes on Shots
CREATE TABLE IF NOT EXISTS mf_shots_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES mf_users(id) ON DELETE CASCADE,
    shot_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_shot_like UNIQUE (user_id, shot_id)
);

-- 2. High-performance lookup indexes
CREATE INDEX IF NOT EXISTS idx_mf_shots_likes_shot ON mf_shots_likes(shot_id);
CREATE INDEX IF NOT EXISTS idx_mf_shots_likes_user ON mf_shots_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_mf_shots_likes_created ON mf_shots_likes(created_at DESC);

COMMIT;

-- =============================================================================
-- REAL-TIME PRODUCTION QUERIES:
-- =============================================================================

-- Query 1: Total count of real likes for a specific shot (e.g. shot '8283828')
-- Replace '8283828' with any shot id or subject_id
SELECT 
    shot_id,
    COUNT(*)::INTEGER AS real_likes_count
FROM mf_shots_likes
WHERE shot_id = '8283828'
GROUP BY shot_id;

-- Query 2: Leaderboard of top 20 most-liked shots
SELECT 
    shot_id,
    COUNT(*)::INTEGER AS total_likes,
    MIN(created_at) AS first_like_at,
    MAX(created_at) AS latest_like_at
FROM mf_shots_likes
GROUP BY shot_id
ORDER BY total_likes DESC
LIMIT 20;

-- Query 3: Check if a logged-in user (e.g. user_id = 1) has liked a shot
SELECT EXISTS (
    SELECT 1 FROM mf_shots_likes 
    WHERE user_id = 1 AND shot_id = '8283828'
) AS is_liked_by_user;
