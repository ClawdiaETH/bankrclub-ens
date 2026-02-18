import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BankrClub ENS | Claim Your Subdomain",
  description: "Register yourname.bankrclub.eth - exclusive ENS subdomains for BankrClub NFT holders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
