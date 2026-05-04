import { OrderThemeBridge } from "./OrderThemeBridge";

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <OrderThemeBridge>{children}</OrderThemeBridge>;
}
