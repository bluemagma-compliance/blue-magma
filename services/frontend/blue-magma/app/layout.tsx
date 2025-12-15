"use client";

import type React from "react";
import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AuthLoading } from "@/components/auth-loading";
import { ThemeProvider } from "@/components/theme-provider";
import { usePathname } from "next/navigation";

import Script from "next/script";

const projectId = process.env.NEXT_PUBLIC_CLARITY_ID || "ubwpn0yjk3";

const inter = Inter({ subsets: ["latin"] });

function AppContent({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoading />;
  }

  return <>{children}</>;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname?.startsWith("/login/") ||
    pathname?.startsWith("/signup/");

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Blue Magma</title>
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
	          defaultTheme="light"
	          enableSystem={false}
          disableTransitionOnChange
	          forcedTheme="light"
        >
          <AuthProvider>
            <AppContent>{children}</AppContent>
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
      <Script id="ms-clarity" strategy="afterInteractive">
        {`
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${projectId}");
        `}
     </Script>
    </html>
  );
}
