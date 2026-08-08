import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Heart, Menu, RotateCcw, Search, ShoppingBag, Star, Volume2, VolumeX } from "lucide-react";
import beautyOfJoseon from "./assets/products/beauty-of-joseon.jpg";
import cosrxSnail from "./assets/products/cosrx-snail.jpg";
import ordinaryNiacinamide from "./assets/products/ordinary-niacinamide.jpg";
import ceraveCream from "./assets/products/cerave-cream.jpg";

const herName = "Bonny";

type HeartDot = {
  id: number;
  x: number;
  y: number;
  delay: number;
  duration: number;
  size: number;
};

const products = [
  { name: "Beauty of Joseon Relief Sun", detail: "Rice + Probiotics SPF50+ • 50ml", price: "৳ ১,৫৫০", oldPrice: "৳ ১,৭৫০", image: beautyOfJoseon, tone: "rose" },
  { name: "COSRX Snail 96 Mucin Essence", detail: "Hydrating essence • 100ml", price: "৳ ১,৮৮০", oldPrice: "৳ ২,১৫০", image: cosrxSnail, tone: "berry" },
  { name: "The Ordinary Niacinamide 10%", detail: "Niacinamide + Zinc • 30ml", price: "৳ ১,৩৪৯", oldPrice: "৳ ১,৭৯৯", image: ordinaryNiacinamide, tone: "cream" },
  { name: "CeraVe Moisturizing Cream", detail: "Normal to dry skin • 56ml", price: "৳ ১,০১০", oldPrice: "৳ ১,২০০", image: ceraveCream, tone: "blush" },
];

function makeHeartDots(): HeartDot[] {
  return Array.from({ length: 150 }, (_, id) => {
    const t = (id / 150) * Math.PI * 2;
    // Keep the parametric heart safely inside its responsive stage.
    const scale = 2.35;
    return {
      id,
      x: 50 + scale * 16 * Math.sin(t) ** 3,
      y: 50 - scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
      delay: id * 0.016,
      duration: 2.3 + (id % 9) * 0.08,
      size: 9 + (id % 5) * 1.2,
    };
  });
}

export default function App() {
  const [revealed, setRevealed] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const dots = useMemo(makeHeartDots, []);

  const playChime = () => {
    if (muted) return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = audioContext.current ?? new AudioCtx();
    audioContext.current = context;
    const now = context.currentTime;

    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * 0.16);
      gain.gain.linearRampToValueAtTime(0.07, now + index * 0.16 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.16 + 0.75);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + index * 0.16);
      oscillator.stop(now + index * 0.16 + 0.8);
    });
  };

  const reveal = () => {
    setRevealed(true);
    window.setTimeout(playChime, 180);
  };

  useEffect(() => () => void audioContext.current?.close(), []);

  return (
    <main className={revealed ? "surprise is-revealed" : "surprise"}>
      <div className="ambient" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties}>♥</i>)}
      </div>

      {!revealed ? (
        <section className="shop-shell">
          <header className="shop-header">
            <button type="button" className="shop-icon" aria-label="মেনু"><Menu size={20} /></button>
            <a className="brand" href="#top" aria-label="Beauty Brain home">BEAUTY <span>BRAIN</span></a>
            <div className="header-actions">
              <button type="button" className="shop-icon" aria-label="খুঁজুন"><Search size={19} /></button>
              <button type="button" className="shop-icon bag" aria-label="ব্যাগ"><ShoppingBag size={19} /><i>0</i></button>
            </div>
          </header>

          <div className="promo-strip">আজকের অর্ডারে ফ্রি ডেলিভারি ✦ কোড: GLOW</div>

          <div className="shop-content" id="top">
            <div className="shop-hero">
              <div>
                <span>NEW SUMMER EDIT</span>
                <h1>তোমার glow,<br />তোমার মতোই।</h1>
                <p>Original skincare, carefully picked for your everyday routine.</p>
                <button type="button" onClick={reveal}>আজকের special offer <ArrowRight size={18} /></button>
              </div>
              <div className="hero-product" aria-hidden="true"><span>25%<small>OFF</small></span><b>✨</b></div>
            </div>

            <div className="collection-heading">
              <div><span>JUST FOR YOU</span><h2>ছোট্ট কিছু পছন্দ</h2></div>
              <button type="button" onClick={reveal}>সব দেখুন</button>
            </div>

            <div className="product-grid">
              {products.map((product) => (
                <button className="product-card" type="button" onClick={reveal} key={product.name}>
                  <div className={`product-art ${product.tone}`}><img src={product.image} alt={product.name} /><i>SALE</i></div>
                  <div className="rating"><Star size={11} fill="currentColor" /> 4.9</div>
                  <h3>{product.name}</h3>
                  <p>{product.detail}</p>
                  <strong>{product.price} <del>{product.oldPrice}</del></strong>
                </button>
              ))}
            </div>
          </div>

          <nav className="shop-nav" aria-label="Shop categories">
            <button type="button" onClick={reveal}>স্কিনকেয়ার</button><button type="button" onClick={reveal}>মেকআপ</button><button type="button" onClick={reveal}>ফ্র্যাগরেন্স</button>
          </nav>
        </section>
      ) : (
        <section className="love-card" aria-live="polite">
          <button className="sound-button" type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "শব্দ চালু করুন" : "শব্দ বন্ধ করুন"}>
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>

          <p className="eyebrow">TODAY'S MOST BEAUTIFUL PICK</p>
          <div className="heart-stage" aria-hidden="true">
            <div className="heart-aura" />
            {dots.map((dot) => (
              <span
                className="heart-dot"
                key={dot.id}
                style={{ left: `${dot.x}%`, top: `${dot.y}%`, animationDelay: `${dot.delay}s`, animationDuration: `${dot.duration}s`, fontSize: `${dot.size}px` }}
              >ভালোবাসি</span>
            ))}
            <div className="heart-center">
              <Heart fill="currentColor" size={24} />
              <strong>তুমি</strong>
            </div>
          </div>
          <h1>{herName}, আজকের অফারটা আসলে তুমি।</h1>
          <p className="love-note">Beauty product শুধু glow বাড়ায়—কিন্তু আমার পৃথিবীটা সুন্দর করে দাও তুমি। তোমাকে প্রতিদিন আরও একটু বেশি ভালোবাসি।</p>
          <p className="signature">— তোমার মানুষটা ♡</p>
          <button type="button" className="replay-button" onClick={() => setRevealed(false)}>
            <RotateCcw size={16} /> আবার দেখো
          </button>
        </section>
      )}
    </main>
  );
}
