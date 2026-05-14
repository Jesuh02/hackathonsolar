import type { Metadata } from 'next';
import { Inter, Geist } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Agente Solar - Riohacha',
  description: 'Sistema inteligente de gestión energética solar para empresas de Riohacha, La Guajira',
};

// Inline script to set theme before paint (avoids flash)
const themeInitScript = `
(function(){try{
  var t = localStorage.getItem('theme');
  if(!t) t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  if(t==='dark') document.documentElement.classList.add('dark');
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.className} antialiased`} style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
