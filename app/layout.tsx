import type { Metadata } from "next";
import "../components/web/styles.css";
import "../components/web/apple-ui.css";

export const metadata: Metadata = {
  title: "创投智联",
  description: "连接项目、资本与政府产业资源。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
