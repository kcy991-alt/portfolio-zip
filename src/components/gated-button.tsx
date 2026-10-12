"use client";

import { useAuth } from "@/components/auth-context";

/**
 * 저장이 필요한 버튼.
 * - 로그인하지 않은 사용자가 누르면 로그인 안내 창이 열린다.
 * - 로그인한 사용자는 onSignedIn이 있으면 그 동작을 하고, 없으면(아직 연결되지 않은 기능) 비활성화하고 "준비 중"이라고 알린다.
 */
export function GatedButton({
  label,
  reason,
  className,
  disabledClassName,
  onSignedIn,
}: {
  label: string;
  reason: string;
  className: string;
  disabledClassName: string;
  onSignedIn?: () => void;
}) {
  const { status, requireLogin } = useAuth();
  const signedIn = status === "signedIn";
  const disabled = signedIn && !onSignedIn;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={() => {
        if (requireLogin(reason)) onSignedIn?.();
      }}
      className={disabled ? disabledClassName : className}
    >
      {disabled ? `${label} (준비 중)` : label}
    </button>
  );
}
