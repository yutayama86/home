/**
 * Google Search Console からデータを取得する。
 *
 * googleapis パッケージは依存が大きいため、
 * サービスアカウントのJWT署名から自前で行う（Node標準の crypto のみ使用）。
 *
 * 必要な環境変数:
 *   GSC_SERVICE_ACCOUNT_JSON  サービスアカウント鍵のJSON文字列
 *   GSC_SITE_URL              対象プロパティ（例: sc-domain:shikumi-base.com）
 */

import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

const base64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** サービスアカウントの秘密鍵でJWTを作り、アクセストークンと交換する。 */
async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer
    .sign(credentials.private_key, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`アクセストークンの取得に失敗しました: ${response.status} ${await response.text()}`);
  }

  const { access_token: token } = await response.json();
  return token;
}

/** Search Console の設定が揃っているか。 */
export function isConfigured() {
  return Boolean(process.env.GSC_SERVICE_ACCOUNT_JSON && process.env.GSC_SITE_URL);
}

/**
 * 検索パフォーマンスを取得する。
 * @param {object} options
 * @param {string[]} options.dimensions 例: ['page'] / ['page','query']
 * @param {number} options.days 何日分さかのぼるか
 */
export async function fetchSearchAnalytics({ dimensions = ['page'], days = 28, rowLimit = 500 } = {}) {
  if (!isConfigured()) {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON と GSC_SITE_URL が設定されていません');
  }

  const credentials = JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON);
  const token = await getAccessToken(credentials);
  const siteUrl = process.env.GSC_SITE_URL;

  // Search Console のデータは2〜3日遅れるため、終端を3日前にとる
  const end = new Date(Date.now() - 3 * 86400000);
  const start = new Date(end.getTime() - days * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);

  const response = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: iso(start),
        endDate: iso(end),
        dimensions,
        rowLimit,
        type: 'web',
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Search Console の取得に失敗しました: ${response.status} ${await response.text()}`);
  }

  const { rows = [] } = await response.json();
  return {
    period: { start: iso(start), end: iso(end) },
    rows: rows.map((row) => ({
      keys: row.keys,
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    })),
  };
}
