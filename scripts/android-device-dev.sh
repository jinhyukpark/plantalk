#!/bin/zsh
set -e

PROJECT_ROOT="${0:A:h:h}"
ENV_FILE="$PROJECT_ROOT/.env.local"
if [[ -f "$ENV_FILE" ]]; then
  while IFS='=' read -r ENV_KEY ENV_VALUE || [[ -n "$ENV_KEY" ]]; do
    [[ -z "$ENV_KEY" || "$ENV_KEY" == \#* ]] && continue
    case "$ENV_KEY" in
      EXPO_PUBLIC_*) export "$ENV_KEY=$ENV_VALUE" ;;
    esac
  done < "$ENV_FILE"
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export EXPO_NO_TELEMETRY=1

EXPO_PORT="${EXPO_DEVICE_PORT:-8081}"
APP_ID="${ANDROID_APP_ID:-com.teragraph.plantalk}"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://127.0.0.1:5001}"
export EXPO_PUBLIC_AD_MESSAGE_THRESHOLD="${EXPO_PUBLIC_AD_MESSAGE_THRESHOLD:-0}"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb를 찾을 수 없습니다. Android SDK Platform Tools 설치를 확인하세요." >&2
  exit 1
fi

adb start-server >/dev/null

if [[ -n "$ANDROID_DEVICE_SERIAL" ]]; then
  DEVICE_SERIAL="$ANDROID_DEVICE_SERIAL"
  DEVICE_STATE="$(adb -s "$DEVICE_SERIAL" get-state 2>/dev/null || true)"
  if [[ "$DEVICE_STATE" != "device" ]]; then
    echo "지정한 USB 장치를 사용할 수 없습니다: $DEVICE_SERIAL" >&2
    exit 1
  fi
else
  DEVICE_SERIALS=("${(@f)$(adb devices | awk 'NR > 1 && $1 !~ /^emulator-/ && $2 == "device" { print $1 }')}")
  DEVICE_SERIALS=("${(@)DEVICE_SERIALS:#}")

  if (( ${#DEVICE_SERIALS[@]} == 0 )); then
    echo "사용 가능한 USB Android 장치가 없습니다." >&2
    echo "휴대폰의 USB 디버깅을 켜고 이 Mac의 디버깅 연결을 허용하세요." >&2
    exit 1
  fi

  if (( ${#DEVICE_SERIALS[@]} > 1 )); then
    echo "USB Android 장치가 여러 대 연결되어 있습니다." >&2
    printf '  - %s\n' "${DEVICE_SERIALS[@]}" >&2
    echo "ANDROID_DEVICE_SERIAL을 지정한 뒤 다시 실행하세요." >&2
    exit 1
  fi

  DEVICE_SERIAL="$DEVICE_SERIALS[1]"
fi

DEVICE_MODEL="$(adb -s "$DEVICE_SERIAL" shell getprop ro.product.model 2>/dev/null | tr -d '\r')"

echo "USB Android 장치에 PlanTalk를 설치합니다."
echo "설치 대상: $DEVICE_SERIAL${DEVICE_MODEL:+ ($DEVICE_MODEL)}"
echo "Backend URL: $EXPO_PUBLIC_API_URL"
echo "Metro 포트: $EXPO_PORT"
if (( EXPO_PUBLIC_AD_MESSAGE_THRESHOLD > 0 )); then
  echo "테스트 광고 노출 기준: 채팅 $EXPO_PUBLIC_AD_MESSAGE_THRESHOLD 회"
else
  echo "광고 노출 기준: 전체 채팅 합산 20~40회 무작위"
fi

cd "$PROJECT_ROOT"

echo "1/4 Android APK를 빌드합니다."
(
  cd android
  ./gradlew app:assembleDebug
)

APK_PATH="$PROJECT_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$APK_PATH" ]]; then
  echo "APK를 찾을 수 없습니다: $APK_PATH" >&2
  exit 1
fi

echo "2/4 APK를 USB 장치에 설치합니다."
adb -s "$DEVICE_SERIAL" install -r "$APK_PATH"

echo "3/4 Metro와 백엔드 포트를 USB 장치에 연결합니다."
adb -s "$DEVICE_SERIAL" reverse "tcp:$EXPO_PORT" "tcp:$EXPO_PORT"
adb -s "$DEVICE_SERIAL" reverse tcp:5001 tcp:5001

launch_app() {
  echo "4/4 PlanTalk 앱을 USB 장치에서 실행합니다."
  adb -s "$DEVICE_SERIAL" shell am force-stop "$APP_ID"
  adb -s "$DEVICE_SERIAL" shell am start -n "$APP_ID/.MainActivity"
  echo
  echo "PlanTalk가 $DEVICE_SERIAL${DEVICE_MODEL:+ ($DEVICE_MODEL)}에서 실행되었습니다."
}

if ! lsof -nP -iTCP:"$EXPO_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Metro 개발 서버를 시작합니다: $EXPO_PORT"
  (
    for attempt in {1..60}; do
      if lsof -nP -iTCP:"$EXPO_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        launch_app
        exit 0
      fi
      sleep 1
    done
    echo "Metro 시작을 기다리다 시간이 초과되었습니다." >&2
  ) &
  echo "Metro가 시작되면 이 터미널에서 r 키로 앱을 새로고침할 수 있습니다."
  exec npx expo start --dev-client --port "$EXPO_PORT"
else
  echo "Metro는 이미 다른 터미널에서 실행 중입니다."
  launch_app
fi
