import type { Metadata } from "next";
import "../components/web/styles.css";
import "../components/web/apple-ui.css";

export const metadata: Metadata = {
  title: "启峰创投 - 一个更高效的创投连接平台，让项目、资本与产业资源在可信的环境里遇见彼此。",
  description: "连接项目、资本与政府产业资源。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
