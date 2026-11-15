import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";
import { Rail } from "@/components/Rail";
import { IdentityProvider } from "@/components/Identity";
import { ScrollReset } from "@/components/ScrollReset";
import Mobileheader from "@/components/Mobileheader";

export const metadata: Metadata = {
  title: "Workbolt",
  description: "Small jobs, paid in sats over Lightning.",
};

export const viewport: Viewport = {
  themeColor: "#24163a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <IdentityProvider>
          <main className="flex h-dvh flex-col overflow-hidden md:flex-row">
            <Suspense fallback={null}>
              <Rail />
            </Suspense>
            <div id="page-scroll" className="min-h-0 flex-1 overflow-y-auto">
              <Mobileheader />
              <div className="mx-auto w-[85%] max-w-[1550px] pb-28 md:py-10">
                <Suspense fallback={null}>
                  <ScrollReset targetId="page-scroll" />
                  {children}
                </Suspense>
              </div>
            </div>
          </main>
        </IdentityProvider>
      </body>
    </html>
  );
}
