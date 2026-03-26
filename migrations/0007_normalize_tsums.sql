-- ============================================================
-- tsums正規化: キャラクター名単位に統合 + tsum_tagsテーブル追加
-- ============================================================

-- 1. tsum_tagsテーブル作成（ツムが属するシリーズ/BOXの多対多）
CREATE TABLE IF NOT EXISTS tsum_tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tsum_id    INTEGER NOT NULL,
  series_id  INTEGER NOT NULL,
  FOREIGN KEY (tsum_id)   REFERENCES tsums(id),
  FOREIGN KEY (series_id) REFERENCES series(id),
  UNIQUE(tsum_id, series_id)
);

-- 2. 重複ツムの既存series_idをtsum_tagsに移行
--    （同名ツムの全series_idを、最小idのツムのタグとして登録）
INSERT OR IGNORE INTO tsum_tags (tsum_id, series_id)
SELECT
  (SELECT MIN(t2.id) FROM tsums t2 WHERE t2.name = t.name) AS tsum_id,
  t.series_id
FROM tsums t;

-- 3. 重複ツムを削除（同名の中でidが最小のものだけ残す）
DELETE FROM tsums
WHERE id NOT IN (
  SELECT MIN(id) FROM tsums GROUP BY name
);

-- 4. coin_sessionsの孤立レコードを修正
--    （削除されたtsum_idを持つセッションを、残存ツムのidに付け替え）
UPDATE coin_sessions
SET tsum_id = (
  SELECT MIN(t.id) FROM tsums t
  JOIN tsums old ON old.name = t.name
  WHERE old.id = coin_sessions.tsum_id
)
WHERE tsum_id NOT IN (SELECT id FROM tsums);

-- 5. nameにユニーク制約追加
CREATE UNIQUE INDEX IF NOT EXISTS idx_tsums_name_unique ON tsums(name);

-- 6. tsum_tagsのインデックス
CREATE INDEX IF NOT EXISTS idx_tsum_tags_tsum_id   ON tsum_tags(tsum_id);
CREATE INDEX IF NOT EXISTS idx_tsum_tags_series_id ON tsum_tags(series_id);
