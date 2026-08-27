const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Tokyo',
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** 日本語の本文からおおよその読了時間を出す（400字/分）。 */
export function readingMinutes(body: string): number {
  const chars = body.replace(/\s/g, '').length;
  return Math.max(1, Math.round(chars / 400));
}
