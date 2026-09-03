/**
 * Google Analytics Data API から、日次の集客・問い合わせファネルを取得する。
 *
 * 外部SDKは使わず、Node標準の crypto と fetch だけでサービスアカウント認証を行う。
 *
 * 必要な環境変数:
 *   GA4_PROPERTY_ID        GA4の数値プロパティID
 *   GOOGLE_ACCESS_TOKEN    GitHub Actions のWorkload Identityで発行する短時間トークン
 *
 * ローカル確認時のみ、GA4_SERVICE_ACCOUNT_JSON / GSC_SERVICE_ACCOUNT_JSON も使用できる。
 */

import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const TRACKED_EVENTS = [
  'view_offer',
  'cta_click',
  'contact_form_start',
  'generate_lead',
  'form_error',
  'diagnosis_form_start',
  'diagnosis_application',
];

const base64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

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
    throw new Error(`GA4用アクセストークンの取得に失敗しました: ${response.status} ${await response.text()}`);
  }

  const { access_token: token } = await response.json();
  return token;
}

function credentialsJson() {
  return process.env.GA4_SERVICE_ACCOUNT_JSON || process.env.GSC_SERVICE_ACCOUNT_JSON;
}

/** GA4 Data API の設定が揃っているか。 */
export function isGa4Configured() {
  return Boolean(
    (process.env.GOOGLE_ACCESS_TOKEN || credentialsJson()) && process.env.GA4_PROPERTY_ID
  );
}

const tokyoIso = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

function period(days, offsetDays = 0) {
  const end = new Date(Date.now() - (1 + offsetDays) * 86400000);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  return { start: tokyoIso(start), end: tokyoIso(end) };
}

function metricMap(response) {
  const headers = (response.metricHeaders ?? []).map((item) => item.name);
  const values = response.rows?.[0]?.metricValues ?? [];
  return {
    activeUsers: 0,
    sessions: 0,
    screenPageViews: 0,
    ...Object.fromEntries(headers.map((name, index) => [name, Number(values[index]?.value ?? 0)])),
  };
}

function eventMap(response) {
  const events = Object.fromEntries(TRACKED_EVENTS.map((name) => [name, 0]));
  for (const row of response.rows ?? []) {
    const name = row.dimensionValues?.[0]?.value;
    if (name) events[name] = Number(row.metricValues?.[0]?.value ?? 0);
  }
  return events;
}

function pageRows(response) {
  return (response.rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? '(not set)',
    activeUsers: Number(row.metricValues?.[0]?.value ?? 0),
    sessions: Number(row.metricValues?.[1]?.value ?? 0),
    views: Number(row.metricValues?.[2]?.value ?? 0),
  }));
}

/** 直近期間とその直前期間のサマリー、イベント、上位ページを返す。 */
export async function fetchGa4Summary({ days = 7 } = {}) {
  if (!isGa4Configured()) {
    throw new Error('GA4_PROPERTY_ID とGoogle認証情報が設定されていません');
  }

  const token = process.env.GOOGLE_ACCESS_TOKEN
    ? process.env.GOOGLE_ACCESS_TOKEN
    : await getAccessToken(JSON.parse(credentialsJson()));
  const propertyId = process.env.GA4_PROPERTY_ID.replace(/^properties\//, '');
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const currentPeriod = period(days, 0);
  const previousPeriod = period(days, days);

  const request = async (body) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`GA4 Data APIの取得に失敗しました: ${response.status} ${await response.text()}`);
    }

    return response.json();
  };

  const totalsBody = (range) => ({
    dateRanges: [{ startDate: range.start, endDate: range.end }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
    ],
  });

  const eventsBody = (range) => ({
    dateRanges: [{ startDate: range.start, endDate: range.end }],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: TRACKED_EVENTS },
      },
    },
    limit: String(TRACKED_EVENTS.length),
  });

  const pagesBody = {
    dateRanges: [{ startDate: currentPeriod.start, endDate: currentPeriod.end }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: '10',
  };

  const [currentTotals, previousTotals, currentEvents, previousEvents, pages] = await Promise.all([
    request(totalsBody(currentPeriod)),
    request(totalsBody(previousPeriod)),
    request(eventsBody(currentPeriod)),
    request(eventsBody(previousPeriod)),
    request(pagesBody),
  ]);

  return {
    current: {
      period: currentPeriod,
      ...metricMap(currentTotals),
      events: eventMap(currentEvents),
    },
    previous: {
      period: previousPeriod,
      ...metricMap(previousTotals),
      events: eventMap(previousEvents),
    },
    topPages: pageRows(pages),
  };
}
