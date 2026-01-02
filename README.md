## 概要

Next.js (App Router) + Vercel 上で、領収書を Vercel Blob に集約し、Vercel Cron が 6 時間ごとに Gemini（Structured Outputs）で解析、Neon (Postgres) の経費台帳へ INSERT、処理済みプレフィックスへ移動するフローを実装しています。

## 主要なエンドポイント / 画面

- `GET /upload` … 領収書を Blob の `unprocessed/` プレフィックスへアップロードする UI（jpg/jpeg/pdf、複数可）
- `POST /api/blob/upload` … クライアントアップロード用のトークンを払い出す API
- `GET /api/cron/process-receipts` … Vercel Cron 用の処理。Authorization: `Bearer <CRON_SECRET>` 必須

## 環境変数

ローカルでは `.env.local`、Vercel では Environment Variables として設定してください。

```
DATABASE_URL=postgres://...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3-flash-preview
BLOB_READ_WRITE_TOKEN=...
CRON_SECRET=change-me
DEFAULT_CREDIT_ACCOUNT=普通預金
MAX_FILES_PER_RUN=50
MAX_FILE_BYTES=10485760
TAX_FALLBACK_RATE=0.1
```

## セットアップ

```bash
pnpm install
pnpm dev   # http://localhost:3000
```

### 手動テスト

6 時間ごとの Cron 相当を手動で叩く場合:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/process-receipts
```

動作確認の流れ:

1. `/upload` で jpg/jpeg/pdf を選択しアップロードすると、Blob に `unprocessed/<日付>/...` が作成されます。
2. 上記 curl で Cron を実行すると、Gemini が解析し Neon の `expense_ledger` に INSERT されます。
3. 処理済みの Blob は `processed/` プレフィックスへコピーされ、元の `unprocessed/` は削除されます。

## デプロイ

`vercel.json` により `/api/cron/process-receipts` が 6 時間おきに実行されます。GitHub へ push → Vercel Preview、main 反映で Production にデプロイされます。
