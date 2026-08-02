#!/bin/zsh
set -e

PROJECT_ROOT="${0:A:h:h}"
BACKEND_DIR="$PROJECT_ROOT/backend"
ENV_FILE="$PROJECT_ROOT/.env.local"
SAVE_LOCAL_ENV=false
SERVER_PORT="${SERVER_PORT:-5001}"

# 개발 중 스크립트를 다시 실행해도 "Port already in use"로 실패하지 않도록
# 이 프로젝트의 기존 Spring Boot 프로세스만 안전하게 종료합니다.
EXISTING_PID="$(lsof -tiTCP:"$SERVER_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
if [[ -n "$EXISTING_PID" ]]; then
  EXISTING_CWD="$(lsof -a -p "$EXISTING_PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"
  if [[ "$EXISTING_CWD" == "$BACKEND_DIR" ]]; then
    echo "기존 PlanTalk 백엔드를 종료합니다: PID $EXISTING_PID (port $SERVER_PORT)"
    kill "$EXISTING_PID"

    for _ in {1..50}; do
      if ! kill -0 "$EXISTING_PID" 2>/dev/null; then
        break
      fi
      sleep 0.1
    done

    if kill -0 "$EXISTING_PID" 2>/dev/null; then
      echo "기존 백엔드가 종료되지 않았습니다. 잠시 후 다시 실행해 주세요." >&2
      exit 1
    fi
  else
    echo "포트 $SERVER_PORT 을 다른 프로그램(PID $EXISTING_PID)이 사용 중입니다." >&2
    echo "해당 프로그램을 종료하거나 SERVER_PORT를 변경해 주세요." >&2
    exit 1
  fi
fi

if [[ -f "$ENV_FILE" ]]; then
  # 기존 셸 이스케이프는 그대로 유지하되, Google이 4자리씩 띄워 보여주는
  # MAIL_PASSWORD 한 줄만 공백 제거 후 안전하게 인용합니다.
  set -a
  source <(
    while IFS= read -r ENV_LINE || [[ -n "$ENV_LINE" ]]; do
      if [[ "$ENV_LINE" == MAIL_PASSWORD=* ]]; then
        MAIL_PASSWORD_VALUE="${ENV_LINE#MAIL_PASSWORD=}"
        MAIL_PASSWORD_VALUE="${MAIL_PASSWORD_VALUE//[[:space:]]/}"
        printf 'MAIL_PASSWORD=%q\n' "$MAIL_PASSWORD_VALUE"
      else
        print -r -- "$ENV_LINE"
      fi
    done < "$ENV_FILE"
  )
  set +a
else
  echo "환경변수 파일이 없습니다: $ENV_FILE"
  echo "처음 실행한다면 다음 명령으로 템플릿을 복사한 뒤 값을 입력하세요:"
  echo "  cp $PROJECT_ROOT/.env.example $ENV_FILE"
fi

export PGHOST="${PLANTALK_PGHOST:-aws-1-ap-northeast-2.pooler.supabase.com}"
export PGPORT="${PLANTALK_PGPORT:-5432}"
export PGDATABASE="${PLANTALK_PGDATABASE:-postgres}"
export PGUSER="${PLANTALK_PGUSER:-postgres.spkwqyftwbqnffnizoui}"
export PGSSLMODE="require"
export ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
export SUPABASE_URL="${SUPABASE_URL:-https://spkwqyftwbqnffnizoui.supabase.co}"
export SUPABASE_STORAGE_BUCKET="${SUPABASE_STORAGE_BUCKET:-plantalk-images}"

if [[ -n "$PLANTALK_PGPASSWORD" ]]; then
  export PGPASSWORD="$PLANTALK_PGPASSWORD"
else
  unset PGPASSWORD
  read -s "PGPASSWORD?Supabase DB 비밀번호 (최초 1회 저장): "
  echo
  export PGPASSWORD
  export PLANTALK_PGPASSWORD="$PGPASSWORD"
  SAVE_LOCAL_ENV=true
fi

if [[ -z "$ADMIN_PASSWORD" ]]; then
  read -s "ADMIN_PASSWORD?관리자 비밀번호: "
  echo
  if [[ -z "$ADMIN_PASSWORD" ]]; then
    echo "관리자 비밀번호가 비어 있어 백엔드를 실행하지 않습니다." >&2
    exit 1
  fi
  export ADMIN_PASSWORD
  SAVE_LOCAL_ENV=true
fi

if [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  read -s "SUPABASE_SERVICE_ROLE_KEY?Supabase service role key: "
  echo
  if [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    echo "Supabase service role key가 없어 백엔드를 실행하지 않습니다." >&2
    exit 1
  fi
  export SUPABASE_SERVICE_ROLE_KEY
  SAVE_LOCAL_ENV=true
fi

if [[ "$SAVE_LOCAL_ENV" == true ]]; then
  umask 077
  {
    printf 'PLANTALK_PGHOST=%q\n' "$PGHOST"
    printf 'PLANTALK_PGPORT=%q\n' "$PGPORT"
    printf 'PLANTALK_PGDATABASE=%q\n' "$PGDATABASE"
    printf 'PLANTALK_PGUSER=%q\n' "$PGUSER"
    printf 'PLANTALK_PGPASSWORD=%q\n' "$PGPASSWORD"
    printf 'ADMIN_USERNAME=%q\n' "$ADMIN_USERNAME"
    printf 'ADMIN_PASSWORD=%q\n' "$ADMIN_PASSWORD"
    printf 'SUPABASE_URL=%q\n' "$SUPABASE_URL"
    printf 'SUPABASE_SERVICE_ROLE_KEY=%q\n' "$SUPABASE_SERVICE_ROLE_KEY"
    printf 'SUPABASE_STORAGE_BUCKET=%q\n' "$SUPABASE_STORAGE_BUCKET"
    if [[ -n "$MAIL_USERNAME" ]]; then
      printf 'MAIL_HOST=%q\n' "${MAIL_HOST:-smtp.gmail.com}"
      printf 'MAIL_PORT=%q\n' "${MAIL_PORT:-587}"
      printf 'MAIL_USERNAME=%q\n' "$MAIL_USERNAME"
      printf 'MAIL_PASSWORD=%q\n' "$MAIL_PASSWORD"
      printf 'MAIL_FROM=%q\n' "${MAIL_FROM:-$MAIL_USERNAME}"
      printf 'MAIL_SMTP_AUTH=%q\n' "${MAIL_SMTP_AUTH:-true}"
      printf 'MAIL_STARTTLS=%q\n' "${MAIL_STARTTLS:-true}"
    fi
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "로컬 환경변수를 $ENV_FILE 에 안전하게 저장했습니다."
fi

echo "DB 접속: $PGUSER@$PGHOST:$PGPORT/$PGDATABASE (SSL)"
echo "관리자 계정: $ADMIN_USERNAME"
if [[ -n "$MAIL_USERNAME" && -n "$MAIL_PASSWORD" ]]; then
  echo "Gmail SMTP: $MAIL_USERNAME"
else
  echo "Gmail SMTP가 설정되지 않았습니다."
  echo "계정 찾기와 비밀번호 재설정 메일을 사용하려면 $ENV_FILE 에 MAIL_USERNAME과 MAIL_PASSWORD를 설정하세요."
  echo "MAIL_PASSWORD에는 발신 계정의 SMTP 앱 비밀번호 또는 인증 비밀번호를 입력하세요."
fi

cd "$BACKEND_DIR"
exec mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=$SERVER_PORT"
