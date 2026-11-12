import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import AppShell from "@/components/shell/AppShell";
import { ThemeProvider } from "@/lib/theme-context";
import { AuthProvider } from "@/lib/auth-context";
import { DeviceProvider } from "@/lib/device-context";

export const metadata: Metadata = {
  title: "Suraksha — Smart Door Security System",
  description: "Real-time ESP32 intrusion detection and environmental telemetry monitor.",
};

const themeScript = `
  (function() {
    try {
      var saved = localStorage.getItem('theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.classList.add('dark');
        document.body && document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body && document.body.classList.remove('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <DeviceProvider>
              <AppShell>{children}</AppShell>
            </DeviceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
