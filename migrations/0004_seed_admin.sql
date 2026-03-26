-- 管理者ユーザー初期データ
INSERT OR IGNORE INTO users (username, display_name, pin_hash, is_admin) VALUES
('admin', '管理者', 'admin', 1);
