import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "فاحص روابط Xtream | أداة فحص اشتراكات IPTV",
  description: "أداة احترافية لفحص روابط Xtream Codes وعرض حالة الاشتراك وعدد الاتصالات ونوع الباقة ومدتها.",
  keywords: ["Xtream", "IPTV", "فاحص", "اشتراكات", "m3u", "player_api"],
  authors: [{ name: "Z.ai" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${cairo.variable} antialiased bg-background text-foreground font-cairo`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
