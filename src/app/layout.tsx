import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { I18nProvider } from "~/i18n/client";
import { getI18n } from "~/i18n/server";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "BRIDGE — Benefits screening & guidance",
  description:
    "Find out which benefits you may qualify for and get help applying.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, t } = await getI18n();
  return (
    <html lang={locale} className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>
          <I18nProvider locale={locale} messages={t}>
            {children}
          </I18nProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
