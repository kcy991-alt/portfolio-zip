import { AccountBox } from "@/components/account-box";
import { AppMotion } from "@/components/app-motion";
import { AuthProvider } from "@/components/auth-context";
import { WorkspaceDataProvider } from "@/components/workspace-data";
import { WorkspaceDialogsProvider } from "@/components/workspace-dialogs";
import { WorkspaceShell } from "@/components/workspace-shell";

// 프로젝트 아카이브(/workspace)과 포트폴리오 제작(/portfolios)이 같은 사이드바와 데이터를 쓴다.
// 로그인하지 않아도 들어와서 똑같이 써 볼 수 있다(내용은 브라우저 메모리에만 있고 저장되지 않는다).
// 두 영역을 오가도 체험 중인 내용이 사라지지 않도록 공통 레이아웃에 데이터 제공자를 둔다.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthProvider>
      <WorkspaceDataProvider>
        <WorkspaceDialogsProvider>
          <AppMotion>
            <WorkspaceShell account={<AccountBox />}>{children}</WorkspaceShell>
          </AppMotion>
        </WorkspaceDialogsProvider>
      </WorkspaceDataProvider>
    </AuthProvider>
  );
}
