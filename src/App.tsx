import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

// Firebase Imports
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDoc, doc } from "firebase/firestore";

// Your Components
import { Candle } from "./models/candle";
import { Cake } from "./models/cake";
import { Table } from "./models/table";
import { PictureFrame } from "./models/pictureFrame";
import { Fireworks } from "./components/Fireworks";
import { BirthdayCard } from "./components/BirthdayCard";
import "./App.css";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyAHjilh7jAlS0e5qDKxbDZq3nbe3pFe4nE",
  authDomain: "instagram-e8c7a.firebaseapp.com",
  projectId: "instagram-e8c7a",
  storageBucket: "instagram-e8c7a.firebasestorage.app",
  messagingSenderId: "270990839800",
  appId: "1:270990839800:web:7f56ea2ea8d941219fd00d"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- CLOUDINARY CONFIG ---
const CLOUD_NAME = "YOUR_CLOUD_NAME"; 
const UPLOAD_PRESET = "YOUR_UNSIGNED_PRESET";

// --- CONSTANTS ---
const TYPED_CHAR_DELAY = 100;
const POST_TYPING_SCENE_DELAY = 1000;
const CURSOR_BLINK_INTERVAL = 480;
const CAKE_START_Y = 10;
const CAKE_END_Y = 0;
const CAKE_DESCENT_DURATION = 3;
const TABLE_START_Z = 30;
const TABLE_END_Z = 0;
const TABLE_SLIDE_DURATION = 0.7;
const TABLE_SLIDE_START = CAKE_DESCENT_DURATION - TABLE_SLIDE_DURATION - 0.1;
const CANDLE_START_Y = 5;
const CANDLE_END_Y = 0;
const CANDLE_DROP_DURATION = 1.2;
const CANDLE_DROP_START = Math.max(CAKE_DESCENT_DURATION, TABLE_SLIDE_START + TABLE_SLIDE_DURATION) + 1.0;
const totalAnimationTime = CANDLE_DROP_START + CANDLE_DROP_DURATION;
const ORBIT_TARGET = new Vector3(0, 1, 0);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// --- HELPER COMPONENTS ---
const VirtualKeyboard = ({ onAction }: { onAction: () => void }) => (
  <div className="mobile-controls" style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', zIndex: 2000 }}>
    <button onPointerDown={(e) => { e.preventDefault(); onAction(); }} className="hint-overlay" style={{ pointerEvents: 'auto' }}>
      TAP TO BLOW 🕯️
    </button>
  </div>
);

