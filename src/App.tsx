import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Clock, 
  Flame, 
  Sparkles, 
  RefreshCw, 
  Settings2, 
  Calendar, 
  ChevronRight, 
  Check, 
  X, 
  Pin, 
  Maximize2, 
  Minimize2,
  BookOpen,
  Eye,
  Activity,
  ShieldAlert,
  Sliders,
  Tv,
  Layout,
  Sun,
  Zap,
  MousePointer,
  Sparkle
} from "lucide-react";
import { quotes, Quote } from "./data/quotes";

// OLED Safeguard Settings schema
interface OledSettings {
  pixelShift: boolean;         // micro pixel jitter
  pixelShiftAmount: number;    // in pixels
  movementMode: 'static' | 'bounce' | 'jump'; // static / linear TV bounce / periodic hop
  jumpInterval: number;        // minutes
  bounceSpeedSeconds: number;  // 5s (fast) to 600s (slow) to cross screen
  background: 'grid' | 'pure' | 'starfield'; // Grid pattern vs absolute pure pitch black vs realistic parallax starfield
  brightness: number;          // 10 to 100
  fontFamily: 'mono' | 'sans' | 'space' | 'serif' | 'outfit' | 'bebas'; // Typography customization
}

interface Star {
  id: number;
  x: number; // percentage
  y: number; // percentage
  size: number; // pixels
  depth: number; // 0.1 to 1.0 (for parallax displacement multiplier)
  flickerSpeed: number; // frequency of flicker
  phase: number; // phase offset
}

