-- ============================================================
-- coin_sessions にアイテム使用フラグを追加
-- item_5to4  : 5→4アイテム使用 (0=なし, 1=あり)
-- item_coin  : コインアイテム使用 (0=なし, 1=あり)
-- ============================================================
ALTER TABLE coin_sessions ADD COLUMN item_5to4 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE coin_sessions ADD COLUMN item_coin INTEGER NOT NULL DEFAULT 0;
