/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 앱인토스 콘솔 발급 배너 광고 그룹 ID (배포 env로 주입) */
  readonly VITE_TOSS_AD_GROUP_ID?: string;
  /** 앱인토스 콘솔 발급 보상형 광고 슬롯 ID (배포 env로 주입) */
  readonly VITE_TOSS_AD_SLOT_ID?: string;
}
