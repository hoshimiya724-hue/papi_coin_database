import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

export const apiRoutes = new Hono<{ Bindings: Bindings }>()

// ============================================================
// SERIES
// ============================================================
apiRoutes.get('/series', async (c) => {
  const { env } = c
  const result = await env.DB.prepare(
    'SELECT * FROM series ORDER BY sort_order, name'
  ).all()
  return c.json({ series: result.results })
})

// ============================================================
// TSUMS
// ============================================================
apiRoutes.get('/tsums', async (c) => {
  const { env } = c
  const seriesId = c.req.query('series_id')

  // ツム一覧とタグをJOINして一括取得（GROUP_CONCATでタグをまとめる）
  let query: string
  const params: any[] = []

  if (seriesId) {
    // 特定シリーズのツムのみ（tsum_tagsで絞り込み）
    query = `
      SELECT t.id, t.name, t.series_id, t.max_skill_level, t.sort_order,
             s.name as series_name,
             GROUP_CONCAT(ts2.id || ':' || ts2.name, '||') as tags_raw
      FROM tsums t
      JOIN series s ON t.series_id = s.id
      JOIN tsum_tags tt_filter ON tt_filter.tsum_id = t.id AND tt_filter.series_id = ?
      LEFT JOIN tsum_tags tt ON tt.tsum_id = t.id
      LEFT JOIN series ts2 ON ts2.id = tt.series_id
      GROUP BY t.id
      ORDER BY t.name
    `
    params.push(parseInt(seriesId))
  } else {
    // 全ツム
    query = `
      SELECT t.id, t.name, t.series_id, t.max_skill_level, t.sort_order,
             s.name as series_name,
             GROUP_CONCAT(ts2.id || ':' || ts2.name, '||') as tags_raw
      FROM tsums t
      JOIN series s ON t.series_id = s.id
      LEFT JOIN tsum_tags tt ON tt.tsum_id = t.id
      LEFT JOIN series ts2 ON ts2.id = tt.series_id
      GROUP BY t.id
      ORDER BY t.name
    `
  }

  const result = await env.DB.prepare(query).bind(...params).all()
  const tsums = (result.results as any[]).map((t: any) => {
    // tags_raw を "id:name||id:name" 形式からオブジェクト配列に変換
    const tags = t.tags_raw
      ? t.tags_raw.split('||').map((s: string) => {
          const [id, ...nameParts] = s.split(':')
          return { id: parseInt(id), name: nameParts.join(':') }
        })
      : []
    const { tags_raw, ...rest } = t
    return { ...rest, tags }
  })

  return c.json({ tsums })
})

// ツム追加（ユーザー申請）
apiRoutes.post('/tsums', async (c) => {
  const { env } = c
  const body = await c.req.json()
  const { name, series_id, series_name_new } = body

  if (!name || !name.trim()) {
    return c.json({ error: 'ツム名を入力してください' }, 400)
  }

  let targetSeriesId = series_id ? parseInt(series_id) : null

  // 「新しい作品を追加」が選択された場合
  if (!targetSeriesId && series_name_new && series_name_new.trim()) {
    // 既存チェック
    const existing = await env.DB.prepare(
      'SELECT id FROM series WHERE name = ?'
    ).bind(series_name_new.trim()).first() as any
    if (existing) {
      targetSeriesId = existing.id
    } else {
      const res = await env.DB.prepare(
        'INSERT INTO series (name, sort_order) VALUES (?, 200)'
      ).bind(series_name_new.trim()).run()
      targetSeriesId = res.meta.last_row_id as number
    }
  }

  if (!targetSeriesId) {
    return c.json({ error: '登場作品を選択または入力してください' }, 400)
  }

  // 同名ツムが既存かチェック
  const existing = await env.DB.prepare(
    'SELECT id FROM tsums WHERE name = ?'
  ).bind(name.trim()).first() as any

  let tsumId: number

  if (existing) {
    // 既存ツムにタグ（series_id）を追加
    tsumId = existing.id
    const dupTag = await env.DB.prepare(
      'SELECT id FROM tsum_tags WHERE tsum_id = ? AND series_id = ?'
    ).bind(tsumId, targetSeriesId).first()
    if (dupTag) {
      return c.json({ error: '同じ作品に同名のツムが既に登録されています' }, 409)
    }
    await env.DB.prepare(
      'INSERT INTO tsum_tags (tsum_id, series_id) VALUES (?, ?)'
    ).bind(tsumId, targetSeriesId).run()
  } else {
    // 新規ツム登録
    const result = await env.DB.prepare(
      'INSERT INTO tsums (series_id, name, max_skill_level, sort_order) VALUES (?, ?, 6, 999)'
    ).bind(targetSeriesId, name.trim()).run()
    tsumId = result.meta.last_row_id as number
    // tsum_tagsにも登録
    await env.DB.prepare(
      'INSERT OR IGNORE INTO tsum_tags (tsum_id, series_id) VALUES (?, ?)'
    ).bind(tsumId, targetSeriesId).run()
  }

  const newTsum = await env.DB.prepare(
    'SELECT t.*, s.name as series_name FROM tsums t JOIN series s ON t.series_id = s.id WHERE t.id = ?'
  ).bind(tsumId).first()

  return c.json({ tsum: newTsum, success: true }, 201)
})

