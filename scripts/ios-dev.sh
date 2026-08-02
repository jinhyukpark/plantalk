#!/bin/zsh
set -e

PROJECT_ROOT="${0:A:h:h}"
ENV_FILE="$PROJECT_ROOT/.env.local"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi
XCODE_DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"

if [[ ! -d "$XCODE_DEVELOPER_DIR" ]]; then
  echo "Xcode가 설치되어 있지 않습니다. App Store에서 Xcode를 설치해 주세요." >&2
  exit 1
fi

export DEVELOPER_DIR="$XCODE_DEVELOPER_DIR"
export EXPO_NO_TELEMETRY=1
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://127.0.0.1:5001}"
IOS_SIMULATOR="${IOS_SIMULATOR:-PlanTalk iPhone 17 Pro}"

if ! xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1; then
  echo "Xcode 초기 설정이 완료되지 않았습니다." >&2
  echo "먼저 다음 명령을 한 번 실행하세요:" >&2
  echo "  sudo DEVELOPER_DIR=$XCODE_DEVELOPER_DIR xcodebuild -license accept" >&2
  echo "  sudo DEVELOPER_DIR=$XCODE_DEVELOPER_DIR xcodebuild -runFirstLaunch" >&2
  exit 1
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods가 없습니다. 먼저 'brew install cocoapods'를 실행하세요." >&2
  exit 1
fi

echo "iOS Simulator용 네이티브 개발 빌드를 실행합니다."
echo "Backend URL: $EXPO_PUBLIC_API_URL"

cd "$PROJECT_ROOT"

exec npx expo run:ios --device "$IOS_SIMULATOR"
