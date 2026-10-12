import { Suspense } from "react";
import { PortfolioOutputScreen } from "@/components/portfolio-output-screen";

async function Content({ params }: { params: PageProps<"/portfolios/[id]/print">["params"] }) {
  const { id } = await params;
  return <PortfolioOutputScreen id={id} mode="print" />;
}

export default function PortfolioPrintPage(props: PageProps<"/portfolios/[id]/print">) {
  return (
    <Suspense fallback={<p className="p-4 text-muted">출력을 준비하는 중이에요…</p>}>
      <Content params={props.params} />
    </Suspense>
  );
}