// ============================================================
// USERS
// ============================================================

// Login / Register
apiRoutes.post('/users/login', async (c) => {
  const { env } = c
  const body = await c.req.json()
  const { username, pin } = body

  if (!username || username.length < 1) {
    return c.json({ error: 'ユーザー名を入力してください' }, 400)
  }

  // Check if user exists
  const existing = await env.DB.prepare(
    'SELECT * FROM users WHERE username = ?'
  ).bind(username.trim()).first() as any

  if (existing) {
    // PIN check (if user has a PIN)
    if (existing.pin_hash && existing.pin_hash !== '' && existing.pin_hash !== pin) {
      return c.json({ error: 'PINが正しくありません' }, 401)
    }
    return c.json({ user: existing })
  } else {
    // New user registration
    const displayName = username.trim()
    const pinHash = pin && pin.length > 0 ? pin : null
    const result = await env.DB.prepare(
      'INSERT INTO users (username, display_name, pin_hash, is_admin) VALUES (?, ?, ?, 0)'
    ).bind(username.trim(), displayName, pinHash).run()

    const newUser = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(result.meta.last_row_id).first()

    return c.json({ user: newUser })
  }
})

// ============================================================
// SESSIONS
// ============================================================

// Create session
apiRoutes.post('/sessions', async (c) => {
  const { env } = c
  const body = await c.req.json()
  const {
    user_id, tsum_id, skill_level,
    coins_before, coins_after, coins_earned,
    duration_minutes, note,
    item_5to4, item_coin
  } = body

  if (!user_id || !tsum_id || !skill_level) {
    return c.json({ error: '必須パラメータが不足しています' }, 400)
  }

  const result = await env.DB.prepare(`
    INSERT INTO coin_sessions 
    (user_id, tsum_id, skill_level, coins_before, coins_after, coins_earned, duration_minutes, note, item_5to4, item_coin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    user_id, tsum_id, skill_level,
    coins_before, coins_after, coins_earned,
    duration_minutes || 30, note || null,
    item_5to4 ? 1 : 0, item_coin ? 1 : 0
  ).run()

  return c.json({ id: result.meta.last_row_id, success: true })
})

// Get sessions for user
apiRoutes.get('/sessions', async (c) => {
  const { env } = c
  const userId = c.req.query('user_id')
  const limit = parseInt(c.req.query('limit') || '50')
  const tsumId = c.req.query('tsum_id')

  if (!userId) return c.json({ error: 'user_id required' }, 400)

  let query = `
    SELECT cs.*, t.name as tsum_name, s.name as series_name
    FROM coin_sessions cs
    JOIN tsums t ON cs.tsum_id = t.id
    JOIN series s ON t.series_id = s.id
    WHERE cs.user_id = ?
  `
  const params: any[] = [parseInt(userId)]

  if (tsumId) {
    query += ' AND cs.tsum_id = ?'
    params.push(parseInt(tsumId))
  }

  query += ' ORDER BY cs.played_at DESC LIMIT ?'
  params.push(limit)

  const result = await env.DB.prepare(query).bind(...params).all()
  return c.json({ sessions: result.results })
})

// Get stats (avg/median) for user + tsum + skill_level
apiRoutes.get('/sessions/stats', async (c) => {
  const { env } = c
  const userId = c.req.query('user_id')
  const tsumId = c.req.query('tsum_id')
  const skillLevel = c.req.query('skill_level')

  if (!userId || !tsumId || !skillLevel) {
    return c.json({ error: 'Missing params' }, 400)
  }

  // Get all sessions for this combination (normalized to 30 min)
  const sessions = await env.DB.prepare(`
    SELECT coins_earned, duration_minutes,
           CAST(coins_earned AS REAL) * 30.0 / duration_minutes as coins_per_30min
    FROM coin_sessions
    WHERE user_id = ? AND tsum_id = ? AND skill_level = ?
    ORDER BY coins_per_30min
  `).bind(parseInt(userId), parseInt(tsumId), parseInt(skillLevel)).all()

  const rows = sessions.results as any[]

  if (!rows.length) {
    return c.json({ count: 0, avg_30min: 0, avg_1hour: 0, avg_1min: 0, median_30min: 0 })
  }

  const vals = rows.map((r: any) => r.coins_per_30min)
  const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length
  const median = vals[Math.floor(vals.length / 2)]

  return c.json({
    count: rows.length,
    avg_30min: Math.round(avg),
    avg_1hour: Math.round(avg * 2),
    avg_1min: Math.round(avg / 30),
    median_30min: Math.round(median)
  })
})

// My ranking (per tsum + SL combination)
apiRoutes.get('/sessions/my-ranking', async (c) => {
  const { env } = c
  const userId = c.req.query('user_id')
  if (!userId) return c.json({ error: 'user_id required' }, 400)

  const result = await env.DB.prepare(`
    SELECT 
      cs.tsum_id,
      cs.skill_level,
      t.name as tsum_name,
      COUNT(*) as count,
      AVG(CAST(cs.coins_earned AS REAL) * 30.0 / cs.duration_minutes) as avg_30min,
      AVG(CAST(cs.coins_earned AS REAL) * 60.0 / cs.duration_minutes) as avg_1hour,
      AVG(CAST(cs.coins_earned AS REAL) / cs.duration_minutes) as avg_1min
    FROM coin_sessions cs
    JOIN tsums t ON cs.tsum_id = t.id
    WHERE cs.user_id = ?
    GROUP BY cs.tsum_id, cs.skill_level
    ORDER BY avg_30min DESC
  `).bind(parseInt(userId)).all()

  return c.json({ ranking: result.results })
})

// ============================================================
// ADMIN
// ============================================================

// Summary stats
apiRoutes.get('/admin/summary', async (c) => {
  const { env } = c

  const [users, sessions, uniqueTsums, avgCoins] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_admin = 0').first() as any,
    env.DB.prepare('SELECT COUNT(*) as cnt FROM coin_sessions').first() as any,
    env.DB.prepare('SELECT COUNT(DISTINCT tsum_id) as cnt FROM coin_sessions').first() as any,
    env.DB.prepare(`
      SELECT AVG(CAST(coins_earned AS REAL) * 30.0 / duration_minutes) as avg_coins
      FROM coin_sessions
    `).first() as any,
  ])

  return c.json({
    total_users: (users as any)?.cnt || 0,
    total_sessions: (sessions as any)?.cnt || 0,
    unique_tsums: (uniqueTsums as any)?.cnt || 0,
    avg_coins_30min: (avgCoins as any)?.avg_coins || 0,
  })
})

// Tsum ranking (all users aggregated, with median)
apiRoutes.get('/admin/tsum-ranking', async (c) => {
  const { env } = c
  const skillLevel = c.req.query('skill_level') || 'all'

  let query = `
    SELECT 
      cs.tsum_id,
      t.name as tsum_name,
      COUNT(*) as session_count,
      COUNT(DISTINCT cs.user_id) as user_count,
      AVG(CAST(cs.coins_earned AS REAL) * 30.0 / cs.duration_minutes) as avg_coins,
      MAX(CAST(cs.coins_earned AS REAL) * 30.0 / cs.duration_minutes) as max_coins,
      MIN(CAST(cs.coins_earned AS REAL) * 30.0 / cs.duration_minutes) as min_coins
    FROM coin_sessions cs
    JOIN tsums t ON cs.tsum_id = t.id
  `
  const params: any[] = []
  if (skillLevel !== 'all') {
    query += ' WHERE cs.skill_level = ?'
    params.push(parseInt(skillLevel))
  }
  query += ' GROUP BY cs.tsum_id HAVING session_count >= 1 ORDER BY avg_coins DESC LIMIT 50'

  const result = await env.DB.prepare(query).bind(...params).all()
  const rows = result.results as any[]

  // Compute median for each tsum
  const enriched = await Promise.all(rows.map(async (row: any) => {
    let medianQuery = `
      SELECT CAST(coins_earned AS REAL) * 30.0 / duration_minutes as v
      FROM coin_sessions WHERE tsum_id = ?
    `
    const mParams: any[] = [row.tsum_id]
    if (skillLevel !== 'all') { medianQuery += ' AND skill_level = ?'; mParams.push(parseInt(skillLevel)) }
    medianQuery += ' ORDER BY v'
    const vals = await env.DB.prepare(medianQuery).bind(...mParams).all()
    const arr = (vals.results as any[]).map((r: any) => r.v)
    const median = arr[Math.floor(arr.length / 2)] || 0
    return { ...row, median_coins: median }
  }))

  return c.json({ ranking: enriched })
})

// Tsum detail stats (per skill level breakdown)
apiRoutes.get('/admin/tsum-detail', async (c) => {
  const { env } = c
  const tsumId = c.req.query('tsum_id')
  const skillLevel = c.req.query('skill_level') || 'all'

  if (!tsumId) return c.json({ error: 'tsum_id required' }, 400)

  let query = `
    SELECT 
      cs.skill_level,
      COUNT(*) as count,
      COUNT(DISTINCT cs.user_id) as user_count,
      AVG(CAST(cs.coins_earned AS REAL) * 30.0 / cs.duration_minutes) as avg_coins,
      MAX(CAST(cs.coins_earned AS REAL) * 30.0 / cs.duration_minutes) as max_coins,
      MIN(CAST(cs.coins_earned AS REAL) * 30.0 / cs.duration_minutes) as min_coins
    FROM coin_sessions cs
    WHERE cs.tsum_id = ?
  `
  const params: any[] = [parseInt(tsumId)]

  if (skillLevel !== 'all') {
    query += ' AND cs.skill_level = ?'
    params.push(parseInt(skillLevel))
  }

  query += ' GROUP BY cs.skill_level ORDER BY cs.skill_level'

  const result = await env.DB.prepare(query).bind(...params).all()
  const rows = result.results as any[]

  // Add median for each SL
  const enriched = await Promise.all(rows.map(async (row: any) => {
    const vals = await env.DB.prepare(`
      SELECT CAST(coins_earned AS REAL) * 30.0 / duration_minutes as v
      FROM coin_sessions
      WHERE tsum_id = ? AND skill_level = ?
      ORDER BY v
    `).bind(parseInt(tsumId), row.skill_level).all()
    const arr = (vals.results as any[]).map((r: any) => r.v)
    const median = arr[Math.floor(arr.length / 2)] || 0
    return { ...row, median_coins: median }
  }))

  return c.json({ stats: enriched })
})

// Admin users list
apiRoutes.get('/admin/users', async (c) => {
  const { env } = c
  const result = await env.DB.prepare(`
    SELECT u.id, u.username, u.display_name, u.is_admin, u.created_at,
           COUNT(cs.id) as session_count
    FROM users u
    LEFT JOIN coin_sessions cs ON u.id = cs.user_id
    WHERE u.is_admin = 0
    GROUP BY u.id
    ORDER BY session_count DESC
  `).all()
  return c.json({ users: result.results })
})
