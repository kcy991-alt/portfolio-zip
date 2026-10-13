import { Suspense } from "react";
import { MyPageScreen } from "@/components/mypage-screen";

export default function MyPage() {
  return (
    <Suspense fallback={<p className="p-4 text-muted">마이페이지를 불러오는 중이에요…</p>}>
      <MyPageScreen />
    </Suspense>
  );
}
