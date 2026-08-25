#!/usr/bin/env bash
# tools/og-image.html を 1200×630 の public/og.png に書き出す。
# Google Chrome のヘッドレスモードを使うので、追加の依存パッケージは不要。
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -x "$chrome" ]; then
  echo "Google Chrome が見つかりません: $chrome" >&2
  exit 1
fi

"$chrome" --headless --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1200,630 \
  --default-background-color=FFFFFFFF \
  --screenshot="$root/public/og.png" \
  "file://$root/tools/og-image.html" >/dev/null 2>&1

echo "public/og.png を生成しました"