// --- MAIN APP COMPONENT ---
export default function App() {
  const [giftData, setGiftData] = useState<any>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");

  // Scene States
  const [hasStarted, setHasStarted] = useState(false);
  const [backgroundOpacity, setBackgroundOpacity] = useState(1);
  const [environmentProgress, setEnvironmentProgress] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [sceneStarted, setSceneStarted] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [hasAnimationCompleted, setHasAnimationCompleted] = useState(false);
  const [isCandleLit, setIsCandleLit] = useState(true);
  const [fireworksActive, setFireworksActive] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Check Cooldown and Data on Load
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const id = queryParams.get("id");

    if (id) {
      getDoc(doc(db, "birthdays", id)).then((snap) => {
        if (snap.exists()) setGiftData(snap.data());
      });
    } else {
      const lastCreation = localStorage.getItem("last_creation");
      if (lastCreation) {
        const nextDate = new Date(parseInt(lastCreation));
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        const timer = setInterval(() => {
          const diff = nextDate.getTime() - Date.now();
          if (diff > 0) {
            setIsBlocked(true);
            const d = Math.floor(diff / 864e5), h = Math.floor((diff / 36e5) % 24), m = Math.floor((diff / 6e4) % 60), s = Math.floor((diff / 1e3) % 60);
            setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
          } else {
            setIsBlocked(false);
            clearInterval(timer);
          }
        }, 1000);
        return () => clearInterval(timer);
      }
    }
  }, []);

  // 2. Upload Logic
  const handleGenerate = async (e: any) => {
    e.preventDefault();
    const frames = e.target.frames.files;
    const card = e.target.card.files[0];

    if (card.type !== "image/png") return alert("Card must be PNG!");
    if (frames.length !== 4) return alert("Select exactly 4 photos!");

    setIsUploading(true);
    try {
      const upload = async (file: File) => {
        if (file.size > 3 * 1024 * 1024) throw new Error("File too big");
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: data });
        return (await res.json()).secure_url;
      };

      const imageUrls = await Promise.all([...frames].map(upload));
      const cardUrl = await upload(card);

      const docRef = await addDoc(collection(db, "birthdays"), {
        name: e.target.name.value,
        age: e.target.age.value,
        frames: imageUrls,
        card: cardUrl,
      });

      localStorage.setItem("last_creation", Date.now().toString());
      setGeneratedLink(`${window.location.origin}/?id=${docRef.id}`);
    } catch (err) {
      alert("Error: " + err);
    }
    setIsUploading(false);
  };

  // 3. Audio & Scene Logic (Your Original Code)
  useEffect(() => {
    const audio = new Audio("/music.mp3");
    audio.loop = true;
    backgroundAudioRef.current = audio;
    return () => audio.pause();
  }, []);

  const handleStart = () => { if (!hasStarted) { backgroundAudioRef.current?.play(); setHasStarted(true); } };
  const handleBlow = () => { if (hasAnimationCompleted && isCandleLit) { setIsCandleLit(false); setFireworksActive(true); } };

  // Typing Effect
  const lines = giftData ? [
    `> ${giftData.name}`, "...", `> today is your ${giftData.age}th birthday`, 
    "...", "> so i made this for u", "...", "٩(◕‿◕)۶ ٩(◕‿◕)۶ ٩(◕‿◕)۶"
  ] : [];

  useEffect(() => {
    if (!hasStarted || !giftData || currentLineIndex >= lines.length) {
      if (currentLineIndex >= lines.length && !sceneStarted) setTimeout(() => setSceneStarted(true), 1000);
      return;
    }
    const timeout = setTimeout(() => {
      if (currentCharIndex < lines[currentLineIndex].length) {
        setCurrentCharIndex(prev => prev + 1);
      } else {
        setCurrentLineIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [hasStarted, currentCharIndex, currentLineIndex, giftData, sceneStarted]);

  // --- RENDERING ---

  // A. Cooldown Screen
  if (isBlocked && !giftData) {
    return (
      <div className="App flex-center">
        <h2>LIMIT REACHED</h2>
        <p>Next creation available in:</p>
        <div className="timer">{timeLeft}</div>
      </div>
    );
  }

  // B. Generator Form
  if (!giftData) {
    return (
      <div className="App form-container">
        {generatedLink ? (
          <div className="result-card">
            <h3>SUCCESS!</h3>
            <input readOnly value={generatedLink} />
            <button onClick={() => navigator.clipboard.writeText(generatedLink)}>Copy Link</button>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="upload-form">
            <h2>Birthday Generator</h2>
            <input name="name" placeholder="Her Name" required />
            <input name="age" type="number" placeholder="Age" required />
            <p>Upload 4 Photos (Max 3MB):</p>
            <input name="frames" type="file" multiple accept="image/*" required />
            <p>Upload Card (PNG ONLY):</p>
            <input name="card" type="file" accept="image/png" required />
            <button type="submit" disabled={isUploading}>{isUploading ? "Uploading..." : "Generate & Lock for 1 Year"}</button>
          </form>
        )}
      </div>
    );
  }

  // C. The 3D Viewer (Your Original Return)
  return (
    <div className="App">
      {!hasStarted && <div onClick={handleStart} className="tap-start">[ Tap to open gift ]</div>}
      
      <div className="background-overlay" style={{ opacity: backgroundOpacity }}>
        <div className="typed-text">
          {lines.map((line, i) => i <= currentLineIndex && (
            <span key={i} className="typed-line">
              {i === currentLineIndex ? line.slice(0, currentCharIndex) : line}
              {i === currentLineIndex && cursorVisible && <span className="typed-cursor">_</span>}
            </span>
          ))}
        </div>
      </div>

      {hasAnimationCompleted && isCandleLit && (
        <>
          <div className="hint-overlay">Blow the candle!</div>
          <VirtualKeyboard onAction={handleBlow} />
        </>
      )}

      <Canvas gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <AnimatedScene
            isPlaying={hasStarted && sceneStarted}
            candleLit={isCandleLit}
            onBackgroundFadeChange={setBackgroundOpacity}
            onEnvironmentProgressChange={setEnvironmentProgress}
            onAnimationComplete={() => setHasAnimationCompleted(true)}
            cards={[{ id: "card", image: giftData.card, position: [1, 0.081, -2], rotation: [-Math.PI / 2, 0, Math.PI / 3] }]}
            activeCardId={activeCardId}
            onToggleCard={(id) => setActiveCardId(prev => prev === id ? null : id)}
            frames={giftData.frames}
          />
          <Environment files={["/shanghai_bund_4k.hdr"]} background environmentIntensity={0.1 * environmentProgress} />
          <Fireworks isActive={fireworksActive} origin={[0, 10, 0]} />
          <ConfiguredOrbitControls />
          <ambientLight intensity={0.5} />
        </Suspense>
      </Canvas>
    </div>
  );
}

// --- ANIMATED SCENE WRAPPER ---
function AnimatedScene({ isPlaying, candleLit, onBackgroundFadeChange, onEnvironmentProgressChange, onAnimationComplete, cards, activeCardId, onToggleCard, frames }: any) {
  const cake = useRef<Group>(null);
  const table = useRef<Group>(null);
  const candle = useRef<Group>(null);
  const startRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (!isPlaying || !cake.current || !table.current || !candle.current) return;
    if (startRef.current === null) startRef.current = clock.elapsedTime;
    
    const elapsed = clock.elapsedTime - startRef.current;
    const cakeEase = easeOutCubic(clamp(elapsed / 3, 0, 1));
    cake.current.position.y = lerp(10, 0, cakeEase);
    
    const tableEase = easeOutCubic(clamp((elapsed - 2.2) / 0.7, 0, 1));
    table.current.position.z = lerp(30, 0, tableEase);

    const candleEase = easeOutCubic(clamp((elapsed - 4.2) / 1.2, 0, 1));
    candle.current.position.y = lerp(5, 0, candleEase);
    candle.current.visible = elapsed > 4.2;

    const fade = easeOutCubic(clamp((elapsed - 3) / 1, 0, 1));
    onBackgroundFadeChange(1 - fade);
    onEnvironmentProgressChange(fade);

    if (elapsed > 5.4) onAnimationComplete();
  });

  return (
    <>
      <group ref={table}>
        <Table />
        <PictureFrame image={frames[0]} position={[0, 0.735, 3]} rotation={[0, 5.6, 0]} scale={0.75} />
        <PictureFrame image={frames[1]} position={[0, 0.735, -3]} rotation={[0, 4.0, 0]} scale={0.75} />
        <PictureFrame image={frames[2]} position={[-1.5, 0.735, 2.5]} rotation={[0, 5.4, 0]} scale={0.75} />
        <PictureFrame image={frames[3]} position={[-1.5, 0.735, -2.5]} rotation={[0, 4.2, 0]} scale={0.75} />
        {cards.map((c: any) => <BirthdayCard key={c.id} {...c} isActive={activeCardId === c.id} onToggle={onToggleCard} />)}
      </group>
      <group ref={cake}><Cake /></group>
      <group ref={candle}><Candle isLit={candleLit} scale={0.25} position={[0, 1.1, 0]} /></group>
    </>
  );
}

// ... (Keep ConfiguredOrbitControls and EnvironmentBackgroundController the same)
