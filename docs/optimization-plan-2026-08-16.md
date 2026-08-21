# html-share-vault 最適化計画 — 2026-08-16

比較対象と自作物の差分、検証項目の全件、反復ループの工程、ミクロ／マクロ目標。
実測はすべて本ドキュメント内に日付付きで残す。推測と実測を混ぜない。

## 0. 比較対象

- 上流: `minorun365/html-share`（HTML共有くん）。2026-08-13 作成、★53、fork 4、Apache-2.0。取得日 2026-08-16。
  AWS セルフホスト（CDK / CloudFront / S3 / DynamoDB / Lambda / Cognito / SSM）。CLI + エージェント Skill が本体。
- 自作: `Nicolas0315/html-share-vault`。2026-06-09 初回コミット。
  Cloudflare Pages + Pages Functions + Workers KV。ブラウザ UI が本体。本番 `https://html-share-vault.pages.dev/`（2026-08-16 実測 200 / 0.094s）。

同じ「AI が生成した HTML を人に見せる」課題に対し、**スコープが違う**。上流は "ためる・並べる・スマホで承認する" ワークフロー基盤、自作は "1枚を鍵付きで渡す" 配信器。

## 1. 精密比較

| 軸 | 上流 html-share | 自作 html-share-vault | 判定 |
|---|---|---|---|
| 実行基盤 | AWS（CDK 一式） | Cloudflare Pages + KV | 自作優位（運用面） |
| 月額実費 | CloudFront + S3 + DynamoDB + Lambda + Cognito 分が発生 | 実質 0 円（Free 枠内） | **自作優位** |
| セットアップ | AWS アカウント + CDK bootstrap + ドメイン2つ + 鍵生成 | KV 作成 + secret 1本 + `npm run deploy` | **自作優位** |
| 呼び出し口 | CLI (`html-share`) + Skill 3種（create-html / inbox / mobile） | ブラウザのフォームのみ → **本日 CLI 追加** | 上流優位（Skill 未整備） |
| 蓄積・一覧 | プロジェクト別ダッシュボード、ストリーム、日付 | 管理画面の平坦なリスト | 上流優位 |
| 閲覧認証 | CloudFront 署名 URL / 署名 Cookie（Cognito 本人認証） | 共有ごとのパスワード（PBKDF2-SHA-256 / 10k / salt） | 引き分け（設計思想が別） |
| 隔離境界 | 管理面と閲覧面を**別オリジン**に分離 + `sandbox allow-scripts` | 同一オリジン → **本日 `sandbox` で opaque origin 化** | 解消済（下記 V1） |
| 共有期限 | 無期限 URL を発行しない（上限も設定で強制） | 無期限だった → **本日 既定7日 / 上限90日** | 解消済（下記 V5） |
| ローカル資産 | CLI が data URL 化して単一 HTML に埋め込み（許可拡張子・サイズ制限・realpath 検査） | 単一 HTML のみ受け付け、外部 CDN は素通し | **上流優位（未着手）** |
| モバイル | 表のカード畳み、インボックス、非同期承認 | なし | 上流優位（別スコープ） |
| CSP | CloudFront ResponseHeadersPolicy で管理面／閲覧面を出し分け | なし → **本日 `public/_headers` + Function 側で付与** | 解消済（V2/V3） |
| テスト | `tsx --test` + skill/plugin 検証 + `security-scan` + `npm audit --omit=dev` | `node --test` 単体のみ | 上流優位（後述 M-4） |
| CI | ci.yml + dependabot + ISSUE/PR テンプレ + SECURITY.md | deploy ワークフローのみ | 上流優位 |
| 公開性 | 公開 OSS、★53、外部貢献導線あり | private 想定、外部導線なし | 意図的差分 |
| 上限 | S3 なので実質上限なし | KV 値 25 MiB → 24 MiB で拒否 | 上流優位（実害小） |

### 構造的な結論

- **自作の勝ち筋は「コスト0 × セットアップ数分 × エッジ配信」**。AWS 一式を建てる上流にはここで永久に追いつかれない。
- **自作の負け筋は「エージェントから呼べないこと」**。上流の本体は CLI と Skill であり、ブラウザにトークンを貼る運用は同じ土俵に立てていない。本日 CLI を入れて最初の一歩を埋めた。
- 上流の脅威モデル（`docs/threat-model.md`）は自作より一段厳密で、そのうち**オリジン分離・無期限禁止・CSP** の3点は自作にそのまま移植できる欠落だった。移植済み。

## 2. 検証項目（全件）

合格条件を満たさない項目は「未達」と書く。緑にしない。

### A. セキュリティ境界

