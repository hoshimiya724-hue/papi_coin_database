-- ============================================================
-- ツムツム コイン稼ぎ効率トラッカー 初期スキーマ
-- ============================================================

-- シリーズ（登場作品）テーブル
CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0
);

-- ツムマスターテーブル
CREATE TABLE IF NOT EXISTS tsums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  max_skill_level INTEGER NOT NULL DEFAULT 6,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (series_id) REFERENCES series(id)
);

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  pin_hash TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- コイン稼ぎセッション記録テーブル
CREATE TABLE IF NOT EXISTS coin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tsum_id INTEGER NOT NULL,
  skill_level INTEGER NOT NULL,
  coins_before INTEGER NOT NULL,
  coins_after INTEGER NOT NULL,
  coins_earned INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tsum_id) REFERENCES tsums(id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_coin_sessions_user_id ON coin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_sessions_tsum_id ON coin_sessions(tsum_id);
CREATE INDEX IF NOT EXISTS idx_coin_sessions_tsum_skill ON coin_sessions(tsum_id, skill_level);
CREATE INDEX IF NOT EXISTS idx_tsums_series_id ON tsums(series_id);
