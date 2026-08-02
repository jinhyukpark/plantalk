#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="${0:A:h:h}"
API_BASE_URL="${API_BASE_URL:-http://localhost:5001/api/v1}"
DEMO_PASSWORD="${DEMO_PASSWORD:?DEMO_PASSWORD 환경변수가 필요합니다.}"

profiles=(
  "demo_hana|demo.hana@plantalk.example|여성 데모 · 카페와 여행을 좋아해요"
  "demo_yuna|demo.yuna@plantalk.example|여성 데모 · 전시와 맛집 탐방을 즐겨요"
  "demo_seoyeon|demo.seoyeon@plantalk.example|여성 데모 · 책과 도예, 등산을 좋아해요"
  "demo_mina|demo.mina@plantalk.example|여성 데모 · 건축과 음악을 좋아해요"
  "demo_jiwon|demo.jiwon@plantalk.example|여성 데모 · 운동과 반려견 산책을 즐겨요"
  "demo_junho|demo.junho@plantalk.example|남성 데모 · 러닝과 요리를 좋아해요"
  "demo_minseok|demo.minseok@plantalk.example|남성 데모 · 사진과 음악을 즐겨요"
  "demo_doyun|demo.doyun@plantalk.example|남성 데모 · 농구와 캠핑을 좋아해요"
  "demo_hyunwoo|demo.hyunwoo@plantalk.example|남성 데모 · 독서와 미술관을 즐겨요"
  "demo_taemin|demo.taemin@plantalk.example|남성 데모 · 여행과 자전거를 좋아해요"
)

for entry in "${profiles[@]}"; do
  IFS='|' read -r nickname email bio <<< "$entry"
  profile_dir="$PROJECT_ROOT/assets/demo-profiles/$nickname"

  existing="$(curl -fsS "$API_BASE_URL/users/nickname/$nickname" 2>/dev/null || true)"
  user_id="$(print -r -- "$existing" | jq -r '.id // empty')"

  if [[ -z "$user_id" ]]; then
    created="$(curl -fsS -X POST "$API_BASE_URL/users" \
      -H 'Content-Type: application/json' \
      --data "$(jq -nc \
        --arg nickname "$nickname" \
        --arg password "$DEMO_PASSWORD" \
        --arg email "$email" \
        '{nickname:$nickname,password:$password,email:$email,nationality:"KR"}')")"
    user_id="$(print -r -- "$created" | jq -r '.id')"
    echo "계정 생성: $nickname"
  else
    echo "기존 계정 사용: $nickname"
  fi

  curl -fsS -X PUT "$API_BASE_URL/users/$user_id/bio" \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg bio "AI 생성 테스트 프로필 · $bio" '{bio:$bio}')" >/dev/null

  curl -fsS -X PUT "$API_BASE_URL/users/$user_id/profile-picture" \
    -F "file=@$profile_dir/photo-1.jpg;type=image/jpeg" >/dev/null

  current_photo_count="$(curl -fsS "$API_BASE_URL/users/$user_id/photos" | jq 'length')"
  if (( current_photo_count == 0 )); then
    for photo_number in {2..6}; do
      curl -fsS -X POST "$API_BASE_URL/users/$user_id/photos" \
        -F "file=@$profile_dir/photo-$photo_number.jpg;type=image/jpeg" \
        -F "caption=AI 생성 데모 일상 사진" >/dev/null
    done
    echo "사진 등록: $nickname (프로필 1장 + 일상 5장)"
  else
    echo "기존 일상 사진 유지: $nickname ($current_photo_count장)"
  fi
done

echo "데모 프로필 시드 완료"
