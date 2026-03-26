import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { apiRoutes } from './routes/api'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './' }))

// API routes
app.route('/api', apiRoutes)

// Serve main HTML for all other routes (SPA)
app.get('*', (c) => {
  return c.html(mainHtml())
})

function mainHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ツムツム コイン効率トラッカー</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --tsum-pink: #ff6b9d;
      --tsum-purple: #9b59b6;
      --tsum-blue: #3498db;
      --tsum-gold: #f39c12;
    }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); min-height: 100vh; color: #fff; }
    .card { background: rgba(255,255,255,0.08); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; }
    .btn-primary { background: linear-gradient(135deg, var(--tsum-pink), var(--tsum-purple)); color: white; border: none; border-radius: 12px; padding: 12px 24px; font-weight: bold; cursor: pointer; transition: all 0.3s; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,107,157,0.4); }
    .btn-secondary { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 12px 24px; cursor: pointer; transition: all 0.3s; }
    .btn-secondary:hover { background: rgba(255,255,255,0.2); }
    .btn-danger { background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; border: none; border-radius: 12px; padding: 12px 24px; font-weight: bold; cursor: pointer; transition: all 0.3s; }
    .input-field { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; padding: 10px 16px; color: white; width: 100%; outline: none; transition: all 0.3s; }
    .input-field:focus { border-color: var(--tsum-pink); box-shadow: 0 0 15px rgba(255,107,157,0.3); }
    .input-field option { background: #1a1a2e; color: white; }
    .tab-btn { padding: 8px 20px; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-weight: 600; }
    .tab-btn.active { background: var(--tsum-pink); color: white; }
    .tab-btn:not(.active) { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
    .coin-badge { background: linear-gradient(135deg, var(--tsum-gold), #e67e22); border-radius: 20px; padding: 4px 12px; font-size: 0.85rem; font-weight: bold; }
    .skill-badge { background: linear-gradient(135deg, var(--tsum-blue), #2980b9); border-radius: 20px; padding: 4px 12px; font-size: 0.85rem; font-weight: bold; }
    .timer-circle { position: relative; width: 200px; height: 200px; margin: 0 auto; }
    .timer-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
    .stat-card { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; border: 1px solid rgba(255,255,255,0.1); }
    .series-chip { display: inline-flex; align-items: center; padding: 6px 14px; border-radius: 20px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); cursor: pointer; transition: all 0.3s; font-size: 0.9rem; }
    .series-chip.selected { background: var(--tsum-purple); border-color: var(--tsum-purple); }
    .series-chip:hover:not(.selected) { background: rgba(255,255,255,0.2); }
    .tsum-card { padding: 12px 16px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.1); cursor: pointer; transition: all 0.3s; background: rgba(255,255,255,0.05); }
    .tsum-card:hover, .tsum-card.selected { border-color: var(--tsum-pink); background: rgba(255,107,157,0.1); }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .modal-content { background: #1a1a2e; border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; padding: 32px; max-width: 500px; width: 90%; max-height: 85vh; overflow-y: auto; }
    .hidden { display: none !important; }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .progress-ring { transform: rotate(-90deg); }
    .rank-badge { width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem; }
    .rank-1 { background: gold; color: #333; }
    .rank-2 { background: silver; color: #333; }
    .rank-3 { background: #cd7f32; color: white; }
    .rank-other { background: rgba(255,255,255,0.2); color: white; }
    .scrollbar-thin::-webkit-scrollbar { width: 6px; }
    .scrollbar-thin::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
    .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
    #timerCanvas { display: block; }
    .btn-add-tsum { background: rgba(52,152,219,0.15); border: 1.5px dashed rgba(52,152,219,0.6); color: #5dade2; border-radius: 12px; padding: 10px 16px; cursor: pointer; transition: all 0.3s; width: 100%; font-size: 0.9rem; }
    .btn-add-tsum:hover { background: rgba(52,152,219,0.25); border-color: #5dade2; color: #fff; }
    .new-tsum-badge { display: inline-block; background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; font-size: 0.65rem; font-weight: bold; padding: 1px 6px; border-radius: 8px; margin-left: 4px; vertical-align: middle; }
    .radio-group { display: flex; flex-direction: column; gap: 8px; }
    .radio-option { display: flex; align-items: center; gap-10px; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; transition: all 0.3s; }
    .radio-option:hover { background: rgba(255,255,255,0.07); }
    .radio-option.selected { background: rgba(52,152,219,0.15); border-color: #3498db; }
    .series-select-search { position: relative; }
    .series-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; max-height: 200px; overflow-y: auto; z-index: 100; margin-top: 4px; }
    .series-dropdown-item { padding: 10px 14px; cursor: pointer; transition: background 0.2s; font-size: 0.9rem; }
    .series-dropdown-item:hover { background: rgba(255,255,255,0.1); }
    .series-dropdown-item.highlighted { background: rgba(52,152,219,0.2); color: #5dade2; }
    .input-field::placeholder { color: rgba(255,255,255,0.35); }
    .tag-badge { display:inline-block; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.75); font-size:0.65rem; padding:1px 7px; border-radius:10px; white-space:nowrap; }
    .tag-badge.box { background:rgba(243,156,18,0.18); border-color:rgba(243,156,18,0.4); color:#f8c471; }
    .tag-badge.limited { background:rgba(231,76,60,0.18); border-color:rgba(231,76,60,0.4); color:#f1948a; }
    /* Item toggle */
    .item-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); transition: all 0.25s; }
    .item-toggle-row.active-5to4 { background: rgba(155,89,182,0.18); border-color: rgba(155,89,182,0.5); }
    .item-toggle-row.active-coin { background: rgba(243,156,18,0.18); border-color: rgba(243,156,18,0.5); }
    .toggle-switch { position: relative; width: 48px; height: 26px; flex-shrink: 0; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
    .toggle-track { position: absolute; inset: 0; border-radius: 13px; background: rgba(255,255,255,0.15); cursor: pointer; transition: background 0.25s; }
    .toggle-track::after { content:''; position: absolute; width: 20px; height: 20px; border-radius: 50%; top: 3px; left: 3px; background: white; transition: transform 0.25s; }
    .toggle-switch input:checked + .toggle-track { background: #9b59b6; }
    .toggle-switch input:checked + .toggle-track::after { transform: translateX(22px); }
    .toggle-5to4 .toggle-switch input:checked + .toggle-track { background: #9b59b6; }
    .toggle-coin .toggle-switch input:checked + .toggle-track { background: #f39c12; }
    .item-label { display: flex; align-items: center; gap: 8px; }
    .item-badge-5to4 { display:inline-block; background: linear-gradient(135deg,#9b59b6,#8e44ad); color:white; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:8px; }
    .item-badge-coin { display:inline-block; background: linear-gradient(135deg,#f39c12,#e67e22); color:white; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:8px; }
    .item-badge-none { display:inline-block; background: rgba(255,255,255,0.15); color:rgba(255,255,255,0.5); font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:8px; }
  </style>
</head>
<body>
  <div id="app">
    <!-- Login Screen -->
    <div id="loginScreen" class="min-h-screen flex items-center justify-center p-4">
      <div class="card p-8 w-full max-w-md fade-in">
        <div class="text-center mb-8">
          <div class="text-5xl mb-4">🌟</div>
          <h1 class="text-3xl font-bold text-white mb-2">ツムツム</h1>
          <p class="text-pink-300 text-lg">コイン効率トラッカー</p>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-300 mb-2">ユーザー名</label>
            <input type="text" id="loginUsername" class="input-field" placeholder="ユーザー名を入力">
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-2">PIN（任意）</label>
            <input type="password" id="loginPin" class="input-field" placeholder="PINを入力（なければ空白）" maxlength="8">
          </div>
          <button onclick="handleLogin()" class="btn-primary w-full text-center mt-4">
            <i class="fas fa-sign-in-alt mr-2"></i>ログイン / 新規登録
          </button>
        </div>
        <div class="mt-6 pt-4 border-t border-white/10 text-center">
          <button onclick="showAdminLogin()" class="text-gray-400 text-sm hover:text-white transition-colors">
            <i class="fas fa-cog mr-1"></i>管理者ログイン
          </button>
        </div>
      </div>
    </div>

    <!-- Main App (hidden until login) -->
    <div id="mainApp" class="hidden min-h-screen">
      <!-- Header -->
      <header class="sticky top-0 z-50 p-4" style="background: rgba(10,10,30,0.9); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,255,255,0.1);">
        <div class="max-w-4xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🌟</span>
            <div>
              <h1 class="text-lg font-bold text-white">コイン効率トラッカー</h1>
              <p class="text-xs text-pink-300" id="headerUsername"></p>
            </div>
          </div>
          <div class="flex gap-2">
            <div class="tab-btn active" id="tabUser" onclick="switchTab('user')">
              <i class="fas fa-user mr-1"></i>マイ記録
            </div>
            <div class="tab-btn" id="tabHistory" onclick="switchTab('history')">
              <i class="fas fa-history mr-1"></i>履歴
            </div>
            <button onclick="handleLogout()" class="text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </header>

      <main class="max-w-4xl mx-auto p-4">
        <!-- User Tab -->
        <div id="userTab" class="space-y-4 fade-in">
          <!-- Step 1: Select Tsum -->
          <div class="card p-6" id="step1">
            <h2 class="text-xl font-bold text-white mb-4">
              <span class="text-pink-400">Step 1</span> ツムを選択
            </h2>
            <!-- Series selection -->
            <div class="mb-4">
              <label class="block text-sm text-gray-300 mb-2">作品を選択</label>
              <div id="seriesChips" class="flex flex-wrap gap-2 max-h-48 overflow-y-auto scrollbar-thin pb-1"></div>
            </div>
            <!-- Tsum search -->
            <div class="mb-4">
              <input type="text" id="tsumSearch" class="input-field" placeholder="🔍 ツム名で検索..." oninput="filterTsums()">
            </div>
            <!-- Tsum list -->
            <div id="tsumList" class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto scrollbar-thin"></div>

            <!-- Add new tsum button -->
            <div class="mt-3">
              <button class="btn-add-tsum" onclick="openAddTsumModal()">
                <i class="fas fa-plus-circle mr-2"></i>リストにないツムを追加する
              </button>
            </div>

            <!-- Selected tsum & skill level -->
            <div id="selectedTsumInfo" class="hidden mt-4 p-4 rounded-xl" style="background: rgba(155,89,182,0.15); border: 1px solid rgba(155,89,182,0.3);">
              <div class="flex items-center justify-between mb-3">
                <span class="text-white font-bold text-lg" id="selectedTsumName">-</span>
                <button onclick="clearTsumSelection()" class="text-gray-400 hover:text-white text-sm">
                  <i class="fas fa-times"></i> 変更
                </button>
              </div>
              <div>
                <label class="block text-sm text-gray-300 mb-2">スキルレベル</label>
                <div id="skillLevelBtns" class="flex gap-2 flex-wrap"></div>
              </div>
              <!-- Past performance for this tsum+SL -->
              <div id="pastPerformance" class="hidden mt-3 pt-3 border-t border-white/10">
                <p class="text-xs text-gray-400 mb-2">📊 過去のあなたのデータ</p>
                <div class="grid grid-cols-3 gap-2" id="pastStats"></div>
              </div>
            </div>
          </div>

          <!-- Step 2: Before Coins -->
          <div class="card p-6" id="step2">
            <h2 class="text-xl font-bold text-white mb-4">
              <span class="text-pink-400">Step 2</span> 開始前の設定
            </h2>
            <div class="flex gap-4 items-end mb-4">
              <div class="flex-1">
                <label class="block text-sm text-gray-300 mb-2">所持コイン数</label>
                <input type="number" id="coinsBeforeInput" class="input-field text-xl font-bold" placeholder="0" min="0" oninput="validateStep2()">
              </div>
              <div class="text-3xl pb-2">🪙</div>
            </div>

            <!-- アイテム選択 -->
            <div class="mb-4">
              <label class="block text-sm text-gray-300 mb-2"><i class="fas fa-magic mr-1 text-purple-400"></i>使用アイテム</label>
              <div class="space-y-2">
                <!-- 5→4アイテム -->
                <div class="item-toggle-row toggle-5to4" id="toggleRow5to4">
                  <div class="item-label">
                    <span class="text-lg">🃏</span>
                    <div>
                      <div class="text-sm font-bold text-white">5→4アイテム</div>
                      <div class="text-xs text-gray-400">ツムの種類を5→4種類に減らす</div>
                    </div>
                  </div>
                  <label class="toggle-switch">
                    <input type="checkbox" id="toggle5to4" onchange="onToggleItem('5to4', this.checked)">
                    <span class="toggle-track"></span>
                  </label>
                </div>
                <!-- コインアイテム -->
                <div class="item-toggle-row toggle-coin" id="toggleRowCoin">
                  <div class="item-label">
                    <span class="text-lg">🪙</span>
                    <div>
                      <div class="text-sm font-bold text-white">コインアイテム</div>
                      <div class="text-xs text-gray-400">獲得コインを増加させる</div>
                    </div>
                  </div>
                  <label class="toggle-switch">
                    <input type="checkbox" id="toggleCoin" onchange="onToggleItem('coin', this.checked)">
                    <span class="toggle-track"></span>
                  </label>
                </div>
              </div>
            </div>

            <button onclick="startSession()" id="startBtn" class="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              <i class="fas fa-play mr-2"></i>30分計測スタート
            </button>
          </div>

          <!-- Step 3: Timer -->
          <div class="card p-6 hidden" id="step3">
            <h2 class="text-xl font-bold text-white mb-4 text-center">
              <span class="text-pink-400">Step 3</span> プレイ中...
            </h2>
            <div class="timer-circle mb-4">
              <canvas id="timerCanvas" width="200" height="200"></canvas>
              <div class="timer-text">
                <div class="text-3xl font-bold text-white" id="timerDisplay">30:00</div>
                <div class="text-xs text-gray-400">残り時間</div>
              </div>
            </div>
            <div class="text-center space-y-2 mb-4">
              <p class="text-gray-300 text-sm">ツムツムをプレイして</p>
              <p class="text-gray-300 text-sm">30分後にコイン数を入力してください</p>
            </div>
            <div class="flex gap-3">
              <button onclick="finishEarly()" class="btn-secondary flex-1">
                <i class="fas fa-flag-checkered mr-2"></i>今すぐ終了
              </button>
              <button onclick="cancelSession()" class="btn-danger flex-1">
                <i class="fas fa-times mr-2"></i>キャンセル
              </button>
            </div>
          </div>

          <!-- Step 4: After Coins -->
          <div class="card p-6 hidden" id="step4">
            <h2 class="text-xl font-bold text-white mb-4">
              <span class="text-pink-400">Step 4</span> 終了後のコイン数を入力
            </h2>
            <div class="p-3 rounded-lg mb-4" style="background: rgba(255,255,255,0.05);">
              <div class="flex justify-between text-sm text-gray-400">
                <span>開始時コイン</span>
                <span class="text-white font-bold" id="displayCoinsBefore">-</span>
              </div>
              <div class="flex justify-between text-sm text-gray-400 mt-1">
                <span>プレイ時間</span>
                <span class="text-white font-bold" id="displayDuration">-</span>
              </div>
              <div class="flex justify-between text-sm text-gray-400 mt-1">
                <span>使用アイテム</span>
                <span id="displayItems" class="flex gap-1"></span>
              </div>
            </div>
            <div class="flex gap-4 items-end mb-4">
              <div class="flex-1">
                <label class="block text-sm text-gray-300 mb-2">終了後の所持コイン数</label>
                <input type="number" id="coinsAfterInput" class="input-field text-xl font-bold" placeholder="0" min="0" oninput="calcEarned()">
              </div>
              <div class="text-3xl pb-2">🪙</div>
            </div>
            <div id="earnedPreview" class="hidden p-3 rounded-lg text-center mb-4" style="background: rgba(243,156,18,0.15); border: 1px solid rgba(243,156,18,0.3);">
              <div class="text-2xl font-bold text-yellow-400" id="earnedCoinsDisplay">+0</div>
              <div class="text-xs text-gray-400">獲得コイン</div>
            </div>
            <div class="mb-4">
              <label class="block text-sm text-gray-300 mb-2">メモ（任意）</label>
              <input type="text" id="noteInput" class="input-field" placeholder="例: ボーナスタイムあり、フィーバー多め">
            </div>
            <button onclick="saveSession()" class="btn-primary w-full">
              <i class="fas fa-save mr-2"></i>記録を保存
            </button>
          </div>

          <!-- Step 5: Result -->
          <div class="card p-6 hidden" id="step5">
            <div class="text-center mb-6">
              <div class="text-5xl mb-3">🎉</div>
              <h2 class="text-2xl font-bold text-white">記録完了！</h2>
              <p class="text-gray-400 text-sm mt-1" id="resultTsumName"></p>
              <div id="resultItemBadges" class="flex justify-center gap-2 mt-2"></div>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-6">
              <div class="stat-card text-center">
                <div class="text-3xl font-bold text-yellow-400" id="result30min">-</div>
                <div class="text-xs text-gray-400 mt-1">30分コイン</div>
              </div>
              <div class="stat-card text-center">
                <div class="text-3xl font-bold text-blue-400" id="result1hour">-</div>
                <div class="text-xs text-gray-400 mt-1">1時間換算</div>
              </div>
              <div class="stat-card text-center">
                <div class="text-3xl font-bold text-green-400" id="result1min">-</div>
                <div class="text-xs text-gray-400 mt-1">1分換算</div>
              </div>
              <div class="stat-card text-center">
                <div class="text-3xl font-bold text-pink-400" id="resultSL">-</div>
                <div class="text-xs text-gray-400 mt-1">スキルLv</div>
              </div>
            </div>
            <!-- Updated averages -->
            <div id="updatedAverages" class="p-4 rounded-xl mb-4" style="background: rgba(155,89,182,0.1); border: 1px solid rgba(155,89,182,0.2);">
              <p class="text-sm text-purple-300 font-bold mb-2">📊 あなたの平均（更新済み）</p>
              <div class="grid grid-cols-3 gap-2" id="updatedAvgStats"></div>
            </div>
            <button onclick="resetToStep1()" class="btn-primary w-full">
              <i class="fas fa-redo mr-2"></i>もう一度計測する
            </button>
          </div>
        </div>

        <!-- History Tab -->
        <div id="historyTab" class="hidden space-y-4 fade-in">
          <div class="card p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-white">📈 パフォーマンスランキング</h2>
              <select id="historyFilter" class="input-field text-sm w-auto" onchange="loadMyStats()">
                <option value="all">全ツム</option>
              </select>
            </div>
            <div id="myRankingList" class="space-y-3"></div>
          </div>
          <div class="card p-4">
            <h2 class="text-lg font-bold text-white mb-4">📋 記録履歴</h2>
            <div id="sessionHistory" class="space-y-3"></div>
          </div>
        </div>
      </main>
    </div>

    <!-- Admin Screen -->
    <div id="adminScreen" class="hidden min-h-screen">
      <!-- Admin Header -->
      <header class="sticky top-0 z-50 p-4" style="background: rgba(10,10,30,0.95); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,215,0,0.2);">
        <div class="max-w-6xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-2xl">👑</span>
            <div>
              <h1 class="text-lg font-bold text-yellow-400">管理者ダッシュボード</h1>
              <p class="text-xs text-gray-400">ツムツム コイン効率トラッカー</p>
            </div>
          </div>
          <div class="flex gap-2">
            <div class="tab-btn active" id="adminTabOverview" onclick="switchAdminTab('overview')" style="font-size:0.85rem;">
              概要
            </div>
            <div class="tab-btn" id="adminTabRanking" onclick="switchAdminTab('ranking')" style="font-size:0.85rem;">
              ランキング
            </div>
            <div class="tab-btn" id="adminTabUsers" onclick="switchAdminTab('users')" style="font-size:0.85rem;">
              ユーザー
            </div>
            <button onclick="handleLogout()" class="text-gray-400 hover:text-yellow-400 text-sm px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </header>

      <main class="max-w-6xl mx-auto p-4">
        <!-- Admin: Overview Tab -->
        <div id="adminOverviewTab" class="space-y-4 fade-in">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3" id="adminSummaryCards">
            <div class="stat-card text-center">
              <div class="text-3xl font-bold text-yellow-400" id="adminTotalUsers">-</div>
              <div class="text-xs text-gray-400 mt-1">総ユーザー数</div>
            </div>
            <div class="stat-card text-center">
              <div class="text-3xl font-bold text-blue-400" id="adminTotalSessions">-</div>
              <div class="text-xs text-gray-400 mt-1">総計測回数</div>
            </div>
            <div class="stat-card text-center">
              <div class="text-3xl font-bold text-green-400" id="adminTotalTsums">-</div>
              <div class="text-xs text-gray-400 mt-1">計測ツム種類</div>
            </div>
            <div class="stat-card text-center">
              <div class="text-3xl font-bold text-pink-400" id="adminAvgCoins">-</div>
              <div class="text-xs text-gray-400 mt-1">平均30分コイン</div>
            </div>
          </div>

          <!-- Top performers by tsum -->
          <div class="card p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-white">🏆 ツム別コイン効率（全ユーザー平均）</h2>
              <select id="adminSlFilter" class="input-field text-sm w-32" onchange="loadAdminTsumStats()">
                <option value="all">全SL</option>
                <option value="1">SL1</option>
                <option value="2">SL2</option>
                <option value="3">SL3</option>
                <option value="4">SL4</option>
                <option value="5">SL5</option>
                <option value="6">SL6</option>
              </select>
            </div>
            <div id="adminTsumRankingList" class="space-y-2"></div>
          </div>
        </div>

        <!-- Admin: Ranking Tab -->
        <div id="adminRankingTab" class="hidden space-y-4 fade-in">
          <div class="card p-4">
            <h2 class="text-lg font-bold text-white mb-4">📊 詳細ツム統計</h2>
            <div class="flex gap-2 mb-4">
              <select id="adminDetailTsumSelect" class="input-field flex-1" onchange="loadAdminTsumDetail()">
                <option value="">ツムを選択...</option>
              </select>
              <select id="adminDetailSlSelect" class="input-field w-28" onchange="loadAdminTsumDetail()">
                <option value="all">全SL</option>
                <option value="1">SL1</option>
                <option value="2">SL2</option>
                <option value="3">SL3</option>
                <option value="4">SL4</option>
                <option value="5">SL5</option>
                <option value="6">SL6</option>
              </select>
            </div>
            <div id="adminTsumDetail" class="space-y-3"></div>
          </div>
        </div>

        <!-- Admin: Users Tab -->
        <div id="adminUsersTab" class="hidden space-y-4 fade-in">
          <div class="card p-4">
            <h2 class="text-lg font-bold text-white mb-4">👥 ユーザー一覧</h2>
            <div id="adminUserList" class="space-y-3"></div>
          </div>
        </div>
      </main>
    </div>
  </div>

  <!-- Add Tsum Modal -->
  <div id="addTsumModal" class="modal-overlay hidden">
    <div class="modal-content" style="max-width:480px;">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-white">
            <i class="fas fa-plus-circle text-blue-400 mr-2"></i>ツムを追加
          </h2>
          <p class="text-xs text-gray-400 mt-1">登録後すぐにリストに反映されます</p>
        </div>
        <button onclick="closeAddTsumModal()" class="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- ツム名 -->
      <div class="mb-5">
        <label class="block text-sm font-bold text-gray-200 mb-2">
          <i class="fas fa-star text-pink-400 mr-1"></i>ツム名 <span class="text-red-400">*</span>
        </label>
        <input type="text" id="newTsumName"
          class="input-field text-lg"
          placeholder="例: ヴィランズミッキー"
          oninput="validateAddTsumForm()"
          autocomplete="off">
        <p class="text-xs text-gray-500 mt-1">ゲーム内に表示される正式名称で入力してください</p>
      </div>

      <!-- 登場作品 -->
      <div class="mb-6">
        <label class="block text-sm font-bold text-gray-200 mb-2">
          <i class="fas fa-film text-purple-400 mr-1"></i>登場作品 <span class="text-red-400">*</span>
        </label>

        <!-- 既存作品 or 新規作品 切替 -->
        <div class="flex gap-2 mb-3">
          <button id="modeExisting" onclick="setSeriesMode('existing')"
            class="flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all border"
            style="background:rgba(52,152,219,0.2);border-color:#3498db;color:#5dade2;">
            <i class="fas fa-list mr-1"></i>既存の作品から選ぶ
          </button>
          <button id="modeNew" onclick="setSeriesMode('new')"
            class="flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all border"
            style="background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);">
            <i class="fas fa-plus mr-1"></i>新しい作品を追加
          </button>
        </div>

        <!-- 既存作品選択（検索付き） -->
        <div id="seriesExistingMode">
          <div class="series-select-search">
            <input type="text" id="seriesSearchInput"
              class="input-field"
              placeholder="🔍 作品名で絞り込み..."
              oninput="filterSeriesDropdown()"
              onfocus="showSeriesDropdown()"
              autocomplete="off">
            <div id="seriesDropdown" class="series-dropdown hidden scrollbar-thin"></div>
          </div>
          <div id="selectedSeriesDisplay" class="hidden mt-2 p-2 rounded-lg flex items-center gap-2"
            style="background:rgba(155,89,182,0.15);border:1px solid rgba(155,89,182,0.3);">
            <i class="fas fa-check-circle text-purple-400 text-sm"></i>
            <span class="text-sm text-white font-bold" id="selectedSeriesName"></span>
            <button onclick="clearSeriesSelection()" class="ml-auto text-gray-400 hover:text-white text-xs">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <!-- 新規作品入力 -->
        <div id="seriesNewMode" class="hidden">
          <input type="text" id="newSeriesName"
            class="input-field"
            placeholder="例: ウィッシュ、ストレンジ・ワールド"
            oninput="validateAddTsumForm()"
            autocomplete="off">
          <p class="text-xs text-gray-500 mt-1">ゲーム内表記に合わせて入力してください</p>
        </div>
      </div>

      <!-- エラー表示 -->
      <div id="addTsumError" class="hidden mb-4 p-3 rounded-lg text-sm text-red-300"
        style="background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.3);">
        <i class="fas fa-exclamation-circle mr-1"></i>
        <span id="addTsumErrorMsg"></span>
      </div>

      <!-- ボタン -->
      <div class="flex gap-3">
        <button onclick="closeAddTsumModal()" class="btn-secondary flex-1">
          キャンセル
        </button>
        <button id="submitAddTsumBtn" onclick="submitAddTsum()"
          class="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          disabled>
          <i class="fas fa-plus mr-2"></i>追加する
        </button>
      </div>
    </div>
  </div>

  <!-- Admin Login Modal -->
  <div id="adminLoginModal" class="modal-overlay hidden">
    <div class="modal-content">
      <h2 class="text-xl font-bold text-yellow-400 mb-4">👑 管理者ログイン</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm text-gray-300 mb-2">管理者ID</label>
          <input type="text" id="adminUsernameInput" class="input-field" placeholder="admin" value="admin">
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-2">PIN</label>
          <input type="password" id="adminPinInput" class="input-field" placeholder="PIN">
        </div>
        <div class="flex gap-3">
          <button onclick="closeAdminLogin()" class="btn-secondary flex-1">キャンセル</button>
          <button onclick="handleAdminLogin()" class="btn-primary flex-1">ログイン</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div id="toast" class="hidden fixed bottom-4 right-4 z-[9999] px-6 py-3 rounded-xl font-bold shadow-2xl" style="min-width: 200px;"></div>

  <script>
  // ===========================
  // STATE
  // ===========================
  let state = {
    currentUser: null,
    isAdmin: false,
    series: [],
    tsums: [],
    filteredTsums: [],
    selectedSeriesId: null,
    selectedTsum: null,
    selectedSkillLevel: 1,
    session: {
      coinsBefore: 0,
      startTime: null,
      timerInterval: null,
      actualDuration: 30,
      item5to4: false,
      itemCoin: false
    }
  }

  // ===========================
  // INIT
  // ===========================
  window.onload = async () => {
    const saved = localStorage.getItem('tsumtsum_user')
    if (saved) {
      const u = JSON.parse(saved)
      state.currentUser = u
      state.isAdmin = u.is_admin == 1
      if (state.isAdmin) {
        showAdminApp()
      } else {
        showMainApp()
      }
    }
    await loadMasterData()
  }

  async function loadMasterData() {
    try {
      const [seriesRes, tsumsRes] = await Promise.all([
        axios.get('/api/series'),
        axios.get('/api/tsums')
      ])
      state.series = seriesRes.data.series || []
      state.tsums = tsumsRes.data.tsums || []
      state.filteredTsums = [...state.tsums]
      renderSeriesChips()
      populateAdminTsumSelect()
    } catch(e) {
      console.error('Master data load error:', e)
    }
  }

  // ===========================
  // AUTH
  // ===========================
  async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim()
    const pin = document.getElementById('loginPin').value
    if (!username) { showToast('ユーザー名を入力してください', 'error'); return }
    try {
      const res = await axios.post('/api/users/login', { username, pin })
      const user = res.data.user
      state.currentUser = user
      state.isAdmin = user.is_admin == 1
      localStorage.setItem('tsumtsum_user', JSON.stringify(user))
      if (state.isAdmin) { showAdminApp() } else { showMainApp() }
      showToast(\`ようこそ、\${user.display_name}さん！\`, 'success')
    } catch(e) {
      showToast(e.response?.data?.error || 'ログインエラー', 'error')
    }
  }

  function handleLogout() {
    localStorage.removeItem('tsumtsum_user')
    state.currentUser = null
    state.isAdmin = false
    document.getElementById('loginScreen').classList.remove('hidden')
    document.getElementById('mainApp').classList.add('hidden')
    document.getElementById('adminScreen').classList.add('hidden')
    resetToStep1()
  }

  function showAdminLogin() {
    document.getElementById('adminLoginModal').classList.remove('hidden')
  }
  function closeAdminLogin() {
    document.getElementById('adminLoginModal').classList.add('hidden')
  }
  async function handleAdminLogin() {
    const username = document.getElementById('adminUsernameInput').value.trim()
    const pin = document.getElementById('adminPinInput').value
    try {
      const res = await axios.post('/api/users/login', { username, pin })
      const user = res.data.user
      if (!user.is_admin) { showToast('管理者権限がありません', 'error'); return }
      state.currentUser = user
      state.isAdmin = true
      localStorage.setItem('tsumtsum_user', JSON.stringify(user))
      closeAdminLogin()
      showAdminApp()
      showToast('管理者としてログインしました', 'success')
    } catch(e) {
      showToast(e.response?.data?.error || 'ログインエラー', 'error')
    }
  }

  function showMainApp() {
    document.getElementById('loginScreen').classList.add('hidden')
    document.getElementById('mainApp').classList.remove('hidden')
    document.getElementById('adminScreen').classList.add('hidden')
    document.getElementById('headerUsername').textContent = state.currentUser.display_name + ' さん'
    renderSeriesChips()
    loadMyStats()
    loadSessionHistory()
  }

  function showAdminApp() {
    document.getElementById('loginScreen').classList.add('hidden')
    document.getElementById('mainApp').classList.add('hidden')
    document.getElementById('adminScreen').classList.remove('hidden')
    loadAdminData()
  }

  // ===========================
  // TABS
  // ===========================
  function switchTab(tab) {
    document.getElementById('userTab').classList.toggle('hidden', tab !== 'user')
    document.getElementById('historyTab').classList.toggle('hidden', tab !== 'history')
    document.getElementById('tabUser').classList.toggle('active', tab === 'user')
    document.getElementById('tabHistory').classList.toggle('active', tab === 'history')
    if (tab === 'history') { loadMyStats(); loadSessionHistory() }
  }

  function switchAdminTab(tab) {
    ['overview', 'ranking', 'users'].forEach(t => {
      document.getElementById('adminTab' + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle('hidden', t !== tab)
      document.getElementById('adminTab' + t.charAt(0).toUpperCase() + t.slice(1).charAt(0).toUpperCase() + t.slice(2)).classList.toggle('active', t === tab)
    })
    if (tab === 'overview') loadAdminTsumStats()
    if (tab === 'ranking') {}
    if (tab === 'users') loadAdminUsers()
  }

  // ===========================
  // SERIES & TSUM SELECTION
  // ===========================
  function renderSeriesChips() {
    const el = document.getElementById('seriesChips')
    if (!el) return
    // tagsから全series_idを収集（tsum_tags対応）
    const activeSeries = new Set()
    state.tsums.forEach(t => {
      if (t.tags && t.tags.length) {
        t.tags.forEach(tag => activeSeries.add(tag.id))
      } else {
        activeSeries.add(t.series_id)
      }
    })
    const filtered = state.series.filter(s => activeSeries.has(s.id))
    el.innerHTML = '<div class="series-chip ' + (!state.selectedSeriesId ? 'selected' : '') + '" onclick="selectSeries(null)">すべて</div>' +
      filtered.map(s => \`<div class="series-chip \${state.selectedSeriesId === s.id ? 'selected' : ''}" onclick="selectSeries(\${s.id})">\${s.name}</div>\`).join('')
  }

  function selectSeries(id) {
    state.selectedSeriesId = id
    renderSeriesChips()
    filterTsums()
  }

  function filterTsums() {
    const search = document.getElementById('tsumSearch')?.value?.toLowerCase() || ''
    state.filteredTsums = state.tsums.filter(t => {
      const matchSeries = !state.selectedSeriesId || (
        t.tags && t.tags.some(tag => tag.id === state.selectedSeriesId)
      ) || t.series_id === state.selectedSeriesId
      const matchSearch = !search || t.name.toLowerCase().includes(search)
      return matchSeries && matchSearch
    })
    renderTsumList()
  }

  function renderTsumList() {
    const el = document.getElementById('tsumList')
    if (!el) return
    el.innerHTML = state.filteredTsums.map(t => {
      const tagBadges = (t.tags && t.tags.length)
        ? t.tags.map(tag => {
            const isBox = tag.name.includes('BOX')
            const isLimited = tag.name.includes('期間限定')
            const cls = isLimited ? 'tag-badge limited' : isBox ? 'tag-badge box' : 'tag-badge'
            return \`<span class="\${cls}">\${tag.name}</span>\`
          }).join(' ')
        : \`<span class="tag-badge">\${getSeriesName(t.series_id)}</span>\`
      return \`
        <div class="tsum-card \${state.selectedTsum?.id === t.id ? 'selected' : ''}" onclick="selectTsum(\${t.id})">
          <div class="font-medium text-white text-sm">\${t.name}</div>
          <div class="flex flex-wrap gap-1 mt-1">\${tagBadges}</div>
        </div>
      \`
    }).join('') || '<div class="text-gray-400 text-sm col-span-2 text-center py-4">ツムが見つかりません</div>'
  }

  function getSeriesName(id) {
    return state.series.find(s => s.id === id)?.name || ''
  }

  async function selectTsum(id) {
    state.selectedTsum = state.tsums.find(t => t.id === id)
    state.selectedSkillLevel = 1
    filterTsums()
    document.getElementById('selectedTsumInfo').classList.remove('hidden')
    document.getElementById('selectedTsumName').textContent = state.selectedTsum.name
    renderSkillLevelBtns()
    validateStep2()
    await loadPastPerformance()
  }

  function clearTsumSelection() {
    state.selectedTsum = null
    state.selectedSkillLevel = 1
    document.getElementById('selectedTsumInfo').classList.add('hidden')
    document.getElementById('pastPerformance').classList.add('hidden')
    filterTsums()
    validateStep2()
  }

  function renderSkillLevelBtns() {
    if (!state.selectedTsum) return
    const max = state.selectedTsum.max_skill_level
    const el = document.getElementById('skillLevelBtns')
    el.innerHTML = Array.from({length: max}, (_, i) => i + 1).map(sl => \`
      <button class="skill-badge \${state.selectedSkillLevel === sl ? 'opacity-100' : 'opacity-40'} cursor-pointer hover:opacity-80 transition-opacity" 
        onclick="selectSkillLevel(\${sl})">SL\${sl}</button>
    \`).join('')
  }

  async function selectSkillLevel(sl) {
    state.selectedSkillLevel = sl
    renderSkillLevelBtns()
    await loadPastPerformance()
  }

  async function loadPastPerformance() {
    if (!state.selectedTsum || !state.currentUser) return
    try {
      const res = await axios.get(\`/api/sessions/stats?user_id=\${state.currentUser.id}&tsum_id=\${state.selectedTsum.id}&skill_level=\${state.selectedSkillLevel}\`)
      const stats = res.data
      if (stats.count > 0) {
        document.getElementById('pastPerformance').classList.remove('hidden')
        document.getElementById('pastStats').innerHTML = \`
          <div class="stat-card text-center p-2">
            <div class="text-sm font-bold text-yellow-400">\${fmtCoins(stats.avg_30min)}</div>
            <div class="text-xs text-gray-400">30分平均</div>
          </div>
          <div class="stat-card text-center p-2">
            <div class="text-sm font-bold text-blue-400">\${fmtCoins(stats.avg_1hour)}</div>
            <div class="text-xs text-gray-400">1時間平均</div>
          </div>
          <div class="stat-card text-center p-2">
            <div class="text-sm font-bold text-green-400">\${fmtCoins(stats.avg_1min)}</div>
            <div class="text-xs text-gray-400">1分平均</div>
          </div>
        \`
      } else {
        document.getElementById('pastPerformance').classList.add('hidden')
      }
    } catch(e) {
      document.getElementById('pastPerformance').classList.add('hidden')
    }
  }

  // ===========================
  // SESSION FLOW
  // ===========================
  function validateStep2() {
    const hasT = !!state.selectedTsum
    const coin = document.getElementById('coinsBeforeInput')?.value
    document.getElementById('startBtn').disabled = !(hasT && coin !== '' && coin !== undefined)
  }

  function onToggleItem(type, checked) {
    if (type === '5to4') {
      state.session.item5to4 = checked
      document.getElementById('toggleRow5to4').classList.toggle('active-5to4', checked)
    } else {
      state.session.itemCoin = checked
      document.getElementById('toggleRowCoin').classList.toggle('active-coin', checked)
    }
  }

  function startSession() {
    const coinsBefore = parseInt(document.getElementById('coinsBeforeInput').value)
    if (!state.selectedTsum) { showToast('ツムを選択してください', 'error'); return }
    if (isNaN(coinsBefore)) { showToast('コイン数を入力してください', 'error'); return }

    state.session.coinsBefore = coinsBefore
    state.session.startTime = Date.now()
    state.session.actualDuration = 30

    document.getElementById('step2').classList.add('hidden')
    document.getElementById('step3').classList.remove('hidden')
    startTimer()
  }

  let timerCtx = null
  function startTimer() {
    const canvas = document.getElementById('timerCanvas')
    timerCtx = canvas.getContext('2d')
    const totalMs = 30 * 60 * 1000

    function draw() {
      const elapsed = Date.now() - state.session.startTime
      const remaining = Math.max(0, totalMs - elapsed)
      const minutes = Math.floor(remaining / 60000)
      const seconds = Math.floor((remaining % 60000) / 1000)
      const progress = 1 - (elapsed / totalMs)

      timerCtx.clearRect(0, 0, 200, 200)

      // Background circle
      timerCtx.beginPath()
      timerCtx.arc(100, 100, 85, 0, Math.PI * 2)
      timerCtx.strokeStyle = 'rgba(255,255,255,0.1)'
      timerCtx.lineWidth = 12
      timerCtx.stroke()

      // Progress arc
      const gradient = timerCtx.createLinearGradient(0, 0, 200, 200)
      gradient.addColorStop(0, '#ff6b9d')
      gradient.addColorStop(1, '#9b59b6')
      timerCtx.beginPath()
      timerCtx.arc(100, 100, 85, -Math.PI / 2, -Math.PI / 2 + (progress * Math.PI * 2))
      timerCtx.strokeStyle = gradient
      timerCtx.lineWidth = 12
      timerCtx.lineCap = 'round'
      timerCtx.stroke()

      document.getElementById('timerDisplay').textContent =
        String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')

      if (remaining <= 0) {
        clearInterval(state.session.timerInterval)
        state.session.actualDuration = 30
        document.getElementById('step3').classList.add('hidden')
        showStep4()
        showToast('30分経過！コイン数を入力してください', 'success')
      }
    }

    draw()
    state.session.timerInterval = setInterval(draw, 500)
  }

  function finishEarly() {
    const elapsed = (Date.now() - state.session.startTime) / 60000
    state.session.actualDuration = Math.max(1, Math.round(elapsed))
    clearInterval(state.session.timerInterval)
    document.getElementById('step3').classList.add('hidden')
    showStep4()
  }

  function cancelSession() {
    clearInterval(state.session.timerInterval)
    document.getElementById('step3').classList.add('hidden')
    document.getElementById('step2').classList.remove('hidden')
  }

  function showStep4() {
    document.getElementById('displayCoinsBefore').textContent = fmtCoins(state.session.coinsBefore)
    document.getElementById('displayDuration').textContent = state.session.actualDuration + '分'
    // アイテム表示
    const itemEl = document.getElementById('displayItems')
    const badges = []
    if (state.session.item5to4) badges.push('<span class="item-badge-5to4">5→4</span>')
    if (state.session.itemCoin) badges.push('<span class="item-badge-coin">コイン</span>')
    if (!badges.length) badges.push('<span class="item-badge-none">なし</span>')
    itemEl.innerHTML = badges.join('')
    document.getElementById('step4').classList.remove('hidden')
  }

  function calcEarned() {
    const after = parseInt(document.getElementById('coinsAfterInput').value)
    if (isNaN(after)) { document.getElementById('earnedPreview').classList.add('hidden'); return }
    const earned = after - state.session.coinsBefore
    document.getElementById('earnedPreview').classList.remove('hidden')
    document.getElementById('earnedCoinsDisplay').textContent = (earned >= 0 ? '+' : '') + fmtCoins(earned)
  }

  async function saveSession() {
    const coinsAfter = parseInt(document.getElementById('coinsAfterInput').value)
    if (isNaN(coinsAfter)) { showToast('コイン数を入力してください', 'error'); return }
    const coinsEarned = coinsAfter - state.session.coinsBefore
    const note = document.getElementById('noteInput').value

    try {
      const res = await axios.post('/api/sessions', {
        user_id: state.currentUser.id,
        tsum_id: state.selectedTsum.id,
        skill_level: state.selectedSkillLevel,
        coins_before: state.session.coinsBefore,
        coins_after: coinsAfter,
        coins_earned: coinsEarned,
        duration_minutes: state.session.actualDuration,
        note,
        item_5to4: state.session.item5to4 ? 1 : 0,
        item_coin: state.session.itemCoin ? 1 : 0
      })

      // Show result
      const per30 = coinsEarned * (30 / state.session.actualDuration)
      const per60 = per30 * 2
      const per1 = per30 / 30

      document.getElementById('step4').classList.add('hidden')
      document.getElementById('step5').classList.remove('hidden')
      document.getElementById('resultTsumName').textContent = state.selectedTsum.name + ' (SL' + state.selectedSkillLevel + ')'
      document.getElementById('result30min').textContent = fmtCoins(Math.round(per30))
      document.getElementById('result1hour').textContent = fmtCoins(Math.round(per60))
      document.getElementById('result1min').textContent = fmtCoins(Math.round(per1))
      document.getElementById('resultSL').textContent = 'SL' + state.selectedSkillLevel

      // アイテムバッジ（結果画面）
      const resultBadges = []
      if (state.session.item5to4) resultBadges.push('<span class="item-badge-5to4">5→4あり</span>')
      if (state.session.itemCoin) resultBadges.push('<span class="item-badge-coin">コインあり</span>')
      document.getElementById('resultItemBadges').innerHTML = resultBadges.join('')

      // Load updated averages
      await loadUpdatedAverages()
      showToast('記録を保存しました！', 'success')
    } catch(e) {
      showToast(e.response?.data?.error || '保存エラー', 'error')
    }
  }

  async function loadUpdatedAverages() {
    try {
      const res = await axios.get(\`/api/sessions/stats?user_id=\${state.currentUser.id}&tsum_id=\${state.selectedTsum.id}&skill_level=\${state.selectedSkillLevel}\`)
      const stats = res.data
      document.getElementById('updatedAvgStats').innerHTML = \`
        <div class="stat-card text-center p-2">
          <div class="text-sm font-bold text-yellow-400">\${fmtCoins(stats.avg_30min)}</div>
          <div class="text-xs text-gray-400">30分平均 (\${stats.count}回)</div>
        </div>
        <div class="stat-card text-center p-2">
          <div class="text-sm font-bold text-blue-400">\${fmtCoins(stats.avg_1hour)}</div>
          <div class="text-xs text-gray-400">1時間平均</div>
        </div>
        <div class="stat-card text-center p-2">
          <div class="text-sm font-bold text-green-400">\${fmtCoins(stats.avg_1min)}</div>
          <div class="text-xs text-gray-400">1分平均</div>
        </div>
      \`
    } catch(e) {}
  }

  function resetToStep1() {
    clearInterval(state.session.timerInterval)
    state.selectedTsum = null
    state.selectedSkillLevel = 1
    state.session = { coinsBefore: 0, startTime: null, timerInterval: null, actualDuration: 30, item5to4: false, itemCoin: false }
    document.getElementById('step2').classList.remove('hidden')
    document.getElementById('step3').classList.add('hidden')
    document.getElementById('step4').classList.add('hidden')
    document.getElementById('step5').classList.add('hidden')
    document.getElementById('selectedTsumInfo').classList.add('hidden')
    document.getElementById('pastPerformance').classList.add('hidden')
    document.getElementById('coinsBeforeInput').value = ''
    document.getElementById('coinsAfterInput').value = ''
    document.getElementById('noteInput').value = ''
    document.getElementById('earnedPreview').classList.add('hidden')
    // トグルリセット
    const t54 = document.getElementById('toggle5to4')
    const tc = document.getElementById('toggleCoin')
    if (t54) { t54.checked = false; document.getElementById('toggleRow5to4').classList.remove('active-5to4') }
    if (tc) { tc.checked = false; document.getElementById('toggleRowCoin').classList.remove('active-coin') }
    state.selectedSeriesId = null
    filterTsums()
    renderSeriesChips()
    validateStep2()
  }

  // ===========================
  // MY STATS (HISTORY TAB)
  // ===========================
  async function loadMyStats() {
    if (!state.currentUser) return
    try {
      const res = await axios.get(\`/api/sessions/my-ranking?user_id=\${state.currentUser.id}\`)
      const data = res.data.ranking || []
      const el = document.getElementById('myRankingList')
      if (!data.length) {
        el.innerHTML = '<div class="text-gray-400 text-sm text-center py-4">まだ記録がありません</div>'
        return
      }
      el.innerHTML = data.map((item, idx) => \`
        <div class="stat-card flex items-center gap-3 p-3">
          <div class="text-lg font-bold text-gray-300 w-6 text-center">\${idx+1}</div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-white">\${item.tsum_name}</span>
              <span class="skill-badge text-xs">SL\${item.skill_level}</span>
            </div>
            <div class="text-xs text-gray-400 mt-1">\${item.count}回計測</div>
          </div>
          <div class="text-right">
            <div class="coin-badge text-xs">\${fmtCoins(Math.round(item.avg_30min))}/30分</div>
            <div class="text-xs text-gray-400 mt-1">\${fmtCoins(Math.round(item.avg_1hour))}/h</div>
          </div>
        </div>
      \`).join('')
    } catch(e) {
      console.error(e)
    }
  }

  async function loadSessionHistory() {
    if (!state.currentUser) return
    try {
      const res = await axios.get(\`/api/sessions?user_id=\${state.currentUser.id}&limit=20\`)
      const sessions = res.data.sessions || []
      const el = document.getElementById('sessionHistory')
      if (!sessions.length) {
        el.innerHTML = '<div class="text-gray-400 text-sm text-center py-4">まだ記録がありません</div>'
        return
      }
      el.innerHTML = sessions.map(s => {
        const per30 = s.coins_earned * (30 / s.duration_minutes)
        const per1 = per30 / 30
        const date = new Date(s.played_at).toLocaleDateString('ja-JP', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})
        return \`
          <div class="stat-card p-3">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium text-white text-sm">\${s.tsum_name}</span>
                <span class="skill-badge text-xs">SL\${s.skill_level}</span>
                \${s.item_5to4 ? '<span class="item-badge-5to4">5→4</span>' : ''}
                \${s.item_coin ? '<span class="item-badge-coin">コイン</span>' : ''}
              </div>
              <span class="text-xs text-gray-400 flex-shrink-0">\${date}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center">
              <div>
                <div class="text-sm font-bold text-yellow-400">\${fmtCoins(Math.round(per30))}</div>
                <div class="text-xs text-gray-500">30分</div>
              </div>
              <div>
                <div class="text-sm font-bold text-blue-400">\${fmtCoins(Math.round(per30*2))}</div>
                <div class="text-xs text-gray-500">1時間</div>
              </div>
              <div>
                <div class="text-sm font-bold text-green-400">\${fmtCoins(Math.round(per1))}</div>
                <div class="text-xs text-gray-500">1分</div>
              </div>
            </div>
            \${s.note ? \`<div class="text-xs text-gray-400 mt-2 italic">💬 \${s.note}</div>\` : ''}
          </div>
        \`
      }).join('')
    } catch(e) {
      console.error(e)
    }
  }

  // ===========================
  // ADMIN
  // ===========================
  async function loadAdminData() {
    await Promise.all([loadAdminSummary(), loadAdminTsumStats()])
  }

  async function loadAdminSummary() {
    try {
      const res = await axios.get('/api/admin/summary')
      const d = res.data
      document.getElementById('adminTotalUsers').textContent = d.total_users || 0
      document.getElementById('adminTotalSessions').textContent = d.total_sessions || 0
      document.getElementById('adminTotalTsums').textContent = d.unique_tsums || 0
      document.getElementById('adminAvgCoins').textContent = fmtCoins(Math.round(d.avg_coins_30min || 0))
    } catch(e) {}
  }

  async function loadAdminTsumStats() {
    const sl = document.getElementById('adminSlFilter')?.value || 'all'
    try {
      const res = await axios.get(\`/api/admin/tsum-ranking?skill_level=\${sl}\`)
      const data = res.data.ranking || []
      const el = document.getElementById('adminTsumRankingList')
      if (!data.length) {
        el.innerHTML = '<div class="text-gray-400 text-sm text-center py-4">データがありません</div>'
        return
      }
      el.innerHTML = data.map((item, idx) => {
        const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other'
        return \`
          <div class="stat-card flex items-center gap-3 p-3">
            <div class="rank-badge \${rankClass}">\${idx+1}</div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-bold text-white text-sm">\${item.tsum_name}</span>
                \${sl === 'all' ? '' : \`<span class="skill-badge text-xs">SL\${sl}</span>\`}
              </div>
              <div class="text-xs text-gray-400">平均: \${fmtCoins(Math.round(item.avg_coins))} | 中央値: \${fmtCoins(Math.round(item.median_coins))}/30min | \${item.session_count}回</div>
            </div>
            <div class="text-right">
              <div class="coin-badge text-xs">\${fmtCoins(Math.round(item.avg_coins))}</div>
              <div class="text-xs text-gray-400 mt-1">\${item.user_count}人</div>
            </div>
          </div>
        \`
      }).join('')
    } catch(e) {
      console.error(e)
    }
  }

  function populateAdminTsumSelect() {
    const el = document.getElementById('adminDetailTsumSelect')
    if (!el) return
    el.innerHTML = '<option value="">ツムを選択...</option>' +
      state.tsums.map(t => \`<option value="\${t.id}">\${t.name} (\${getSeriesName(t.series_id)})</option>\`).join('')
  }

  async function loadAdminTsumDetail() {
    const tsumId = document.getElementById('adminDetailTsumSelect').value
    const sl = document.getElementById('adminDetailSlSelect').value
    if (!tsumId) return
    try {
      const res = await axios.get(\`/api/admin/tsum-detail?tsum_id=\${tsumId}&skill_level=\${sl}\`)
      const data = res.data
      const el = document.getElementById('adminTsumDetail')
      if (!data.stats || !data.stats.length) {
        el.innerHTML = '<div class="text-gray-400 text-sm text-center py-4">データがありません</div>'
        return
      }
      el.innerHTML = data.stats.map(s => \`
        <div class="stat-card p-3">
          <div class="flex items-center gap-2 mb-3">
            <span class="skill-badge">SL\${s.skill_level}</span>
            <span class="text-xs text-gray-400">\${s.count}回計測 / \${s.user_count}人</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <div class="text-lg font-bold text-yellow-400">\${fmtCoins(Math.round(s.avg_coins))}</div>
              <div class="text-xs text-gray-400">30分平均</div>
            </div>
            <div>
              <div class="text-lg font-bold text-blue-400">\${fmtCoins(Math.round(s.median_coins))}</div>
              <div class="text-xs text-gray-400">30分中央値</div>
            </div>
            <div>
              <div class="text-lg font-bold text-green-400">\${fmtCoins(Math.round(s.max_coins))}</div>
              <div class="text-xs text-gray-400">最高30分</div>
            </div>
          </div>
        </div>
      \`).join('')
    } catch(e) {
      console.error(e)
    }
  }

  async function loadAdminUsers() {
    try {
      const res = await axios.get('/api/admin/users')
      const users = res.data.users || []
      const el = document.getElementById('adminUserList')
      el.innerHTML = users.map(u => \`
        <div class="stat-card flex items-center justify-between p-3">
          <div>
            <div class="font-medium text-white">\${u.display_name}</div>
            <div class="text-xs text-gray-400">@\${u.username} ・ \${new Date(u.created_at).toLocaleDateString('ja-JP')}</div>
          </div>
          <div class="text-right">
            <div class="text-sm font-bold text-yellow-400">\${u.session_count}回</div>
            <div class="text-xs text-gray-400">計測回数</div>
          </div>
        </div>
      \`).join('') || '<div class="text-gray-400 text-sm text-center py-4">ユーザーがいません</div>'
    } catch(e) {}
  }

  // ===========================
  // ADD TSUM MODAL
  // ===========================
  let addTsumSeriesMode = 'existing'  // 'existing' | 'new'
  let addTsumSelectedSeriesId = null
  let addTsumSelectedSeriesName = ''

  function openAddTsumModal() {
    addTsumSeriesMode = 'existing'
    addTsumSelectedSeriesId = null
    addTsumSelectedSeriesName = ''
    document.getElementById('newTsumName').value = ''
    document.getElementById('newSeriesName').value = ''
    document.getElementById('seriesSearchInput').value = ''
    document.getElementById('selectedSeriesDisplay').classList.add('hidden')
    document.getElementById('seriesDropdown').classList.add('hidden')
    document.getElementById('addTsumError').classList.add('hidden')
    document.getElementById('submitAddTsumBtn').disabled = true
    setSeriesMode('existing')
    document.getElementById('addTsumModal').classList.remove('hidden')
    setTimeout(() => document.getElementById('newTsumName').focus(), 100)
  }

  function closeAddTsumModal() {
    document.getElementById('addTsumModal').classList.add('hidden')
    document.getElementById('seriesDropdown').classList.add('hidden')
  }

  function setSeriesMode(mode) {
    addTsumSeriesMode = mode
    addTsumSelectedSeriesId = null
    addTsumSelectedSeriesName = ''

    const btnEx = document.getElementById('modeExisting')
    const btnNew = document.getElementById('modeNew')
    const exMode = document.getElementById('seriesExistingMode')
    const newMode = document.getElementById('seriesNewMode')

    const activeStyle = 'background:rgba(52,152,219,0.2);border-color:#3498db;color:#5dade2;'
    const inactiveStyle = 'background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);'

    if (mode === 'existing') {
      btnEx.style.cssText = activeStyle
      btnNew.style.cssText = inactiveStyle
      exMode.classList.remove('hidden')
      newMode.classList.add('hidden')
      document.getElementById('seriesSearchInput').value = ''
      document.getElementById('selectedSeriesDisplay').classList.add('hidden')
    } else {
      btnNew.style.cssText = activeStyle
      btnEx.style.cssText = inactiveStyle
      newMode.classList.remove('hidden')
      exMode.classList.add('hidden')
      setTimeout(() => document.getElementById('newSeriesName').focus(), 50)
    }
    validateAddTsumForm()
  }

  function filterSeriesDropdown() {
    const val = document.getElementById('seriesSearchInput').value.toLowerCase()
    addTsumSelectedSeriesId = null
    addTsumSelectedSeriesName = ''
    document.getElementById('selectedSeriesDisplay').classList.add('hidden')
    showSeriesDropdown(val)
    validateAddTsumForm()
  }

  // シリーズドロップダウン用に絞り込み結果をキャッシュ
  let _filteredSeriesCache = []

  function showSeriesDropdown(filter) {
    const q = (filter !== undefined ? filter : document.getElementById('seriesSearchInput').value.toLowerCase())
    _filteredSeriesCache = state.series.filter(s => !q || s.name.toLowerCase().includes(q)).slice(0, 30)
    const el = document.getElementById('seriesDropdown')
    if (!_filteredSeriesCache.length) { el.classList.add('hidden'); return }
    el.innerHTML = _filteredSeriesCache.map((s, idx) =>
      \`<div class="series-dropdown-item" data-idx="\${idx}">\${s.name}</div>\`
    ).join('')
    // イベント委譲でクリック処理
    el.onclick = (e) => {
      const item = e.target.closest('[data-idx]')
      if (!item) return
      const s = _filteredSeriesCache[parseInt(item.dataset.idx)]
      if (s) selectSeriesFromDropdown(s.id, s.name)
    }
    el.classList.remove('hidden')
  }

  function selectSeriesFromDropdown(id, name) {
    addTsumSelectedSeriesId = id
    addTsumSelectedSeriesName = name
    document.getElementById('seriesSearchInput').value = ''
    document.getElementById('seriesDropdown').classList.add('hidden')
    document.getElementById('selectedSeriesName').textContent = name
    document.getElementById('selectedSeriesDisplay').classList.remove('hidden')
    validateAddTsumForm()
  }

  function clearSeriesSelection() {
    addTsumSelectedSeriesId = null
    addTsumSelectedSeriesName = ''
    document.getElementById('selectedSeriesDisplay').classList.add('hidden')
    document.getElementById('seriesSearchInput').value = ''
    validateAddTsumForm()
  }

  // ドロップダウン外クリックで閉じる
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('seriesDropdown')
    const searchInput = document.getElementById('seriesSearchInput')
    if (dropdown && searchInput && !dropdown.contains(e.target) && e.target !== searchInput) {
      dropdown.classList.add('hidden')
    }
  })

  function validateAddTsumForm() {
    const name = document.getElementById('newTsumName')?.value?.trim()
    let seriesOk = false
    if (addTsumSeriesMode === 'existing') {
      seriesOk = !!addTsumSelectedSeriesId
    } else {
      seriesOk = !!(document.getElementById('newSeriesName')?.value?.trim())
    }
    const btn = document.getElementById('submitAddTsumBtn')
    if (btn) btn.disabled = !(name && seriesOk)
  }

  async function submitAddTsum() {
    const name = document.getElementById('newTsumName').value.trim()
    const errEl = document.getElementById('addTsumError')
    const errMsg = document.getElementById('addTsumErrorMsg')

    let payload = { name }
    if (addTsumSeriesMode === 'existing') {
      if (!addTsumSelectedSeriesId) {
        errMsg.textContent = '作品を選択してください'
        errEl.classList.remove('hidden')
        return
      }
      payload.series_id = addTsumSelectedSeriesId
    } else {
      const newSeries = document.getElementById('newSeriesName').value.trim()
      if (!newSeries) {
        errMsg.textContent = '作品名を入力してください'
        errEl.classList.remove('hidden')
        return
      }
      payload.series_name_new = newSeries
    }

    const btn = document.getElementById('submitAddTsumBtn')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>追加中...'
    errEl.classList.add('hidden')

    try {
      const res = await axios.post('/api/tsums', payload)
      const newTsum = res.data.tsum

      // ローカルstateに追加
      state.tsums.push(newTsum)
      // シリーズが新規の場合はstateにも追加
      if (!state.series.find(s => s.id === newTsum.series_id)) {
        state.series.push({ id: newTsum.series_id, name: newTsum.series_name, sort_order: 200 })
      }

      closeAddTsumModal()
      // 追加したツムを即選択
      filterTsums()
      renderSeriesChips()
      populateAdminTsumSelect()
      await selectTsum(newTsum.id)

      showToast(\`「\${newTsum.name}」を追加しました！\`, 'success')
    } catch(e) {
      const msg = e.response?.data?.error || '追加に失敗しました'
      errMsg.textContent = msg
      errEl.classList.remove('hidden')
      btn.disabled = false
      btn.innerHTML = '<i class="fas fa-plus mr-2"></i>追加する'
    }
  }

  // ===========================
  // UTILS
  // ===========================
  function fmtCoins(n) {
    if (n === null || n === undefined || isNaN(n)) return '-'
    return Math.abs(n) >= 10000
      ? (n / 10000).toFixed(1) + '万'
      : n.toLocaleString()
  }

  function showToast(msg, type = 'info') {
    const el = document.getElementById('toast')
    el.textContent = msg
    el.className = 'fixed bottom-4 right-4 z-[9999] px-6 py-3 rounded-xl font-bold shadow-2xl'
    if (type === 'success') el.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)'
    else if (type === 'error') el.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)'
    else el.style.background = 'linear-gradient(135deg, #3498db, #2980b9)'
    el.classList.remove('hidden')
    setTimeout(() => el.classList.add('hidden'), 3000)
  }

  // Admin tab toggle fix
  function switchAdminTab(tab) {
    const tabs = ['Overview', 'Ranking', 'Users']
    tabs.forEach(t => {
      const lower = t.toLowerCase()
      const tabEl = document.getElementById('adminTab' + t)
      const contentEl = document.getElementById('admin' + t + 'Tab')
      if (tabEl) tabEl.classList.toggle('active', lower === tab)
      if (contentEl) contentEl.classList.toggle('hidden', lower !== tab)
    })
    if (tab === 'overview') { loadAdminSummary(); loadAdminTsumStats() }
    if (tab === 'users') loadAdminUsers()
  }
  </script>
</body>
</html>`
}

export default app
