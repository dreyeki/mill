# Mill 次元放送局

個人評價獎項、推薦心得、小遊戲（選擇題／填字）與調查問卷。純靜態網站、手機優先，放在 GitHub Pages 上就能跑，不需要任何建置工具。

## 上線

1. 把這個分支合併到 `main`
2. GitHub 倉庫 → **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**
3. 之後每次 push 到 `main`，`.github/workflows/pages.yml` 會自動：把 Obsidian 筆記轉成 JSON → 部署

網址會是 `https://dreyeki.github.io/mill/`。

> 不想用 Actions 也可以：Source 改選 **Deploy from a branch**（`main` / root）。這種方式不會自動轉檔，記得先在本機跑一次 `python3 tools/import_md.py` 再 push。

## 日常更新

| 想做的事 | 改哪裡 |
| --- | --- |
| 發頭條／文章 | 在 `posts/` 新增一個 `.md` |
| 更新次元排名 | 直接編輯 `次元排名Top100.md` |
| 更新網文／輕小說評分 | 直接編輯 `【網文列表簡評】.md`、`輕小說.md` |
| 新增選擇題 | `data/quizzes.json` |
| 新增填字遊戲 | `data/crosswords.json` |
| 新增問卷 | `data/surveys.json` |
| 自訂獎項 | `data/awards.json` |
| 網站名稱、等級稱號 | `data/site.json` |

改完 md 之後在本機預覽：

```bash
python3 tools/import_md.py      # 重新產生 data/*.json
python3 -m http.server 8000     # 打開 http://localhost:8000
```

## 寫文章

`posts/xxx.md`，檔名就是網址（`#/post/xxx`）。開頭放 frontmatter：

```markdown
---
title: 標題
subtitle: 副標（頭條卡片上的一行字）
category: 樂團速報
color: pink            # pink / sky / mint / lemon / violet / orange
date: 2026-10-01
cover: assets/img/millsage/cover.svg
headline: true         # 放進首頁頭條輪播
pinned: true           # 置頂
minLevel: 1            # 選填：幾級才解鎖
draft: true            # 選填：草稿，不會出現在網站上
tags: [BanG Dream!, millsage]
---
內文……
```

內文支援 Obsidian 常用語法：

- `## 標題`、`**粗體**`、`*斜體*`、`==螢光筆==`、`~~刪除線~~`、`> 引言`、`- 清單`、`---`
- `||暴雷內容||` → 黑條，點了才顯示
- `![說明](assets/img/xxx.png)` 或 Obsidian 的 `![[xxx.png|說明]]`（會自動到 `assets/` 底下找同名檔案）
- **連續兩行以上的圖片**會自動變成可左右滑的相簿
- 站內連結：`[看榜單](#/awards/2025)`

### 換掉 millsage 的示意圖

`assets/img/millsage/` 裡的圖是我用 SVG 畫的原創示意圖，只是用來測試版面。把官方圖放進同一個資料夾，再改 `posts/millsage.md` 裡的檔名（或用一樣的檔名覆蓋）就好。

## 問卷收回答

靜態網站沒有後端，回答預設只存在填寫者自己的瀏覽器。要真的收集回答，最簡單是接 Google 表單：

1. 建一份 Google 表單，題目跟 `data/surveys.json` 對應
2. 表單右上角 ⋮ → **取得預先填入的連結**，隨便填一填按「取得連結」，網址裡會看到 `entry.123456789=...`，每個 `entry.xxx` 就是一題
3. 在問卷設定加上 `submit`：

```json
"submit": {
  "url": "https://docs.google.com/forms/d/e/你的表單ID/formResponse",
  "fields": { "fav": "entry.111111", "want": "entry.222222", "rate": "entry.333333" }
}
```

回答就會出現在 Google 表單的回覆裡。

### 題型

```json
{ "id": "q1", "type": "single", "q": "單選", "options": ["A", "B"], "required": true }
{ "id": "q2", "type": "multi",  "q": "複選", "options": ["A", "B"] }
{ "id": "q3", "type": "rating", "q": "星星評分", "icon": "⭐", "max": 5 }
{ "id": "q4", "type": "scale",  "q": "量表", "max": 5, "labels": ["左", "右"] }
{ "id": "q5", "type": "text",   "q": "自由填答", "placeholder": "提示文字" }
```

## 選擇題與填字格式

```json
{ "id": "my-quiz", "title": "題組名", "icon": "❓",
  "questions": [ { "q": "題目", "options": ["正解", "錯1", "錯2", "錯3"], "answer": 0, "explain": "選填：解說" } ] }
```

選項順序每次都會打亂，`answer` 填正解在 `options` 裡的位置（從 0 開始）。

```json
{ "id": "my-cw", "title": "填字名", "rows": 6, "cols": 8,
  "words": [ { "answer": "詭祕之主", "row": 0, "col": 3, "dir": "down", "clue": "提示" } ] }
```

`row` / `col` 是第一個字的位置（從 0 開始），`dir` 是 `across`（橫）或 `down`（直）。交叉的格子字要一樣。

## 自訂獎項

`data/awards.json`：

```json
[
  { "year": 2025, "title": "站長特別獎",
    "items": [ { "icon": "🎸", "award": "年度樂團", "winner": "millsage", "work": "BanG Dream!" } ] }
]
```

獎項頁另外會依次元排名自動算出「年度第一」「最佳動畫／遊戲／小說角色」「最多上榜作品」「人氣常青」。

## 積分制度

免登入，進度存在訪客自己的瀏覽器（「我的」頁可以複製備份碼換手機）。初始 7 分，每 10 分升 1 級。

| 行為 | 積分 |
| --- | --- |
| 每日簽到 | +2（連續 7 天的倍數再 +5） |
| 讀完一篇文章 | +2 |
| 對文章留下反應 | +1 |
| 閱讀一篇心得 | +1（每天最多 5） |
| 瀏覽某年排名／揭曉前三名 | +1 |
| 選擇題 | 每題 +1，之後只補發刷新紀錄的差額 |
| 完成填字 | +6（每用一次提示 −1，最少 +2） |
| 填寫問卷 | +5 |

## 檔案結構

```
index.html              外殼
css/style.css           所有樣式
js/app.js               路由、等級徽章、升級動畫
js/store.js             積分系統
js/fx.js                微互動（漣漪、飛行積分、彩帶、抽屜、燈箱、音效）
js/md.js                Markdown 渲染
js/pages/*.js           各頁面
tools/import_md.py      Obsidian 筆記 → data/*.json
posts/                  文章
data/                   網站資料
assets/                 圖片
```
