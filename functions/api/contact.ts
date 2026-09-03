/**
 * 問い合わせフォームの受け口（Cloudflare Pages Functions）。
 *
 * 必要な環境変数（Cloudflare Pages → Settings → Environment variables）:
 *   RESEND_API_KEY   Resend の API キー
 *   CONTACT_TO       通知の宛先メールアドレス
 *   CONTACT_FROM     送信元（Resend で認証済みのドメインのアドレス）
 *   TURNSTILE_SECRET_KEY  Cloudflare Turnstile のシークレットキー
 *
 * これらが未設定の場合は 503 を返し、フォーム側で代替の連絡先を案内します。
 * 設定されていないことを黙って握りつぶさないための挙動です。
 */

interface Env {
  RESEND_API_KEY?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
  TURNSTILE_SECRET_KEY?: string;
}

interface Submission {
  topic?: string;
  name?: string;
  company?: string;
  email?: string;
  companyUrl?: string;
  phone?: string;
  businessType?: string;
  monthlyLeads?: string;
  averageOrder?: string;
  hasSalesData?: string;
  decisionMaker?: string;
  message?: string;
  agree?: string;
  'cf-turnstile-response'?: string;
  /** スパム対策用。人間には見えないフィールド。 */
  website?: string;
}

const TOPIC_LABELS: Record<string, string> = {
  'reform-audit': '見積フォロー漏れ診断の適合確認',
  'reform-os': 'リフォーム反響OS 30の導入相談',
  web: 'Web改善・制作',
  sns: 'SNS運用・仕組み化',
  'ai-dx': 'AI・業務改善',
  organize: 'どこから手を付けるべきか整理したい',
  local: '茨城・地域のプロジェクト',
  other: 'その他',
};

const BUSINESS_LABELS: Record<string, string> = {
  'exterior-painting': '外壁塗装',
  roof: '屋根工事',
  'home-renovation': '住宅リフォーム',
  other: 'その他',
};

const MONTHLY_LEADS_LABELS: Record<string, string> = {
  '0-4': '0〜4件',
  '5-9': '5〜9件',
  '10-19': '10〜19件',
  '20-plus': '20件以上',
  unknown: '把握していない',
};

const AVERAGE_ORDER_LABELS: Record<string, string> = {
  'under-80': '80万円未満',
  '80-149': '80万〜149万円',
  '150-plus': '150万円以上',
  unknown: '把握していない',
};

const SALES_DATA_LABELS: Record<string, string> = {
  yes: '確認できる',
  partial: '一部なら確認できる',
  no: '確認できない',
};

const DECISION_MAKER_LABELS: Record<string, string> = {
  yes: '社長または担当責任者が参加できる',
  consult: '社内確認が必要',
  no: '参加できない',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

const MAX_REQUEST_BYTES = 24_000;
const ALLOWED_ORIGINS = new Set(['https://shikumi-base.com', 'https://www.shikumi-base.com']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringRecord = (value: Record<string, unknown>): Submission | null => {
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') return null;
    result[key] = item;
  }
  return result;
};

const parseSubmission = async (request: Request): Promise<Submission | null> => {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return null;

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null;

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/json')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    return isPlainObject(parsed) ? stringRecord(parsed) : null;
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    try {
      const form = await new Response(raw, {
        headers: { 'Content-Type': contentType },
      }).formData();
      const parsed: Record<string, unknown> = {};
      form.forEach((item, key) => {
        parsed[key] = item;
      });
      return stringRecord(parsed);
    } catch {
      return null;
    }
  }

  return null;
};

const within = (value: string, max: number) => value.length <= max;
const isOneOf = (value: string, options: Record<string, string>) => Boolean(options[value]);

interface TurnstileResult {
  success?: boolean;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
}

const verifyTurnstile = async (
  secret: string,
  token: string,
  remoteIp: string | null
): Promise<boolean> => {
  const payload = new URLSearchParams({ secret, response: token });
  if (remoteIp) payload.set('remoteip', remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload,
  });
  if (!response.ok) return false;

  const result = (await response.json()) as TurnstileResult;
  return Boolean(
    result.success &&
      result.action === 'contact' &&
      (!result.hostname || result.hostname === 'shikumi-base.com' || result.hostname === 'www.shikumi-base.com')
  );
};

