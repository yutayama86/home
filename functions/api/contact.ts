/**
 * 問い合わせフォームの受け口（Cloudflare Pages Functions）。
 *
 * 必要な環境変数（Cloudflare Pages → Settings → Environment variables）:
 *   RESEND_API_KEY   Resend の API キー
 *   CONTACT_TO       通知の宛先メールアドレス
 *   CONTACT_FROM     送信元（Resend で認証済みのドメインのアドレス）
 *
 * これらが未設定の場合は 503 を返し、フォーム側で代替の連絡先を案内します。
 * 設定されていないことを黙って握りつぶさないための挙動です。
 */

interface Env {
  RESEND_API_KEY?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
}

interface Submission {
  topic?: string;
  name?: string;
  company?: string;
  email?: string;
  message?: string;
  agree?: string;
  /** スパム対策用。人間には見えないフィールド。 */
  website?: string;
}

const TOPIC_LABELS: Record<string, string> = {
  web: 'Web改善・制作',
  sns: 'SNS運用・仕組み化',
  'ai-dx': 'AI・業務改善',
  organize: 'どこから手を付けるべきか整理したい',
  local: '茨城・地域のプロジェクト',
  other: 'その他',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

/* Cloudflare Workers の型定義に依存せず、必要な形だけをここで定義する。 */
interface RequestContext {
  request: Request;
  env: Env;
}

export const onRequestPost = async ({ request, env }: RequestContext): Promise<Response> => {
  let data: Submission;
  try {
    data = await request.json();
  } catch {
    return json(400, { message: 'リクエストの形式が不正です' });
  }

  // ハニーポット。埋まっていれば自動送信とみなし、成功を装って破棄する。
  if (data.website) {
    return json(200, { ok: true });
  }

  const name = (data.name ?? '').trim();
  const email = (data.email ?? '').trim();
  const message = (data.message ?? '').trim();
  const topic = (data.topic ?? '').trim();

  const errors: string[] = [];
  if (!name) errors.push('お名前');
  if (!email) errors.push('メールアドレス');
  if (!message) errors.push('ご相談内容');
  if (!topic) errors.push('ご相談の種類');
  if (errors.length > 0) {
    return json(400, { message: `${errors.join('、')}が未入力です` });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { message: 'メールアドレスの形式が正しくありません' });
  }

  if (message.length > 5000) {
    return json(400, { message: 'ご相談内容が長すぎます（5000文字以内）' });
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
  const company = (data.company ?? '').trim() || '（未記入）';

  const body = [
    `ご相談の種類: ${topicLabel}`,
    `お名前: ${name}`,
    `会社名・屋号: ${company}`,
    `メールアドレス: ${email}`,
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
