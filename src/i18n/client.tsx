"use client";

import { createContext, useContext, type ReactNode } from "react";

import { type Locale } from "./config";
import { type Messages } from "./messages/en";

type I18nValue = { locale: Locale; t: Messages };

const I18nContext = createContext<I18nValue | null>(null);

/** Provides the active locale + message catalog to client components. */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, t: messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within <I18nProvider>");
  }
  return ctx;
}
