import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "FTC Incentive Management",
  description: "Friends Trading Corporation - Incentive Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="icon" href="/images/logo/logo.svg" type="image/svg+xml" />
        {/* Hide Google Translate toolbar/banner — we use our own buttons */}
        <style>{`
          .goog-te-banner-frame, .goog-te-balloon-frame { display: none !important; }
          body { top: 0 !important; }
          .goog-te-gadget { display: none !important; }
          .goog-tooltip, .goog-tooltip:hover { display: none !important; }
          .goog-text-highlight { background: none !important; box-shadow: none !important; }
          #google_translate_element { display: none !important; }
        `}</style>
      </head>
      <body className="min-h-full flex flex-col">
        {/* Hidden Google Translate element — required by the widget */}
        <div id="google_translate_element" style={{ display: 'none' }} />

        <LanguageProvider>
          {children}
        </LanguageProvider>

        {/* Google Translate init script */}
        <Script id="google-translate-init" strategy="afterInteractive">{`
          function googleTranslateElementInit() {
            new google.translate.TranslateElement(
              { pageLanguage: 'en', includedLanguages: 'hi,en', autoDisplay: false },
              'google_translate_element'
            );
          }
        `}</Script>
        <Script
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
