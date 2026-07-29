# Sprint Contract — Packet: 검수 통과 최종 점검

## 만들 항목
- **src/App.tsx**: 라우팅 구조 최종 확인 (변경 최소화)
- **금지 패턴 grep 검증**: window.open, window.location.href, HEX color (#000~#FFF), amplitude, gtag, console.error

## 검증 체크리스트
1. **금지 패턴 0**
   - `grep -r "window\.open\|window\.location\.href\|#[0-9a-fA-F]{3,6}\|amplitude\|gtag\|console\.error" src/ --include="*.ts" --include="*.tsx"` → 매칭 0 (주석·정당 사유 제외)
2. **프로덕션 빌드 성공**
   - `npm run build` → exit code 0
3. **CORS 에러 0**
   - dev 서버 실행 후 모든 페이지 방문 → 브라우저 콘솔 CORS 에러 없음

## 사용할 타입 (src/lib/types.ts)
- `RouteState` (라우팅 상태 타입)

## 절대 금지
- 페이지 파일(src/pages/**) 수정
- main.tsx 수정
- 새 의존성 설치
- 외부 API 호출 추가
