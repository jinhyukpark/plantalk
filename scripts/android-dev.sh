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
HOST_IP="${EXPO_HOST_IP:-$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)}"

if [[ -z "$HOST_IP" ]]; then
  echo "LAN IP를 찾지 못했습니다. EXPO_HOST_IP를 지정하세요." >&2
  exit 1
fi

export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://$HOST_IP:5001}"
echo "휴대폰과 Mac을 같은 Wi-Fi에 연결하세요."
echo "Expo URL: exp://$HOST_IP:8081"
echo "Backend URL: $EXPO_PUBLIC_API_URL"

if ! adb -s "$EMULATOR_SERIAL" get-state >/dev/null 2>&1; then
  echo "Android 에뮬레이터를 시작합니다: $AVD_NAME"
  emulator -avd "$AVD_NAME" -no-snapshot-load -no-snapshot-save >/tmp/plantalk-emulator.log 2>&1 &
fi

echo "Android 부팅을 기다리는 중..."
for attempt in {1..60}; do
  if [[ "$(adb -s "$EMULATOR_SERIAL" get-state 2>/dev/null)" == "device" && "$(adb -s "$EMULATOR_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d "\r")" == "1" ]]; then
    break
  fi
  sleep 2
done

if [[ "$(adb -s "$EMULATOR_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d "\r")" != "1" ]]; then
  echo "Android 에뮬레이터 부팅에 실패했습니다." >&2
  exit 1
fi

adb -s "$EMULATOR_SERIAL" shell settings put secure show_ime_with_hard_keyboard 1 >/dev/null
echo "에뮬레이터 소프트 키보드를 활성화했습니다."

(
  for attempt in {1..60}; do
    if nc -z 127.0.0.1 8081 >/dev/null 2>&1; then
      adb -s "$EMULATOR_SERIAL" shell am start -a android.intent.action.VIEW -d "exp://$HOST_IP:8081" >/dev/null 2>&1 || true
      exit 0
    fi
    sleep 1
  done
) &

cd "$PROJECT_ROOT"
exec npx expo start --host lan --clear