| ID | 検証内容 | 実行 | 合格条件 | 2026-08-16 実測 |
|---|---|---|---|---|
| V1 | アップロード HTML が opaque origin に落ちる | ブラウザで `/share/<id>` を開き `window.origin` / `document.cookie` / `sessionStorage` を評価 | origin=`null`、cookie と storage が SecurityError | **PASS**（origin `null`、両方 SecurityError） |
| V2 | 共有 HTML から他の共有を読めない | 同ページで `fetch('/share/<別id>', {credentials:'include'})` | 失敗する | **PASS**（`Failed to fetch`） |
| V3 | 共有 HTML のレスポンスヘッダ | `curl -D-` | `content-security-policy: sandbox allow-scripts…`、`nosniff`、`no-referrer`、`x-robots-tag: noindex` | **PASS** |
| V4 | 静的面（`/`, `/admin/`）のヘッダ | `curl -D-` | CSP `default-src 'none'` 系、`X-Frame-Options: DENY`、HSTS | **PASS**（`_headers` 3 rules parsed） |
| V5 | 誤パスワードが拒否される | `curl -X POST -d password=wrong` | 401 かつ本文が返らない | **PASS** |
| V6 | パスワードは平文保存されない | `tests/share.test.js` | metadata に `passwordHash` / `passwordSalt` が出ない | **PASS** |
| V7 | admin API と upload が無トークンで叩けない | `npm run e2e` | 両方 401 | **PASS** |
| V8 | 共有 ID のパストラバーサル拒否 | `isValidShareId` | 32桁 hex 以外を拒否 | **PASS** |
| V9 | 秘密が git に入らない | `scripts/publish-preflight.ps1` + gitleaks | 検出 0 | 未実施（本変更では新規秘密なし） |

### B. 機能・データ寿命

| ID | 検証内容 | 実行 | 合格条件 | 実測 |
|---|---|---|---|---|
| V10 | 既定期限が 7 日 | `npm test` | `expiresAt` が +7日 | **PASS** |
| V11 | 期限の範囲外を拒否 | `curl` で `expiresInDays: 91` | 400 + メッセージ | **PASS** |
| V12 | パスワード再設定で TTL が消えない | 単体テスト（`putOptions`） | `expirationTtl > 0` かつ `expiresAt` 不変 | **PASS**（実 KV での TTL 残存は未観測 → V13） |
| V13 | 期限到来で実際に消える | 短 TTL share を作り 61 秒後に GET | 404 | **未実施**（次ループで実施） |
| V14 | 旧レコードの後方互換 | 管理画面で 2026-06-09 のレコード表示 | 「無期限」と表示され壊れない | **PASS**（実測） |
| V15 | 管理 UI が新 CSP 下で動く | Playwright で接続〜一覧描画 | console error 0、列が揃う | **PASS**（error 0） |
| V16 | CLI が実際にアップロードできる | `node scripts/share.mjs <file>` | URL / password / expires を返す | **PASS** |
| V17 | 24 MiB 超を拒否 | 大サイズ POST | 400 | 未実施 |

### C. 性能・コスト

| ID | 検証内容 | 合格条件 | 実測 |
|---|---|---|---|
| V18 | 本番ルート応答 | < 300ms | **PASS**（0.094s / NRT） |
| V19 | share 配信の TTFB | < 500ms | 未計測 |
| V20 | Workers CPU 予算内（PBKDF2 10k） | エラーなし | 既存デプロイで実績あり |
| V21 | 月額 | 0 円 | Free 枠。KV 書き込み 1000/日 上限に注意 |

### D. 運用

| ID | 検証内容 | 合格条件 | 状態 |
|---|---|---|---|
| V22 | `npm run check` | 構文エラー 0 | **PASS** |
| V23 | `npm test` | 全 PASS | **PASS**（11/11） |
| V24 | 依存の既知脆弱性 | `npm audit --omit=dev --audit-level=high` が 0 | 未導入（M-4） |
| V25 | デプロイ前の別エンジン合議 | 認証・ランタイム変更は別エンジンの読み取り専用レビュー | **未実施 → デプロイ前の必須ゲート** |

## 3. ループ工程（強いサービスを作る反復エンジン）

1周 = 1つの検証可能な差分。原則「1周につき 1 つの P0/P1 だけ」。

```
L0 計測      現状のヘッダ・応答・コスト・使用回数を実コマンドで取る（推測禁止）
L1 差分抽出  比較対象（上流 / 競合 / 自分の理想）との差を列挙し、事実だけ書く
L2 仮説      差分を「収益 or 摩擦 or 事故確率」のどれに効くかで分類、1つ選ぶ
L3 最小実装  最短の差分で実装。既存の型・命名に合わせる。抽象化しない
L4 検証      対応する V-ID を実行。ユニット → 実ランタイム → ブラウザの順に必ず全部
L5 合議      認証・ランタイム・状態変更なら別エンジンで読み取り専用レビュー（不一致は NEEDS_REVIEW.md）
L6 投入      デプロイ。ロールバック手順を先に書く
L7 実データ  本番のヘッダ／応答／利用実績を再計測し L0 に戻す
```

