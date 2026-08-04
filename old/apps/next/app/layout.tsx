import type { Metadata } from "next";
import "../../web/src/styles.css";
import "../../web/src/apple-ui.css";

export const metadata: Metadata = {
  title: "创投智联",
  description: "连接项目、资本与政府产业资源。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
