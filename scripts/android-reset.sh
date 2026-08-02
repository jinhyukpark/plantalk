#!/bin/zsh
set -e

PROJECT_ROOT="${0:A:h:h}"
BACKEND_DIR="$PROJECT_ROOT/backend"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

echo "PlanTalk Android 개발 환경을 초기화합니다."

BACKEND_PIDS=("${(@f)$(lsof -tiTCP:5001 -sTCP:LISTEN 2>/dev/null || true)}")
BACKEND_PIDS=("${(@)BACKEND_PIDS:#}")

if (( ${#BACKEND_PIDS[@]} > 0 )); then
  for pid in "${BACKEND_PIDS[@]}"; do
    PROCESS_CWD="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"
    if [[ "$PROCESS_CWD" == "$BACKEND_DIR" ]]; then
      echo "PlanTalk 백엔드 종료: PID $pid (port 5001)"
      kill "$pid" 2>/dev/null || true

      for _ in {1..50}; do
        if ! kill -0 "$pid" 2>/dev/null; then
          break
        fi
        sleep 0.1
      done

      if kill -0 "$pid" 2>/dev/null; then
        echo "경고: 백엔드 PID $pid 가 아직 종료되지 않았습니다." >&2
      fi
    else
      echo "포트 5001의 다른 프로그램(PID $pid)은 종료하지 않습니다."
    fi
  done
else
  echo "백엔드 포트 5001: 실행 중인 PlanTalk 백엔드 없음"
fi

for port in 8081 8082; do
  PORT_PIDS=("${(@f)$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)}")
  PORT_PIDS=("${(@)PORT_PIDS:#}")

  if (( ${#PORT_PIDS[@]} > 0 )); then
    echo "Metro 포트 $port 종료: ${PORT_PIDS[*]}"
    kill "${PORT_PIDS[@]}" 2>/dev/null || true
  else
    echo "Metro 포트 $port: 사용 중인 프로세스 없음"
  fi
done

if command -v adb >/dev/null 2>&1; then
  DEVICE_SERIALS=("${(@f)$(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')}")
  DEVICE_SERIALS=("${(@)DEVICE_SERIALS:#}")

  for serial in "${DEVICE_SERIALS[@]}"; do
    echo "ADB reverse 연결 제거: $serial"
    adb -s "$serial" reverse --remove-all >/dev/null 2>&1 || true
  done

  EMULATOR_SERIALS=("${(@f)$(adb devices | awk 'NR > 1 && $1 ~ /^emulator-/ && $2 == "device" { print $1 }')}")
  EMULATOR_SERIALS=("${(@)EMULATOR_SERIALS:#}")

  for serial in "${EMULATOR_SERIALS[@]}"; do
    echo "Android 에뮬레이터 종료: $serial"
    adb -s "$serial" emu kill >/dev/null 2>&1 || true
  done
else
  echo "adb를 찾을 수 없어 Android 장치 연결 초기화는 건너뜁니다."
fi

echo
echo "Android 개발 환경 초기화가 완료되었습니다."
