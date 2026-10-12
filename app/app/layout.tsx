import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Monitor de Passagens",
  description:
    "Histórico de tarifas aéreas, faixa normal de preço e alertas de promoção nas principais rotas saindo do Brasil.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geist.variable} ${geistMono.variable} bg-fundo font-sans text-tinta antialiased`}
      >
        <Header />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
