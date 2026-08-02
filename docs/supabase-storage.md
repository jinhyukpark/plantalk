# Supabase Storage 설정

PlanTalk의 사용자 생성 이미지는 `plantalk-images` 공개 버킷에 저장됩니다.

## 저장 구조

- `avatars/{userId}/{uuid}.{ext}`: 프로필 사진
- `user-photos/{userId}/{uuid}.{ext}`: 일상 사진
- `room-images/{roomId}/{uuid}.{ext}`: 채팅 첨부 이미지

PostgreSQL의 `users.profile_picture_url`, `user_photos.photo_url`,
`room_messages.attachment_url`에는 이미지 원본이 아닌 Storage 공개 URL만 저장합니다.

## 필요한 서버 환경변수

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<server-only-secret-key>"
export SUPABASE_STORAGE_BUCKET="plantalk-images"
```

`SUPABASE_SERVICE_ROLE_KEY`는 모바일 앱, Git 저장소, Expo의
`EXPO_PUBLIC_*` 변수에 절대 넣지 않습니다. Spring Boot 서버에서만 사용합니다.

로컬에서는 다음 스크립트가 비밀번호와 service role key를 대화형으로 입력받습니다.

```bash
./scripts/backend-dev.sh
```

서버 시작 시:

1. 공개 이미지 버킷이 없으면 생성합니다.
2. JPEG, PNG, WebP만 허용하고 파일당 6MB로 제한합니다.
3. DB에 남아 있는 기존 Base64 이미지를 Storage로 옮긴 뒤 URL로 교체합니다.

## API

- `PUT /api/v1/users/{userId}/profile-picture`
- `DELETE /api/v1/users/{userId}/profile-picture`
- `POST /api/v1/users/{userId}/photos`
- `DELETE /api/v1/users/{userId}/photos/{photoId}`
- `POST /api/v1/images/rooms/{roomId}`

업로드 API는 모두 `multipart/form-data`의 `file` 필드를 사용합니다.
