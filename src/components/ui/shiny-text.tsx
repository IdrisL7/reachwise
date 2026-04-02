"use client";

import { motion, useReducedMotion } from "framer-motion";

interface ShinyTextProps {
  text: string;
  className?: string;
  baseColor?: string;
  shineColor?: string;
  duration?: number;
  spread?: number;
}

export function ShinyText({
  text,
  className = "",
  baseColor = "#7c3aed",
  shineColor = "#ffffff",
  duration = 3,
  spread = 100,
}: ShinyTextProps) {
  const reduced = useReducedMotion();
  const backgroundImage = `linear-gradient(${spread}deg, ${baseColor} 0%, ${baseColor} 35%, ${shineColor} 50%, ${baseColor} 65%, ${baseColor} 100%)`;

  return (
    <motion.span
      className={className}
      style={{
        backgroundImage,
        backgroundSize: "220% auto",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        color: "transparent",
        WebkitTextFillColor: "transparent",
      }}
      animate={reduced ? { backgroundPosition: "50% 50%" } : { backgroundPosition: ["0% 50%", "200% 50%"] }}
      transition={{
        duration,
        ease: "linear",
        repeat: reduced ? 0 : Infinity,
      }}
    >
      {text}
    </motion.span>
  );
}
