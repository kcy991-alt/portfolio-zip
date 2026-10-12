import { Suspense } from "react";
import { SettingsScreen } from "@/components/settings-screen";

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="p-4 text-muted">설정을 불러오는 중이에요…</p>}>
      <SettingsScreen />
    </Suspense>
  );
}
