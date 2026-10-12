import { Suspense } from "react";
import { PortfolioScreen } from "@/components/portfolio-screen";

async function PortfolioContent({ params }: { params: PageProps<"/portfolios/[id]/edit">["params"] }) {
  const { id } = await params;
  return <PortfolioScreen id={id} />;
}

export default function PortfolioEditPage(props: PageProps<"/portfolios/[id]/edit">) {
  return (
    <Suspense fallback={<p className="p-4 text-muted">포트폴리오를 불러오는 중이에요…</p>}>
      <PortfolioContent params={props.params} />
    </Suspense>
  );
}
