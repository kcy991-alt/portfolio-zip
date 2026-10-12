// portfolio_zip 로고: 파란 폴더에 지퍼가 달린 모양("흩어진 경험을 하나로 모아 압축한다"는 ZIP의 뜻)과 글자.
// 같은 모양을 앱 아이콘(`src/app/icon.svg`)에도 쓴다.

const ACCENT = "#315BE8";

/** 기호만(폴더+지퍼). 높이를 정하면 너비는 비율에 맞춰진다. */
export function LogoMark({ height = 26, className = "", inverted = false }: { height?: number; className?: string; inverted?: boolean }) {
  const body = inverted ? "#fff" : ACCENT;
  const detail = inverted ? ACCENT : "#fff";
  return (
    <svg width={(height * 64) / 56} height={height} viewBox="0 0 64 56" aria-hidden="true" className={className}>
      <path d="M10 4h14c1.7 0 3.2.8 4.2 2.2L31 10.5h23a8 8 0 0 1 8 8V46a8 8 0 0 1-8 8H10a8 8 0 0 1-8-8V12a8 8 0 0 1 8-8Z" fill={body} />
      {/* 지퍼 이빨 */}
      <g fill={detail}>
        <rect x="27.5" y="12.5" width="4.5" height="2.6" rx="0.8" />
        <rect x="32" y="15.1" width="4.5" height="2.6" rx="0.8" />
        <rect x="27.5" y="17.7" width="4.5" height="2.6" rx="0.8" />
        <rect x="32" y="20.3" width="4.5" height="2.6" rx="0.8" />
        <rect x="27.5" y="22.9" width="4.5" height="2.6" rx="0.8" />
        <rect x="32" y="25.5" width="4.5" height="2.6" rx="0.8" />
        {/* 손잡이 */}
        <rect x="26.5" y="29.5" width="11" height="15" rx="3.5" />
      </g>
      <rect x="30" y="34.5" width="4" height="6" rx="2" fill={body} />
    </svg>
  );
}

/** 가로형 로고: 기호 + portfolio_zip */
export function Logo({ className = "", tone = "light", showText = true }: { className?: string; tone?: "light" | "dark"; showText?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${className}`}>
      <LogoMark />
      {showText ? <span className={tone === "dark" ? "text-white" : "text-ink"}>portfolio_zip</span> : <span className="sr-only">portfolio_zip</span>}
    </span>
  );
}