### ゲート条件

- L3 → L4: `npm run check` と `npm test` が緑。
- L4 → L5: 実ランタイム（`wrangler pages dev`）で対象 V-ID が PASS。**ユニットだけで先へ進まない。**
- L5 → L6: 別エンジンが同一スコープで反対しない。反対は `NEEDS_REVIEW.md` へ。憲法抵触は停止。
- L6 → L7: ロールバック手順（直前コミット SHA + `wrangler pages deployment` の戻し方）を記録済み。

### 停止条件

- 同一 V-ID が 2 周連続で未達 → 実装ではなく設計を疑い、L1 に戻す。
- 1周で触るファイルが 5 を超える → スコープを割る。
- コストが 0 円を超えた → 機能ではなく設計を見直す（自作の勝ち筋を壊さない）。

### 周期

- P0（事故確率）: 発見即周回。
- P1（摩擦）: 週1周。
- P2（体裁）: 溜めて月1周。

## 4. 目標

### マクロ（〜2026-11-23、可処分時間が縮む前まで）

**「Claude / Codex の出力を、ブラウザを開かずに 1 コマンドで期限付き共有でき、月額 0 円で回り続ける状態」**

達成条件（すべて実測で示せること）:
1. エージェントのセッションから `share` 相当を呼ぶだけで URL とパスワードが返る（Skill 経由でコマンド名を覚えなくてよい）。
2. アップロード HTML が管理面・他共有・Cookie に一切触れない（V1/V2 が常時 PASS）。
3. 無期限 URL が存在しない（V10〜V13 が常時 PASS）。
4. 月額 0 円のまま。
5. `npm run verify` 相当 1 コマンドで A〜D の自動化可能な V-ID が全部回る。

### ミクロ（次の 1〜3 周）

- **M-1（完了）** アップロード HTML の opaque origin 化。→ V1/V2/V3 PASS。
- **M-2（完了）** 共有の既定期限 7 日・上限 90 日、TTL を消さない書き戻し。→ V10/V11/V12/V14 PASS。
- **M-3（完了）** 静的面のセキュリティヘッダと CLI。→ V4/V15/V16 PASS。
- **M-4（完了）** `npm run verify` = `check` + `test` + `e2e`（`scripts/e2e.mjs` が wrangler を起動し 21 アサーション）。CI の Verify ステップも差し替え済み。`audit:prod` はネットワーク依存のため verify から分離。
- **M-5（完了）** `skills/share-html/SKILL.md` を追加。「このHTMLを共有して」で CLI に落ちる。`.claude/` はこのリポでは `.git/info/exclude` で管理外のため、フリート規約どおりリポ直下 `skills/` に置いた（上流も同じ配置）。
- **M-6（次）** V13（実 KV の期限到来）と V17（サイズ上限）と V19（share TTFB）の実測を取る。
- **M-7** 上流の資産インライン化を移植するか判断。CDN 依存の生成 HTML を壊さない範囲で、ローカル画像の data URL 化だけ取り込む。

### 対象外（意図的にやらない）

- モバイル承認・インボックス（上流の別スコープ。自分の課題ではない）。
- 別オリジン分離（カスタムドメイン2枚）。`sandbox` で境界は取れており、追加コストと運用が割に合わない。
- 総当たり対策の自前実装。32桁 hex の ID + 14文字以上のパスワードで現実的でない。必要になったら Cloudflare の Rate Limiting ルールで済ませる。

## 5. 本日の変更と巻き戻し

変更ファイル:
- `functions/_lib/share.js` — `SHARE_CSP` / `shareHtmlHeaders` / `resolveExpiry` / `remainingTtlSeconds` / `putOptions` を追加、`buildShareRecord` と `buildShareMetadata` に `expiresAt`。
- `functions/share/[id].js` — 共有 HTML と パスワードフォームにヘッダ付与。
- `functions/api/upload.js` — 期限の受け取りと TTL 付き put。
- `functions/api/admin/shares/[id].js` — 書き戻しで TTL を維持。
- `functions/api/admin/shares.js` — 一覧に `expiresAt`。
- `public/_headers`（新規）、`public/index.html`、`public/app.js`、`public/admin/index.html`、`public/admin/app.js`。
- `scripts/share.mjs`（新規 CLI）、`scripts/e2e.mjs`（新規 実ランタイム検証）、`tests/share.test.js`（+4 テスト）。
- `skills/share-html/SKILL.md`（新規）、`package.json`（`e2e` / `verify` / `audit:prod` / `share`）、`.github/workflows/deploy-cloudflare-pages.yml`（Verify を `npm run verify` に）、`README.md`、`AGENTS.md`。

巻き戻し: 直前コミットは `b999d53`。`git checkout b999d53 -- functions public tests` で復帰、`scripts/share.mjs` と `public/_headers` は削除。デプロイ済みなら Cloudflare Pages の直前デプロイへロールバック。
