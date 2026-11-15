// nubi.rareapepes.com/rak — Glyph sign-in for RAK 3022 (mobile.rareapepes.com).
// The game opens this page in a pop-up (or redirects here); after Glyph login it receives a game token and the
// player's profile. The wallet SDK only runs in the browser, so the page itself is a thin shell.
import Head from "next/head";
import dynamic from "next/dynamic";

const RakSignIn = dynamic(() => import("../components/RakSignIn"), {
  ssr: false,
  loading: () => <div style={{ position: "fixed", inset: 0, background: "#06030e" }} />,
});

export default function RakPage() {
  return (
    <>
      <Head>
        <title>Sign in · RAK 3022 × Nubi</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#06030e" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
      </Head>
      <RakSignIn />
    </>
  );
}
