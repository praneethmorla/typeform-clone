import "./globals.css";
import { Toaster } from "@/lib/toast";
export const metadata = { title: "Typeform Clone" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}<Toaster /></body></html>;
}
