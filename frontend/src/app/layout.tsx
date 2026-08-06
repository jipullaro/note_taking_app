import type { Metadata } from "next";
import { Inter, Inria_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const inriaSerif = Inria_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-inria-serif",
});

export const metadata: Metadata = {
  title: "Notes",
  description: "A cozy little note-taking app.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${inriaSerif.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
