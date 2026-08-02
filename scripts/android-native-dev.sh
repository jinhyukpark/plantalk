#!/bin/zsh
set -e

PROJECT_ROOT="${0:A:h:h}"
ENV_FILE="$PROJECT_ROOT/.env.local"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export EXPO_NO_TELEMETRY=1

AVD_NAME="${ANDROID_AVD:-PlanTalk_Galaxy_S24}"
EMULATOR_SERIAL="${ANDROID_EMULATOR_SERIAL:-$(adb devices 2>/dev/null | awk '/^emulator-[0-9]+[[:space:]]+device$/ { print $1; exit }')}"
EMULATOR_SERIAL="${EMULATOR_SERIAL:-emulator-5554}"
export ANDROID_SERIAL="$EMULATOR_SERIAL"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://127.0.0.1:5001}"
export EXPO_PUBLIC_AD_MESSAGE_THRESHOLD="${EXPO_PUBLIC_AD_MESSAGE_THRESHOLD:-0}"
EXPO_PORT="${EXPO_NATIVE_PORT:-8081}"
APP_ID="${ANDROID_APP_ID:-com.teragraph.plantalk}"

if ! adb -s "$EMULATOR_SERIAL" get-state >/dev/null 2>&1; then
  echo "Android 에뮬레이터를 시작합니다: $AVD_NAME"
  emulator -avd "$AVD_NAME" -no-snapshot-load -no-snapshot-save >/tmp/plantalk-emulator.log 2>&1 &
fi

echo "Android 부팅을 기다리는 중: $EMULATOR_SERIAL"
for attempt in {1..60}; do
  if [[ "$(adb -s "$EMULATOR_SERIAL" get-state 2>/dev/null)" == "device" && "$(adb -s "$EMULATOR_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d "\r")" == "1" ]]; then
    break
  fi
  sleep 2
done

if [[ "$(adb -s "$EMULATOR_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d "\r")" != "1" ]]; then
  echo "Android 에뮬레이터 부팅에 실패했습니다." >&2
  tail -40 /tmp/plantalk-emulator.log 2>/dev/null || true
  exit 1
fi

adb -s "$EMULATOR_SERIAL" shell settings put secure show_ime_with_hard_keyboard 1 >/dev/null

echo "AdMob 네이티브 개발 앱을 빌드하고 설치합니다."
echo "설치 대상: $EMULATOR_SERIAL"
echo "Backend URL: $EXPO_PUBLIC_API_URL"
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

echo "2/4 APK를 에뮬레이터에 설치합니다."
adb -s "$EMULATOR_SERIAL" install -r "$APK_PATH"

echo "3/4 Metro와 백엔드 포트를 Mac에 연결합니다."
adb -s "$EMULATOR_SERIAL" reverse "tcp:$EXPO_PORT" "tcp:$EXPO_PORT"
adb -s "$EMULATOR_SERIAL" reverse tcp:5001 tcp:5001

launch_app() {
  echo "4/4 PlanTalk 앱을 에뮬레이터에서 실행합니다."
  adb -s "$EMULATOR_SERIAL" shell am force-stop "$APP_ID"
  adb -s "$EMULATOR_SERIAL" shell am start -n "$APP_ID/.MainActivity"
  echo
  echo "PlanTalk가 $EMULATOR_SERIAL 에서 실행되었습니다."
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
