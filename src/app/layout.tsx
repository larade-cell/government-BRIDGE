import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Merriweather, Public_Sans } from "next/font/google";

import { ChatWidget } from "~/components/chat/chat-widget";
import { FooterSlot } from "~/components/ui/footer-slot";
import { GovBanner } from "~/components/ui/gov-banner";
import { SiteFooter } from "~/components/ui/site-footer";
import { I18nProvider } from "~/i18n/client";
import { getI18n } from "~/i18n/server";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "BRIDGE — U.S. Department of Labor benefits & rights",
  description:
    "Check which Department of Labor programs you may qualify for — unemployment, wages, workplace safety, training, and more — and get help taking the next step.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

// Public Sans — the U.S. Web Design System's official UI typeface — for body
// and interface text; Merriweather (serif) for the editorial display headings
// seen on federal sites.
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-merriweather",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, t } = await getI18n();
  return (
    <html
      lang={locale}
      className={`${geist.variable} ${publicSans.variable} ${merriweather.variable}`}
    >
      <body>
        <TRPCReactProvider>
          <I18nProvider locale={locale} messages={t}>
            <a href="#main-content" className="skip-link">
              {t.common.skipToContent}
            </a>
            <div className="brand-stripe" aria-hidden="true" />
            <GovBanner />
            {children}
            <FooterSlot>
              <SiteFooter />
            </FooterSlot>
            <ChatWidget />
          </I18nProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
