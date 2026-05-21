#!/usr/bin/env bash
# verify_icon_map.sh — Đếm thật entries trong apps/web/lib/icon-map.ts
# Mục đích: resolve conflict 73 vs 60→66 trong S-01 governance docs
#
# Cách chạy (từ repo root ~/projects/icpp/sicp/):
#   bash verify_icon_map.sh
#
# Hoặc cd vào apps/web rồi chạy trực tiếp các commands bên dưới.

set -eu

FILE="apps/web/lib/icon-map.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ Không tìm thấy $FILE"
  echo "   Chạy script này từ repo root (~/projects/icpp/sicp/)"
  exit 1
fi

echo "================================================"
echo " ICON-MAP COUNT VERIFICATION"
echo " File: $FILE"
echo " Size: $(wc -l < "$FILE") lines"
echo "================================================"
echo ""

# Method 1: Đếm entries trong ICON_MAP record block
# Pattern: dòng kiểu `  'icon-name': IconComponent,` hoặc `  "icon-name": IconComponent,`
echo "── Method 1: Đếm key entries trong ICON_MAP record ──"
COUNT_KEYS=$(grep -cE "^[[:space:]]+['\"][a-z][a-z0-9-]*['\"]:[[:space:]]" "$FILE" || true)
echo "  Số key entries: $COUNT_KEYS"
echo ""

# Method 2: Đếm imports từ lucide-react
echo "── Method 2: Đếm imports từ lucide-react ──"
# Lấy phần giữa `import { ... } from 'lucide-react'` rồi đếm names
IMPORTS=$(awk '/from .lucide-react/{flag=0} flag{print} /import \{/{flag=1}' "$FILE" \
  | tr ',' '\n' \
  | grep -cE '^[[:space:]]*[A-Z]' || true)
echo "  Số lucide-react imports: $IMPORTS"
echo ""

# Method 3: Đếm tên trong IconName union (nếu định nghĩa as `type IconName = 'a' | 'b' | ...`)
echo "── Method 3: Đếm names trong IconName union type ──"
# Tìm dòng `export type IconName = ...` và đếm `|` separators
UNION_LINE=$(grep -nE "^export type IconName" "$FILE" | head -1 || echo "")
if [ -n "$UNION_LINE" ]; then
  LINE_NUM=$(echo "$UNION_LINE" | cut -d: -f1)
  # Đọc multi-line union (tới dấu `;`)
  UNION_TEXT=$(sed -n "${LINE_NUM},/;/p" "$FILE")
  UNION_COUNT=$(echo "$UNION_TEXT" | grep -oE "'[a-z][a-z0-9-]*'" | sort -u | wc -l)
  echo "  Số unique names trong union: $UNION_COUNT"
else
  echo "  (IconName định nghĩa qua keyof ICON_MAP, không phải string union — skip)"
fi
echo ""

# Method 4: Đếm via ALL_ICON_NAMES array (nếu có)
echo "── Method 4: Đếm ALL_ICON_NAMES array ──"
ARRAY_LINE=$(grep -nE "export const ALL_ICON_NAMES" "$FILE" | head -1 || echo "")
if [ -n "$ARRAY_LINE" ]; then
  LINE_NUM=$(echo "$ARRAY_LINE" | cut -d: -f1)
  # Đọc tới `]` đầu tiên
  ARRAY_TEXT=$(sed -n "${LINE_NUM},/\];/p" "$FILE")
  ARRAY_COUNT=$(echo "$ARRAY_TEXT" | grep -oE "'[a-z][a-z0-9-]*'" | wc -l)
  echo "  Số entries trong ALL_ICON_NAMES: $ARRAY_COUNT"
else
  echo "  (Không có ALL_ICON_NAMES array hoặc generate runtime từ Object.keys)"
fi
echo ""

# Method 5: List tất cả icon names ra để verify thủ công
echo "── Method 5: Liệt kê tất cả icon names (key trong ICON_MAP) ──"
grep -oE "^[[:space:]]+['\"][a-z][a-z0-9-]*['\"]:" "$FILE" \
  | grep -oE "[a-z][a-z0-9-]*" \
  | sort \
  | uniq -c \
  | sort -rn \
  | head -80
echo ""

echo "================================================"
echo " VERDICT"
echo "================================================"
if [ "$COUNT_KEYS" = "$IMPORTS" ]; then
  echo "  ✅ Keys == Imports = $COUNT_KEYS — consistent"
  echo "  → Số icons thật trong icon-map: $COUNT_KEYS"
elif [ "$COUNT_KEYS" -gt "$IMPORTS" ]; then
  echo "  ⚠️  Keys ($COUNT_KEYS) > Imports ($IMPORTS) — có thể có duplicate key hoặc alias"
  echo "  → Số icon UNIQUE: kiểm tra Method 5 list ở trên"
else
  echo "  ⚠️  Imports ($IMPORTS) > Keys ($COUNT_KEYS) — import thừa hoặc map thiếu"
fi
echo ""
echo "  Đối chiếu với governance:"
echo "  - INDEX_PROJECT.md dòng 130 (T02 emit): 73"
echo "  - INDEX_SLICES.md dòng 345 (T02 emit): 73"
echo "  - S-01_decisions-log.md dòng 935 (T04 DISCOVER): 73"
echo "  - INDEX_PROJECT.md dòng 190 + C-30: T03 baseline 60 → T06 +6 = 66"
echo "  → Nếu thật = 73: governance T06 (C-30) sai, cần patch '60→66' thành con số thật"
echo "  → Nếu thật = 66: governance T02 sai, cần patch '73 icons' thành '66 icons'"
echo "  → Nếu khác cả 2: chuẩn hoá toàn slice về con số thật"
