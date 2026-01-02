## 概要

Next.js (App Router) + Vercel 上で、領収書を Google Drive に集約し、Vercel Cron が 6 時間ごとに Gemini（Structured Outputs）で解析、Neon (Postgres) の経費台帳へ INSERT、処理済みフォルダへ移動するフローを実装しています。

## 環境変数

ローカルでは `.env.local`、Vercel では Environment Variables として設定してください。改行が失われたサービスアカウント鍵は `\n` を実際の改行に戻します。

```
DATABASE_URL=postgres://...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3-flash-preview
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GDRIVE_UNPROCESSED_FOLDER_ID=...
GDRIVE_PROCESSED_FOLDER_ID=...
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

## デプロイ

`vercel.json` により `/api/cron/process-receipts` が 6 時間おきに実行されます。GitHub へ push → Vercel Preview、main 反映で Production にデプロイされます。
