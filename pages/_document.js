// _document.js  →  upload this into your /pages folder.
// It adds the favicon + all SEO/social tags site-wide. It does NOT touch index.js or chat.js.
// If pages/_document.js already exists, don't overwrite it — ask Claude to merge instead.

import { Html, Head, Main, NextScript } from "next/document";

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": "https://nubi.rareapepes.com/#website", "url": "https://nubi.rareapepes.com/", "name": "Nubi AI", "description": "The agentic, living AI character of the Rare Apepes universe.", "inLanguage": "en", "publisher": { "@id": "https://rareapepes.com/#org" } },
    { "@type": "Organization", "@id": "https://rareapepes.com/#org", "name": "Rare Apepes", "alternateName": "Rare Labs", "url": "https://rareapepes.com/", "logo": "https://nubi.rareapepes.com/icons/android-chrome-512x512.png", "description": "An OG Rare Pepe-rooted NFT project and creative studio building art, brand, community, a browser game (RAK 3022), and a living AI character (Nubi).", "sameAs": ["https://x.com/RareApepesNFT", "https://x.com/ceotim", "https://opensea.io/collection/rare-apepes"] },
    { "@type": "SoftwareApplication", "@id": "https://nubi.rareapepes.com/#nubi", "name": "Nubi AI", "url": "https://nubi.rareapepes.com/", "applicationCategory": "EntertainmentApplication", "operatingSystem": "Web", "description": "Nubi is the agentic, living digital IP of Rare Apepes: a cybernetic amphibian bounty hunter you can talk to. He remembers linked holders, carries the project's lore and history, and connects to the RAK 3022 game world.", "image": "https://nubi.rareapepes.com/icons/og-image.png", "author": { "@id": "https://rareapepes.com/#org" }, "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" } },
    { "@type": "VideoGame", "@id": "https://rak3022.rarelabs.xyz/#game", "name": "RAK 3022", "url": "https://rak3022.rarelabs.xyz/", "description": "A free-to-play browser game set in the Rare Apepes universe, starring the bounty hunter Nubi.", "applicationCategory": "Game", "operatingSystem": "Web Browser", "gamePlatform": "Web Browser", "playMode": "SinglePlayer", "publisher": { "@id": "https://rareapepes.com/#org" }, "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" } },
    { "@type": "FAQPage", "@id": "https://nubi.rareapepes.com/#faq", "mainEntity": [
      { "@type": "Question", "name": "What is Nubi AI?", "acceptedAnswer": { "@type": "Answer", "text": "Nubi is the living, agentic AI character of the Rare Apepes NFT project — a cybernetic amphibian bounty hunter you can talk to at nubi.rareapepes.com. Unlike a generic chatbot, Nubi remembers linked holders, carries the project's lore and history, and ties directly into the RAK 3022 game world." } },
      { "@type": "Question", "name": "What is RAK 3022?", "acceptedAnswer": { "@type": "Answer", "text": "RAK 3022 is a free-to-play browser game from Rare Labs set in the Rare Apepes universe, featuring the bounty hunter Nubi. Play it at rak3022.rarelabs.xyz." } },
      { "@type": "Question", "name": "What are Rare Apepes?", "acceptedAnswer": { "@type": "Answer", "text": "Rare Apepes is an Ethereum NFT collection rooted in OG Rare Pepe art, built around three pillars — art, brand, and community. The ecosystem now includes the RAK 3022 game and Nubi, an agentic living AI character." } },
      { "@type": "Question", "name": "Is Nubi AI free to use?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — you can talk to Nubi for free at nubi.rareapepes.com, and RAK 3022 is a free-to-play browser game." } }
    ] }
  ]
};

export default function Document() {
  return (
    <Html lang="en" style={{ background: "#06030e" }}>
      <Head>
        {/* ── Favicon & app icons ── */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#8b2fd6" />

        {/* ── Search engine meta ── */}
        <title>Nubi AI — The Living Digital IP of Rare Apepes</title>
        <meta name="description" content="Meet Nubi, the agentic AI bounty hunter of the Rare Apepes universe. He remembers holders, knows the lore, and ties into RAK 3022 — the free-to-play browser game." />
        <meta name="keywords" content="Nubi, Nubi AI, Rare Apepes, RAK 3022, living digital IP, AI NFT character, agentic AI, Web3 AI agent, Rare Pepe, onchain AI" />
        <meta name="author" content="Rare Labs / Rare Apepes" />
        <link rel="canonical" href="https://nubi.rareapepes.com/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />

        {/* ── Open Graph (Discord, iMessage, Facebook, LinkedIn…) ── */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Nubi AI" />
        <meta property="og:title" content="Nubi AI — The Living Digital IP of Rare Apepes" />
        <meta property="og:description" content="The agentic AI bounty hunter of the Rare Apepes universe — remembers holders, knows the lore, ties into the free-to-play game RAK 3022. Come talk to him." />
        <meta property="og:url" content="https://nubi.rareapepes.com/" />
        <meta property="og:image" content="https://nubi.rareapepes.com/icons/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Nubi — the living AI of Rare Apepes." />
        <meta property="og:locale" content="en_US" />

        {/* ── X / Twitter card ── */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@RareApepesNFT" />
        <meta name="twitter:creator" content="@ceotim" />
        <meta name="twitter:title" content="Nubi AI — The Living Digital IP of Rare Apepes" />
        <meta name="twitter:description" content="The agentic AI bounty hunter of the Rare Apepes universe. Remembers holders, knows the lore, ties into RAK 3022." />
        <meta name="twitter:image" content="https://nubi.rareapepes.com/icons/og-image.png" />

        {/* ── Structured data (Google rich results + AI search comprehension) ── */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      </Head>
      <body style={{ background: "#06030e", margin: 0 }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