/* Cloudflare Workers の型定義に依存せず、必要な形だけをここで定義する。 */
interface RequestContext {
  request: Request;
  env: Env;
}

export const onRequestPost = async ({ request, env }: RequestContext): Promise<Response> => {
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(403, { message: 'この送信元からは受け付けられません' });
  }

  let data: Submission | null;
  try {
    data = await parseSubmission(request);
  } catch {
    return json(400, { message: 'リクエストの形式が不正です' });
  }
  if (!data) return json(400, { message: 'リクエストの形式またはサイズが不正です' });

  // ハニーポット。埋まっていれば自動送信とみなし、成功を装って破棄する。
  if (data.website) {
    return json(200, { ok: true });
  }

  const name = (data.name ?? '').trim();
  const company = (data.company ?? '').trim();
  const email = (data.email ?? '').trim();
  const message = (data.message ?? '').trim();
  const topic = (data.topic ?? '').trim();
  const turnstileToken = (data['cf-turnstile-response'] ?? '').trim();
  const isProductTopic = topic === 'reform-audit' || topic === 'reform-os';

  const errors: string[] = [];
  if (!name) errors.push('お名前');
  if (!company) errors.push('会社名・屋号');
  if (!email) errors.push('メールアドレス');
  if (!message) errors.push('ご相談内容');
  if (!topic) errors.push('ご相談の種類');
  if (!data.agree) errors.push('プライバシーポリシーへの同意');

  if (isProductTopic) {
    if (!(data.companyUrl ?? '').trim()) errors.push('会社サイトURL');
    if (!(data.phone ?? '').trim()) errors.push('電話番号');
    if (!(data.businessType ?? '').trim()) errors.push('主な事業');
    if (!(data.monthlyLeads ?? '').trim()) errors.push('月間反響数');
    if (!(data.averageOrder ?? '').trim()) errors.push('平均工事単価');
    if (!(data.hasSalesData ?? '').trim()) errors.push('過去90日の営業数字');
    if (!(data.decisionMaker ?? '').trim()) errors.push('責任者の参加');
  }
  if (errors.length > 0) {
    return json(400, { message: `${errors.join('、')}が未入力です` });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { message: 'メールアドレスの形式が正しくありません' });
  }

  if (!TOPIC_LABELS[topic]) {
    return json(400, { message: 'ご相談の種類が正しくありません' });
  }

  if (
    !within(name, 100) ||
    !within(company, 200) ||
    !within(email, 254) ||
    /[\r\n]/.test(name) ||
    /[\r\n]/.test(company) ||
    /[\r\n]/.test(email)
  ) {
    return json(400, { message: 'お名前、会社名またはメールアドレスが長すぎます' });
  }

  const companyUrl = (data.companyUrl ?? '').trim();
  const phone = (data.phone ?? '').trim();
  if (isProductTopic) {
    if (!within(companyUrl, 500) || !within(phone, 40) || /[\r\n]/.test(phone)) {
      return json(400, { message: '会社サイトURLまたは電話番号が長すぎます' });
    }
    try {
      const url = new URL(companyUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('invalid protocol');
    } catch {
      return json(400, { message: '会社サイトURLの形式が正しくありません' });
    }

    if (!isOneOf(data.businessType ?? '', BUSINESS_LABELS)) {
      return json(400, { message: '主な事業の選択が正しくありません' });
    }
    if (!isOneOf(data.monthlyLeads ?? '', MONTHLY_LEADS_LABELS)) {
      return json(400, { message: '月間反響数の選択が正しくありません' });
    }
    if (!isOneOf(data.averageOrder ?? '', AVERAGE_ORDER_LABELS)) {
      return json(400, { message: '平均工事単価の選択が正しくありません' });
    }
    if (!isOneOf(data.hasSalesData ?? '', SALES_DATA_LABELS)) {
      return json(400, { message: '過去90日の営業数字の選択が正しくありません' });
    }
    if (!isOneOf(data.decisionMaker ?? '', DECISION_MAKER_LABELS)) {
      return json(400, { message: '責任者の参加の選択が正しくありません' });
    }
  }

  if (message.length > 5000) {
    return json(400, { message: 'ご相談内容が長すぎます（5000文字以内）' });
  }

  const TURNSTILE_SECRET_KEY = env.TURNSTILE_SECRET_KEY?.trim();
  if (!TURNSTILE_SECRET_KEY) {
    console.error('TURNSTILE_SECRET_KEY が未設定です');
    return json(503, { message: 'フォームが一時的に利用できません' });
  }
  if (!turnstileToken || !within(turnstileToken, 4096)) {
    return json(400, { message: 'セキュリティ確認を完了してください' });
  }

  try {
    const verified = await verifyTurnstile(
      TURNSTILE_SECRET_KEY,
      turnstileToken,
      request.headers.get('CF-Connecting-IP')
    );
    if (!verified) return json(400, { message: 'セキュリティ確認に失敗しました。再度お試しください' });
  } catch (error) {
    console.error('Turnstile検証で例外が発生しました', error);
    return json(503, { message: 'セキュリティ確認が一時的に利用できません' });
  }

  // 貼り付け時に混入しがちな前後の空白・改行を落とす
  const RESEND_API_KEY = env.RESEND_API_KEY?.trim();
  const CONTACT_TO = env.CONTACT_TO?.trim();
  const CONTACT_FROM = env.CONTACT_FROM?.trim();
  if (!RESEND_API_KEY || !CONTACT_TO || !CONTACT_FROM) {
    // 設定漏れを検知できるようログに残す
    console.error('送信設定が未設定のため送信できません', {
      hasKey: Boolean(RESEND_API_KEY),
      hasTo: Boolean(CONTACT_TO),
      hasFrom: Boolean(CONTACT_FROM),
    });
    return json(503, { message: 'フォームが一時的に利用できません' });
  }

  const topicLabel = TOPIC_LABELS[topic] ?? topic;
  const qualification = isProductTopic
    ? [
        '',
        '--- 事前確認 ---',
        `会社サイト: ${companyUrl}`,
        `電話番号: ${phone}`,
        `主な事業: ${BUSINESS_LABELS[data.businessType ?? ''] ?? data.businessType}`,
        `Web・LINE等の月間反響数: ${MONTHLY_LEADS_LABELS[data.monthlyLeads ?? ''] ?? data.monthlyLeads}`,
        `平均工事単価: ${AVERAGE_ORDER_LABELS[data.averageOrder ?? ''] ?? data.averageOrder}`,
        `過去90日の営業数字: ${SALES_DATA_LABELS[data.hasSalesData ?? ''] ?? data.hasSalesData}`,
        `責任者の参加: ${DECISION_MAKER_LABELS[data.decisionMaker ?? ''] ?? data.decisionMaker}`,
      ]
    : [];

  const body = [
    `ご相談の種類: ${topicLabel}`,
    `お名前: ${name}`,
    `会社名・屋号: ${company}`,
    `メールアドレス: ${email}`,
    ...qualification,
    '',
    '--- ご相談内容 ---',
    message,
    '',
    '--- 送信情報 ---',
    `送信日時: ${new Date().toISOString()}`,
    `参照元: ${request.headers.get('referer') ?? '不明'}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: CONTACT_FROM,
        to: [CONTACT_TO],
        // 受信後そのまま返信できるようにする
        reply_to: email,
        subject: `【シクミベース】${topicLabel}／${name}様`,
        text: body,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      // 設定ミスの切り分けに必要なので、原因はログに残す
      console.error('メール送信に失敗しました', response.status, detail);
      return json(500, { message: '送信処理に失敗しました' });
    }
  } catch (error) {
    console.error('メール送信で例外が発生しました', error);
    return json(500, { message: '送信処理に失敗しました' });
  }

  return json(200, { ok: true });
};
