import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "כדורגל שבת גולבול 19-21",
  description: "הרשמה וחלוקת קבוצות לכדורגל של יום שבת",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
