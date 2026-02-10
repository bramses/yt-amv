import "./globals.css";

export const metadata = {
  title: "YouTube Mashup Editor",
  description: "Non-linear mashup editor for YouTube video and audio clips"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
