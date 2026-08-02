#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="${0:A:h:h}"
ENV_FILE="$PROJECT_ROOT/.env.local"
AWS_PROFILE="${AWS_PROFILE:-plantalk-deployer}"
AWS_REGION="${AWS_REGION:-ap-northeast-2}"
PARAMETER_PATH="${PARAMETER_PATH:-/plantalk/prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "환경변수 파일이 없습니다: $ENV_FILE" >&2
  exit 1
fi

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

typeset -A VALUES
VALUES[PGHOST]="${PLANTALK_PGHOST:-}"
VALUES[PGPORT]="${PLANTALK_PGPORT:-5432}"
VALUES[PGDATABASE]="${PLANTALK_PGDATABASE:-postgres}"
VALUES[PGUSER]="${PLANTALK_PGUSER:-}"
VALUES[PGPASSWORD]="${PLANTALK_PGPASSWORD:-}"
VALUES[PGSSLMODE]="require"
VALUES[ADMIN_USERNAME]="${ADMIN_USERNAME:-admin}"
VALUES[ADMIN_PASSWORD]="${ADMIN_PASSWORD:-}"
VALUES[SUPABASE_URL]="${SUPABASE_URL:-}"
VALUES[SUPABASE_SERVICE_ROLE_KEY]="${SUPABASE_SERVICE_ROLE_KEY:-}"
VALUES[SUPABASE_STORAGE_BUCKET]="${SUPABASE_STORAGE_BUCKET:-plantalk-images}"
VALUES[MAIL_HOST]="${MAIL_HOST:-smtp.gmail.com}"
VALUES[MAIL_PORT]="${MAIL_PORT:-587}"
VALUES[MAIL_USERNAME]="${MAIL_USERNAME:-}"
VALUES[MAIL_PASSWORD]="${MAIL_PASSWORD:-}"
VALUES[MAIL_FROM]="${MAIL_FROM:-${MAIL_USERNAME:-}}"
VALUES[MAIL_SMTP_AUTH]="${MAIL_SMTP_AUTH:-true}"
VALUES[MAIL_STARTTLS]="${MAIL_STARTTLS:-true}"

REQUIRED_KEYS=(
  PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD
  ADMIN_USERNAME ADMIN_PASSWORD
  SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_STORAGE_BUCKET
  MAIL_HOST MAIL_PORT MAIL_USERNAME MAIL_PASSWORD MAIL_FROM
  MAIL_SMTP_AUTH MAIL_STARTTLS
)

for key in "${REQUIRED_KEYS[@]}"; do
  if [[ -z "${VALUES[$key]}" ]]; then
    echo "필수 환경변수가 비어 있습니다: $key" >&2
    exit 1
  fi
done

for key in ${(k)VALUES}; do
  aws ssm put-parameter \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --name "$PARAMETER_PATH/$key" \
    --type SecureString \
    --value "${VALUES[$key]}" \
    --overwrite \
    --no-cli-pager >/dev/null
  echo "동기화 완료: $PARAMETER_PATH/$key"
done

echo "PlanTalk 운영 환경변수를 AWS Parameter Store에 암호화하여 저장했습니다."