export default function App() {
  // 1. Current real-time clock state
  const [now, setNow] = useState(new Date());

  // 2. Custom milestones - initialized to CBSE Date: July 18, 2026 08:00:00 PDT
  const defaultMilestone = {
    title: "CBSE",
    date: "2026-07-18T08:00:00-07:00"
  };

  const [milestone, setMilestone] = useState(() => {
    try {
      const saved = localStorage.getItem("cbse_milestone");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title && parsed.date) return parsed;
      }
    } catch (e) {
      console.warn("Could not read milestone from localStorage", e);
    }
    return defaultMilestone;
  });

  // Helper to convert ISO string to local time string for datetime-local input
  const toLocalDatetimeLocal = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.substring(0, 16);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // 3. OLED guard settings
  const defaultOledSettings: OledSettings = {
    pixelShift: true,
    pixelShiftAmount: 3,
    movementMode: 'bounce',
    jumpInterval: 2,
    bounceSpeedSeconds: 120, // 2 minutes default
    background: 'starfield', // Starfield by default for stunning background
    brightness: 100,
    fontFamily: 'mono'
  };

  const [oledSettings, setOledSettings] = useState<OledSettings>(() => {
    try {
      const saved = localStorage.getItem("cbse_oled_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Map obsolete background values
        if (parsed.background === 'cosmic') {
          parsed.background = 'starfield';
        }
        if (parsed.movementMode === 'float') {
          parsed.movementMode = 'bounce';
        }
        return { ...defaultOledSettings, ...parsed };
      }
    } catch (e) {
      console.warn("Could not read OLED settings from localStorage", e);
    }
    return defaultOledSettings;
  });

  // Settings active tab & modal states
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'oled'>('events');

  // Input states for milestone parameters
  const [formTitle, setFormTitle] = useState(milestone.title);
  const [formDate, setFormDate] = useState(toLocalDatetimeLocal(milestone.date)); // YYYY-MM-DDTHH:mm

  // Clean updates of milestone state when modal opens
  useEffect(() => {
    setFormTitle(milestone.title);
    setFormDate(toLocalDatetimeLocal(milestone.date));
  }, [milestone, isEditing]);

  // Global keydown listener to open settings panel when pressing 'o' key outside inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }
      if (e.key === "o" || e.key === "O") {
        setIsEditing((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // 4. Stable list of stars for the parallax starfield background
  const stars: Star[] = useMemo(() => {
    const list: Star[] = [];
    const seed = 42; // static star distribution seed
    let randValue = seed;
    const lcgRandom = () => {
      randValue = (randValue * 1664525 + 1013904223) % 4294967296;
      return randValue / 4294967296;
    };

    for (let i = 0; i < 110; i++) {
      const depth = lcgRandom() * 0.9 + 0.1; // 0.1 depth layer to 1.0 focal point layer
      
      // Classify sizes based on cosmic depth layers to build physical realism
      let size = 0.6;
      if (depth < 0.4) {
        size = 0.5 + lcgRandom() * 0.5; // faint distance cosmic background (0.5px to 1px)
      } else if (depth < 0.75) {
        size = 1.0 + lcgRandom() * 0.8; // midground stars (1.0px to 1.8px)
      } else {
        size = 1.8 + lcgRandom() * 1.2; // foreground highlights (1.8px to 3.0px)
      }

      list.push({
        id: i,
        x: lcgRandom() * 100,
        y: lcgRandom() * 100,
        size: Number(size.toFixed(2)),
        depth: Number(depth.toFixed(2)),
        flickerSpeed: 0.8 + lcgRandom() * 2.5, // elegant, slow flickering frequencies
        phase: lcgRandom() * Math.PI * 2
      });
    }
    return list;
  }, []);

  // 5. Position parameters for OLED drift jitter, linear TV bounce, and parallax mouse movement
  const [shiftOffset, setShiftOffset] = useState({ x: 0, y: 0 });
  const [jumpOffset, setJumpOffset] = useState({ x: 0, y: 0 });
  const [secondsToNextJump, setSecondsToNextJump] = useState(oledSettings.jumpInterval * 60);

  // Dynamic layout bounds calculation to avoid layout thrashing in animation ticks
  const [layoutBounds, setLayoutBounds] = useState({ maxX: 120, maxY: 80 });
  const contentRef = useRef<HTMLDivElement>(null);

  const updateLayoutBounds = useCallback(() => {
    if (contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      const contentWidth = rect.width || 800;
      const contentHeight = rect.height || 550;

      // Mathematical limits to perfectly sweep window boundaries on all screen aspect ratios
      const maxX = Math.max(10, (window.innerWidth - contentWidth) / 2);
      const maxY = Math.max(10, (window.innerHeight - contentHeight) / 2);

      setLayoutBounds({ maxX, maxY });
    }
  }, []);

  // Recalculate margins on window resize, content scale, or milestone edits
  useEffect(() => {
    updateLayoutBounds();
    window.addEventListener("resize", updateLayoutBounds);

    // Buffer delayed sync to allow react rendering tree settlement
    const timer = setTimeout(updateLayoutBounds, 250);

    return () => {
      window.removeEventListener("resize", updateLayoutBounds);
      clearTimeout(timer);
    };
  }, [updateLayoutBounds, milestone]);

  // Guard cached properties for requestAnimationFrame to avoid re-triggering HMR
  const layoutBoundsRef = useRef(layoutBounds);
  useEffect(() => {
    layoutBoundsRef.current = layoutBounds;
  }, [layoutBounds]);

  // Layout Animation Pos combining Bouncing positions, Mouse Parallax, and Time ticks mapping inside single frame state
  const [animationPos, setAnimationPos] = useState({
    bx: 0,
    by: 0,
    mx: 0,
    my: 0,
    time: 0
  });

  // Micro pixel-shift jitter generator (safeguards static elements by vibrating slightly every 12 seconds)
  useEffect(() => {
    if (!oledSettings.pixelShift) {
      setShiftOffset({ x: 0, y: 0 });
      return;
    }

    const triggerJitter = () => {
      const amt = oledSettings.pixelShiftAmount;
      const rx = Math.floor(Math.random() * (amt * 2 + 1)) - amt;
      const ry = Math.floor(Math.random() * (amt * 2 + 1)) - amt;
      setShiftOffset({ x: rx, y: ry });
    };

    triggerJitter(); // Initial trigger
    const intervalId = setInterval(triggerJitter, 12000);
    return () => clearInterval(intervalId);
  }, [oledSettings.pixelShift, oledSettings.pixelShiftAmount]);

  // Large-scale periodic jump/hop controller (coordinates jumping when selected)
  useEffect(() => {
    if (oledSettings.movementMode !== 'jump') {
      setJumpOffset({ x: 0, y: 0 });
      return;
    }

    setSecondsToNextJump(oledSettings.jumpInterval * 60);

    const countdownTimer = setInterval(() => {
      setSecondsToNextJump(prev => {
        if (prev <= 1) {
          const range = 25;
          const rx = Math.floor(Math.random() * (range * 2 + 1)) - range;
          const ry = Math.floor(Math.random() * (range * 2 + 1)) - range;
          setJumpOffset({ x: rx, y: ry });
          return oledSettings.jumpInterval * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, [oledSettings.movementMode, oledSettings.jumpInterval]);

  // Explicit manual jump helper
  const triggerManualJump = useCallback(() => {
    const range = 25;
    const rx = Math.floor(Math.random() * (range * 2 + 1)) - range;
    const ry = Math.floor(Math.random() * (range * 2 + 1)) - range;
    setJumpOffset({ x: rx, y: ry });
    if (oledSettings.movementMode === 'jump') {
      setSecondsToNextJump(oledSettings.jumpInterval * 60);
    }
  }, [oledSettings.movementMode, oledSettings.jumpInterval]);

  // 6. Integrated requestAnimationFrame driver for Linear TV Bounce, Parallax targets & Stars Flicker ticks
  const animationRef = useRef({
    bx: 0,
    by: 0,
    vx: Math.cos(0.61), // High-entropy initial angle (approx 35 degrees)
    vy: Math.sin(0.61), // Y component
    mx: 0,  // Smooth mouse coord X
    my: 0,  // Smooth mouse coord Y
    targetMx: 0, // Destination mouse coord X
    targetMy: 0, // Destination mouse coord Y
    lastTime: performance.now()
  });

  useEffect(() => {
    let frameId: number;

    const tick = () => {
      const nowMs = performance.now();
      const dt = Math.min(0.1, (nowMs - animationRef.current.lastTime) / 1000); // upper clamp time delta to 100ms
      animationRef.current.lastTime = nowMs;

      // Extract high performance layout constraints bounds
      const bounds = layoutBoundsRef.current;
      const maxX = Math.max(10, bounds.maxX);
      const maxY = Math.max(10, bounds.maxY);

      let nextBx = animationRef.current.bx;
      let nextBy = animationRef.current.by;

      // Handle continuous Linear TV bounce coordinates using the total width/height bounds
      if (oledSettings.movementMode === 'bounce') {
        const travelDistance = Math.sqrt(maxX * maxX + maxY * maxY) * 2;
        const refDistance = Math.max(200, travelDistance);
        const speed = refDistance / oledSettings.bounceSpeedSeconds;

        let vx = animationRef.current.vx;
        let vy = animationRef.current.vy;

        nextBx += vx * speed * dt;
        nextBy += vy * speed * dt;

        let bounced = false;

        // Boundary collision testing & vector inversion (includes small margin tolerance)
        if (nextBx >= maxX && vx > 0) {
          vx = -Math.abs(vx);
          bounced = true;
        } else if (nextBx <= -maxX && vx < 0) {
          vx = Math.abs(vx);
          bounced = true;
        }

        if (nextBy >= maxY && vy > 0) {
          vy = -Math.abs(vy);
          bounced = true;
        } else if (nextBy <= -maxY && vy < 0) {
          vy = Math.abs(vy);
          bounced = true;
        }

        if (bounced) {
          // Calculate current direction angle
          let angle = Math.atan2(vy, vx);
          // Add a small randomized shift between -0.05 and +0.05 radians (~3 degrees)
          // this guarantees that even if the screen ratio is simple, the path evolves organically
          // and explores every single corner of the viewport.
          angle += (Math.random() - 0.5) * 0.12;

          vx = Math.cos(angle);
          vy = Math.sin(angle);

          // Force correct sign reflections after the nudge to guarantee it stays in bounds
          if (nextBx >= maxX) vx = -Math.abs(vx);
          if (nextBx <= -maxX) vx = Math.abs(vx);
          if (nextBy >= maxY) vy = -Math.abs(vy);
          if (nextBy <= -maxY) vy = Math.abs(vy);
        }

        animationRef.current.vx = vx;
        animationRef.current.vy = vy;

        // Apply clip constraints to prevent going out of bounds on screen resize
        nextBx = Math.max(-maxX, Math.min(maxX, nextBx));
        nextBy = Math.max(-maxY, Math.min(maxY, nextBy));
      } else {
        // Return back to center slowly if transition away from bounce mode
        nextBx += (0 - nextBx) * 0.1;
        nextBy += (0 - nextBy) * 0.1;
      }

      animationRef.current.bx = nextBx;
      animationRef.current.by = nextBy;

      // Smooth mouse parallax easing towards targets
      const easeFactor = 0.08;
      animationRef.current.mx += (animationRef.current.targetMx - animationRef.current.mx) * easeFactor;
      animationRef.current.my += (animationRef.current.targetMy - animationRef.current.my) * easeFactor;

      setAnimationPos({
        bx: nextBx,
        by: nextBy,
        mx: animationRef.current.mx,
        my: animationRef.current.my,
        time: nowMs / 1000
      });

      frameId = requestAnimationFrame(tick);
    };

    // Tracks viewport coordinates (-1.0 up to +1.0)
    const handleMouseMove = (e: MouseEvent) => {
      const rx = (e.clientX / window.innerWidth) * 2 - 1;
      const ry = (e.clientY / window.innerHeight) * 2 - 1;
      animationRef.current.targetMx = rx;
      animationRef.current.targetMy = ry;
    };

    // Slow touch/device position shifts on touch screens
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        const rx = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        const ry = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
        animationRef.current.targetMx = rx;
        animationRef.current.targetMy = ry;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    frameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      cancelAnimationFrame(frameId);
    };
  }, [oledSettings.movementMode, oledSettings.bounceSpeedSeconds]);

  // Handle saving of custom OLED settings
  const updateOledSetting = <K extends keyof OledSettings>(key: K, value: OledSettings[K]) => {
    const updated = {
      ...oledSettings,
      [key]: value
    };
    setOledSettings(updated);
    try {
      localStorage.setItem("cbse_oled_settings", JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save OLED settings to localStorage", e);
    }
  };

  // Quotes rotation state
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(() => {
    return Math.floor(Math.random() * quotes.length);
  });
  const [quoteDirection, setQuoteDirection] = useState(1);

  // Clocks ticks loop (updates current datetime parameters)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Quotes automatic sequence loop (every 30 minutes)
  useEffect(() => {
    const quoteTimer = setInterval(() => {
      rotateQuote();
    }, 1800000);
    return () => clearInterval(quoteTimer);
  }, []);

  const rotateQuote = useCallback(() => {
    setQuoteDirection(prev => prev * -1);
    setCurrentQuoteIndex(prevIndex => {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * quotes.length);
      } while (nextIndex === prevIndex && quotes.length > 1);
      return nextIndex;
    });
  }, []);

  // Time metrics parsing & layouts
  const countdownMetrics = useMemo(() => {
    const targetTime = new Date(milestone.date).getTime();
    const nowTime = now.getTime();
    const difference = targetTime - nowTime;

    if (difference <= 0) {
      return {
        days: "00",
        hours: "00",
        minutes: "00",
        seconds: "00",
        weeksLeft: "0.0",
        hoursRemaining: "0",
        isOver: true
      };
    }

    const daysVal = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hoursVal = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutesVal = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const secondsVal = Math.floor((difference % (1000 * 60)) / 1000);

    const totalHoursLeft = Math.floor(difference / (1000 * 60 * 60));
    const weeksLeftVal = (difference / (1000 * 60 * 60 * 24 * 7)).toFixed(1);

    return {
      days: daysVal.toString().padStart(2, "0"),
      hours: hoursVal.toString().padStart(2, "0"),
      minutes: minutesVal.toString().padStart(2, "0"),
      seconds: secondsVal.toString().padStart(2, "0"),
      weeksLeft: weeksLeftVal,
      hoursRemaining: totalHoursLeft.toLocaleString(),
      isOver: false
    };
  }, [milestone.date, now]);

  // Submit target handler
  const saveMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) return;

    const normalizedDate = new Date(formDate).toISOString();
    const newMilestone = {
      title: formTitle.trim(),
      date: normalizedDate
    };

    setMilestone(newMilestone);
    try {
      localStorage.setItem("cbse_milestone", JSON.stringify(newMilestone));
    } catch (e) {
      console.warn("Could not write milestone to local storage", e);
    }
    setIsEditing(false);
  };

  // Restores standard CBSE target
  const resetToDefault = () => {
    setMilestone(defaultMilestone);
    setFormTitle(defaultMilestone.title);
    setFormDate(toLocalDatetimeLocal(defaultMilestone.date));
    try {
      localStorage.removeItem("cbse_milestone");
    } catch (e) {
      console.warn("Could not remove milestone from local storage", e);
    }
  };

  // Date and formatted clock representations
  const headerDateStr = useMemo(() => {
    return now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }, [now]);

  const headerTimeStr = useMemo(() => {
    const hrs = now.getHours().toString().padStart(2, "0");
    const mins = now.getMinutes().toString().padStart(2, "0");
    const secs = now.getSeconds().toString().padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  }, [now]);

  const activeQuote = quotes[currentQuoteIndex];

  // Dynamic animations layout attributes mapped directly to unified state parameters
  const getContainerStyles = useMemo(() => {
    const tx = animationPos.bx + shiftOffset.x;
    const ty = animationPos.by + shiftOffset.y;
    return {
      transform: `translate3d(${tx}px, ${ty}px, 0)`
    };
  }, [animationPos.bx, animationPos.by, shiftOffset]);

  // Speed value text parser representation
  const getSpeedLabel = (sec: number) => {
    if (sec === 5) return "Fast (5s)";
    if (sec === 15) return "Quick (15s)";
    if (sec === 45) return "Medium (45s)";
    if (sec === 120) return "Standard (2m)";
    if (sec === 300) return "Slow (5m)";
    if (sec === 600) return "Extreme (10m)";
    return `${sec}s`;
  };

  const getFontClass = (fontKey: OledSettings['fontFamily']) => {
    switch (fontKey) {
      case 'sans': return 'font-sans';
      case 'space': return 'font-space';
      case 'serif': return 'font-serif-classic';
      case 'outfit': return 'font-outfit';
      case 'bebas': return 'font-bebas';
      case 'mono':
      default:
        return 'font-mono';
    }
  };

  return (
    <div 
      id="countdown-root" 
      className={`min-h-screen flex flex-col justify-between p-6 md:p-12 antialiased selection:bg-white selection:text-black relative overflow-hidden transition-colors duration-1000 ${getFontClass(oledSettings.fontFamily)} ${
        oledSettings.background === 'pure' ? 'bg-[#000000]' : 'bg-[#020202]'
      }`}
    >
      
      {/* 1. SOFTWARE DIMMER OVERLAY (Applies precise overall dimming factor below the control panel) */}
      <div 
        id="software-brightness-dimmer"
        className="fixed inset-0 bg-black pointer-events-none z-[99]" 
        style={{ opacity: 1 - oledSettings.brightness / 100 }}
      />

      {/* 2. BACKGROUND ENVIRONMENTS */}
      {/* Background Mode: Minimal solid grid (1% Maximum opacity) */}
      {oledSettings.background === 'grid' && (
        <div 
          id="bg-mesh-grid"
          className="absolute inset-0 opacity-[0.012] pointer-events-none" 
          style={{
            backgroundImage: `linear-gradient(to right, #fafafa 1px, transparent 1px), linear-gradient(to bottom, #fafafa 1px, transparent 1px)`,
            backgroundSize: "42px 42px"
          }}
        />
      )}

      {/* Background Mode: Dynamic interactive starfield featuring parallax horizontal mouse alignment & twinkling flickers */}
      {oledSettings.background === 'starfield' && (
        <div id="bg-starfield" className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {stars.map((star) => {
            // High efficiency flickering math powered by our mono state clock
            const pulse = Math.cos((animationPos.time * star.flickerSpeed) + star.phase);
            const opacity = star.depth < 0.4
              ? 0.12 + (pulse + 1) * 0.14 // faint twinkle for distant background stars
              : 0.22 + (pulse + 1) * 0.34; // bright twinkle for closer layers
            
            // Continuous cosmic drift: depth layer determines speed
            // Far stars drift extremely slowly, closer stars drift slightly faster
            const driftSpeedX = 0.08 * star.depth;
            const driftSpeedY = 0.03 * star.depth;
            
            let leftPercent = (star.x + (animationPos.time * driftSpeedX)) % 100;
            if (leftPercent < 0) leftPercent += 100;
            
            let topPercent = (star.y + (animationPos.time * driftSpeedY)) % 100;
            if (topPercent < 0) topPercent += 100;
            
            // Mouse perspective displacement
            const px = animationPos.mx * star.depth * 28;
            const py = animationPos.my * star.depth * 28;

            return (
              <div
                key={star.id}
                className="absolute rounded-full bg-zinc-100"
                style={{
                  left: `${leftPercent}%`,
                  top: `${topPercent}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  opacity: opacity,
                  transform: `translate3d(${px}px, ${py}px, 0)`,
                  boxShadow: star.size > 1.8 ? "0 0 6px rgba(255, 255, 255, 0.45)" : "none"
                }}
              />
            );
          })}
        </div>
      )}

      {/* Responsive Moving Main Containment Box */}
      <div 
        id="app-content-wrapper" 
        className="w-full flex-grow flex flex-col justify-center relative z-10"
        style={getContainerStyles}
      >
        <main ref={contentRef} id="app-content" className="max-w-4xl w-full mx-auto flex flex-col justify-center gap-8 my-auto relative">
          
          {/* Countdown Hero Box */}
          <div className={`border rounded-2xl p-8 md:p-12 flex flex-col justify-between relative overflow-hidden transition-colors duration-300 ${
            oledSettings.background === 'pure' 
              ? 'bg-black border-zinc-950 shadow-none' 
              : 'bg-zinc-950/90 border-zinc-900 shadow-2xl'
          }`}>
            {/* Elegant Settings Dial attached to the moving board */}
            <button
              id="btn-edit-settings"
              onClick={() => setIsEditing(true)}
              className="absolute top-4 right-4 md:top-6 md:right-6 p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-850 rounded-lg transition-all duration-200 cursor-pointer flex items-center z-20 group"
              aria-label="Configuration Panel"
              title="Configure Target and OLED properties (Press [O])"
            >
              <Settings2 className="h-4 w-4 group-hover:rotate-45 transition-transform duration-300" />
            </button>

            {/* Subtle backdrop glow */}
            {oledSettings.background !== 'pure' && (
              <div className="absolute top-0 right-1/4 w-96 h-96 bg-zinc-800/5 rounded-full blur-[120px] pointer-events-none" />
            )}

            <div>
              {/* Top row of countdown block */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:pr-10">
                <div>
                  <h2 className={`text-3xl md:text-5xl font-bold tracking-wider text-white uppercase flex items-center gap-3 select-none ${getFontClass(oledSettings.fontFamily)}`}>
                    {milestone.title}
                  </h2>
                </div>
                <div className="md:text-right flex flex-col items-start md:items-end justify-center select-none">
                  <span className={`text-xs text-zinc-400 bg-zinc-900/60 px-3 py-1.5 rounded border border-zinc-800/80 flex items-center gap-1.5 ${getFontClass(oledSettings.fontFamily)}`}>
                    <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                    {new Date(milestone.date).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </span>
                </div>
              </div>

              {/* Grid count columns (the numerical clocks) */}
              <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 my-10 ${getFontClass(oledSettings.fontFamily)}`}>
                <div id="card-days" className="bg-black border border-zinc-900 rounded-xl p-5 md:p-8 text-center transition-all duration-300 hover:border-zinc-800 group relative select-none">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 to-transparent pointer-events-none rounded-xl" />
                  <span className={`block text-4xl md:text-6xl font-light tracking-tighter text-white ${getFontClass(oledSettings.fontFamily)}`}>
                    {countdownMetrics.days}
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-2 block font-sans">Days</span>
                </div>

                <div id="card-hours" className="bg-black border border-zinc-900 rounded-xl p-5 md:p-8 text-center transition-all duration-300 hover:border-zinc-800 group relative select-none">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 to-transparent pointer-events-none rounded-xl" />
                  <span className={`block text-4xl md:text-6xl font-light tracking-tighter text-white ${getFontClass(oledSettings.fontFamily)}`}>
                    {countdownMetrics.hours}
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-2 block font-sans">Hours</span>
                </div>

                <div id="card-minutes" className="bg-black border border-zinc-900 rounded-xl p-5 md:p-8 text-center transition-all duration-300 hover:border-zinc-800 group relative select-none">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 to-transparent pointer-events-none rounded-xl" />
                  <span className={`block text-4xl md:text-6xl font-light tracking-tighter text-white ${getFontClass(oledSettings.fontFamily)}`}>
                    {countdownMetrics.minutes}
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-2 block font-sans">Minutes</span>
                </div>

                <div id="card-seconds" className="bg-black border border-zinc-900 rounded-xl p-5 md:p-8 text-center transition-all duration-300 hover:border-gradient group relative select-none" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/10 to-transparent pointer-events-none rounded-xl" />
                  {/* Subtle ticking rendering */}
                  <span key={countdownMetrics.seconds} className={`block text-4xl md:text-6xl font-light tracking-tighter text-zinc-300 ${getFontClass(oledSettings.fontFamily)}`}>
                    {countdownMetrics.seconds}
                  </span>
                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest mt-2 block font-sans">Seconds</span>
                </div>
              </div>
            </div>

            {/* Micro Breakdown Metrics Panel */}
            <div className={`grid grid-cols-2 gap-4 border-t border-zinc-900/80 pt-8 text-xs text-zinc-400 select-none ${getFontClass(oledSettings.fontFamily)}`}>
              <div className="text-left border-r border-zinc-900/60 pr-4">
                <span className="block text-zinc-600 text-[10px] uppercase tracking-wider mb-0.5">Approx. Weeks</span>
                <span id="stats-weeks" className={`text-zinc-200 text-sm md:text-base font-light animate-fade ${getFontClass(oledSettings.fontFamily)}`}>
                  {countdownMetrics.weeksLeft}
                </span>
              </div>
              <div className="text-right pl-4">
                <span className="block text-zinc-600 text-[10px] uppercase tracking-wider mb-0.5">Hours Remaining</span>
                <span id="stats-hours" className={`text-zinc-200 text-sm md:text-base font-light ${getFontClass(oledSettings.fontFamily)}`}>
                  {countdownMetrics.hoursRemaining}
                </span>
              </div>
            </div>
          </div>

          {/* Motivational Philosophy Quote Banner (Rotates optionally on manual press) */}
          <div 
            id="quote-card"
            onClick={rotateQuote}
            className={`border p-6 text-center italic text-xs text-zinc-400 font-light relative min-h-[120px] flex flex-col justify-center items-center transition-all duration-300 group cursor-pointer select-none ${
              oledSettings.background === 'pure' 
                ? 'bg-black border-zinc-950 hover:bg-zinc-950/20 hover:border-zinc-900' 
                : 'bg-zinc-950/40 border-zinc-900/60 hover:bg-zinc-950/70 hover:border-zinc-800'
            }`}
            title="Click to sequence another piece of advice"
          >
            <span className="absolute top-2 left-4 text-zinc-800 text-3xl font-serif select-none">“</span>
            
            <div className="w-full relative px-6 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuoteIndex}
                  initial={{ opacity: 0, y: 10 * quoteDirection }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 * quoteDirection }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="space-y-3"
                >
                  <p id="motivational-quote-text" className={`text-zinc-300 text-xs md:text-sm leading-relaxed tracking-wide transition-colors duration-200 group-hover:text-white ${getFontClass(oledSettings.fontFamily)}`}>
                    "{activeQuote.text}"
                  </p>
                  <span id="motivational-quote-author" className={`block mt-2.5 text-[10px] uppercase tracking-widest text-zinc-500 not-italic group-hover:text-zinc-400 transition-colors ${getFontClass(oledSettings.fontFamily)}`}>
                    — {activeQuote.author}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            <span className="absolute bottom-1 right-4 text-zinc-800 text-3xl font-serif select-none">”</span>

            {/* Small action trigger indicator */}
            <div className={`absolute bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1 text-[9px] text-zinc-600 tracking-wider uppercase ${getFontClass(oledSettings.fontFamily)}`}>
              <RefreshCw className="h-2.5 w-2.5 text-zinc-600 animate-spin" style={{ animationDuration: '3s' }} />
              <span>Seek Quote</span>
            </div>
          </div>

        </main>
      </div>

      {/* Unified Target Event & OLED Guardian Settings Overlay Modal Panel */}
      <AnimatePresence>
        {isEditing && (
          <div id="settings-overlay" className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 max-w-md w-full shadow-2xl relative z-[1001]"
            >
              {/* Close Button */}
              <button
                id="btn-close-settings"
                onClick={() => setIsEditing(false)}
                className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-white bg-zinc-900 rounded-lg border border-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Title Header */}
              <div className="flex items-center gap-2 mb-6 pb-2 border-b border-zinc-900">
                <Sliders className="h-4 w-4 text-emerald-500" />
                <span className="font-mono text-xs uppercase tracking-widest font-semibold text-white">System Config</span>
              </div>

              {/* Tab Selector Links */}
              <div className="flex bg-black p-1 rounded-lg border border-zinc-900 mb-6 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('events')}
                  className={`flex-1 py-2 text-center rounded-md cursor-pointer transition-colors ${
                    activeTab === 'events' 
                      ? 'bg-zinc-900 text-white font-medium' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Countdown Target
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('oled')}
                  className={`flex-1 py-2 text-center rounded-md cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === 'oled' 
                      ? 'bg-zinc-900 text-emerald-400 font-medium' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Tv className="h-3 w-3" />
                  OLED Guardian
                </button>
              </div>

              {/* TAB 1: COUNTDOWN TARGET EVENT SETUPS */}
              {activeTab === 'events' && (
                <form onSubmit={saveMilestone} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-1">
                      Event / Board Title
                    </label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. CBSE, NEET, JEE, SURGERY"
                      maxLength={24}
                      className="w-full bg-black border border-zinc-900 focus:border-zinc-700 text-white rounded-lg p-3 text-sm font-mono tracking-wide placeholder-zinc-700 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-1">
                      Target Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-black border border-zinc-900 focus:border-zinc-700 text-white rounded-lg p-3 text-sm font-mono placeholder-zinc-700 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={resetToDefault}
                      className="flex-1 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer text-center"
                    >
                      Reset Default
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 px-4 bg-white hover:bg-zinc-200 text-black rounded-lg text-xs font-mono font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="h-3 w-3" />
                      <span>Apply changes</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: SYSTEM OLED GUARDIAN PARAMETERS */}
              {activeTab === 'oled' && (
                <div className="space-y-5 font-mono text-xs">
                  
                  {/* 1. Brightness Dimmer */}
                  <div className="bg-black/40 border border-zinc-900 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Sun className="h-3.5 w-3.5 text-zinc-500" />
                        <span>Overall Brightness</span>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-300 font-semibold">{oledSettings.brightness}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      step="5"
                      value={oledSettings.brightness}
                      onChange={(e) => updateOledSetting('brightness', Number(e.target.value))}
                      className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* 2. Layout Movement Choices */}
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
                      Safe Board Movement Mode
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'static', title: 'Static' },
                        { key: 'bounce', title: 'TV Bounce' },
                        { key: 'jump', title: 'Periodic Jump' }
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => updateOledSetting('movementMode', item.key as any)}
                          className={`py-2 px-1 text-center rounded-lg border text-[11px] cursor-pointer transition-all duration-200 ${
                            oledSettings.movementMode === item.key 
                              ? 'bg-zinc-900 border-zinc-700 text-emerald-400 font-medium shadow-[0_0_8px_rgba(16,185,129,0.15)]' 
                              : 'bg-black border-zinc-900 text-zinc-500 hover:border-zinc-800'
                          }`}
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>

                    {/* Movement Mode Config & Parameters */}
                    {oledSettings.movementMode === 'static' && (
                      <p className="text-[10px] text-rose-500/80 leading-normal">
                        ⚠ Elements stay tightly locked at screen absolute center. Intended only for standard monitors. High burn-in risk.
                      </p>
                    )}

                    {oledSettings.movementMode === 'bounce' && (
                      <div className="bg-black/50 border border-zinc-900 p-3 rounded-lg space-y-2.5 mt-1 animate-fade">
                        <div className="flex justify-between items-center text-zinc-400">
                          <span className="text-[10px]">Bounce Travel Speed</span>
                          <span className="text-zinc-300 font-semibold text-[11px] font-mono">{getSpeedLabel(oledSettings.bounceSpeedSeconds)}</span>
                        </div>
                        <input 
                          type="range" 
                          min="5" 
                          max="600" 
                          step="1"
                          value={oledSettings.bounceSpeedSeconds}
                          onChange={(e) => updateOledSetting('bounceSpeedSeconds', Number(e.target.value))}
                          className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                        />
                        <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
                          <span>Fast (5s)</span>
                          <span>Slow (10m)</span>
                        </div>
                      </div>
                    )}

                    {oledSettings.movementMode === 'jump' && (
                      <div className="bg-black/50 border border-zinc-900 p-3 rounded-lg space-y-2.5 mt-1 animate-fade">
                        <div className="flex justify-between items-center text-zinc-400">
                          <span className="text-[10px]">Hop Frequency</span>
                          <span className="text-zinc-300 font-semibold text-[11px] font-mono">{oledSettings.jumpInterval === 1 ? 'Every 1 Minute' : `Every ${oledSettings.jumpInterval} Minutes`}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="60" 
                          step="1"
                          value={oledSettings.jumpInterval}
                          onChange={(e) => updateOledSetting('jumpInterval', Number(e.target.value))}
                          className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                        />
                        <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
                          <span>1 Min</span>
                          <span>60 Mins</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-zinc-900/60 text-zinc-500">
                          <span>Next displacement hop:</span>
                          <span className="text-zinc-300 font-medium font-mono">{secondsToNextJump}s</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Micro Pixel Shift Switch */}
                  <div className="bg-black/40 border border-zinc-900 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-zinc-400">Micro Pixel-Shift Jitters</span>
                        <p className="text-[10px] text-zinc-600">Subtly vibrates coordinates every 12s</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateOledSetting('pixelShift', !oledSettings.pixelShift)}
                        className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                          oledSettings.pixelShift ? 'bg-emerald-500' : 'bg-zinc-800'
                        }`}
                      >
                        <div className={`bg-black w-4 h-4 rounded-full shadow-md transform duration-200 ${
                          oledSettings.pixelShift ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {oledSettings.pixelShift && (
                      <div className="space-y-1.5 pt-2 border-t border-zinc-900/60 animate-fade">
                        <div className="flex justify-between text-[10px] text-zinc-500">
                          <span>Jitter Radius</span>
                          <span>{oledSettings.pixelShiftAmount}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="8" 
                          value={oledSettings.pixelShiftAmount}
                          onChange={(e) => updateOledSetting('pixelShiftAmount', Number(e.target.value))}
                          className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* 4. Background select list */}
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
                      Wallpaper Ambient Environment
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'grid', label: 'Tech Grid' },
                        { key: 'pure', label: 'AMOLED Pure' },
                        { key: 'starfield', label: 'Parallax Stars' }
                      ].map((bg) => (
                        <button
                          key={bg.key}
                          type="button"
                          onClick={() => updateOledSetting('background', bg.key as any)}
                          className={`py-2 px-1 text-center rounded-lg border text-[10px] uppercase tracking-widest cursor-pointer transition-all duration-200 ${
                            oledSettings.background === bg.key 
                              ? 'bg-zinc-900 border-zinc-700 text-emerald-400 font-medium' 
                              : 'bg-black border-zinc-900 text-zinc-500 hover:border-zinc-800'
                          }`}
                        >
                          {bg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. Typography Font Family */}
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
                      Typography Theme Font
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'bebas', label: 'Big 4 Display' },
                        { key: 'sans', label: 'Inter Sans' },
                        { key: 'serif', label: 'Cormorant Serif' },
                        { key: 'mono', label: 'JetBrains Mono' },
                        { key: 'space', label: 'Space Grotesk' },
                        { key: 'outfit', label: 'Outfit Display' }
                      ].map((fontItem) => (
                        <button
                          key={fontItem.key}
                          type="button"
                          onClick={() => updateOledSetting('fontFamily', fontItem.key as any)}
                          className={`py-2 px-1 text-center rounded-lg border text-[10px] font-semibold cursor-pointer transition-all duration-200 ${
                            oledSettings.fontFamily === fontItem.key 
                              ? 'bg-zinc-900 border-zinc-700 text-emerald-400 font-semibold shadow-[0_0_8px_rgba(16,185,129,0.15)]' 
                              : 'bg-black border-zinc-900 text-zinc-500 hover:border-zinc-800'
                          }`}
                        >
                          {fontItem.label}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </div>
  );
}
