/**
 * 광고 ID 런타임 설정.
 *
 * 실제 앱인토스 콘솔 발급 광고 ID는 배포 시 env(VITE_TOSS_AD_GROUP_ID /
 * VITE_TOSS_AD_SLOT_ID)로 주입된다. `import.meta.env` 접근은 앱 최상위(App.tsx)에서
 * 한 번만 읽어 여기 setAdConfig로 담고, 광고 컴포넌트(AdSlot/TossRewardAd)는 이
 * 플레인 모듈 상태만 읽는다 — 컴포넌트 그래프에 `import.meta`를 두지 않아 테스트
 * require 로더와 충돌하지 않는다. env 미설정(개발/테스트) 시 undefined → 컴포넌트가
 * 넘긴 prop 라벨로 폴백.
 */

let adGroupId: string | undefined;
let adSlotId: string | undefined;

export function setAdConfig(config: { groupId?: string; slotId?: string }): void {
  if (config.groupId) adGroupId = config.groupId;
  if (config.slotId) adSlotId = config.slotId;
}

export function getAdGroupId(): string | undefined {
  return adGroupId;
}

export function getAdSlotId(): string | undefined {
  return adSlotId;
}
