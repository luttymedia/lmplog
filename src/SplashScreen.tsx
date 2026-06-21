import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
  children: React.ReactNode;
}

export default function SplashScreen({ children }: SplashScreenProps) {
  const [isAnimating, setIsAnimating] = useState(true);

  const skip = () => setIsAnimating(false);

  // End animation after 3.5 seconds
  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 3500); 
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  return (
    <>
      {/* The App underneath */}
      {children}

      {/* The Animated Splash Screen overlay */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            className="fixed inset-0 z-[9998] flex items-center justify-center cursor-pointer select-none"
            initial={{ opacity: 1 }}
            exit={{ opacity: [1, 1, 0] }}
            transition={{ duration: 0.6, times: [0, 0.8, 1], ease: "easeInOut" }}
            onClick={skip}
          >
            {/* The dark background matching the Native Splash background */}
            <div className="absolute inset-0 bg-[#111c2e]" style={{ background: 'radial-gradient(circle at 50% 0%, #1e2f4a 0%, #111c2e 70%)' }} />

            <motion.div 
              className="relative w-[200px] h-[200px] sm:w-[300px] sm:h-[300px]"
              initial={{ scale: 1, opacity: 1 }}
              exit={{ opacity: [1, 1, 0], scale: [1, 1.15, 0] }}
              transition={{ duration: 0.6, times: [0, 0.4, 1], ease: "easeInOut" }}
            >
              <InvisiblePenLogo />
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function InvisiblePenLogo() {
  const drawVariant = {
    hidden: { pathLength: 0, fillOpacity: 0 },
    visible: { 
      pathLength: 1, 
      fillOpacity: 1,
      transition: { 
        pathLength: { duration: 1.5, ease: "easeInOut" },
        fillOpacity: { duration: 0.8, ease: "easeOut", delay: 1.2 }
      }
    }
  };

  const redDotVariant = {
    hidden: { pathLength: 0, fillOpacity: 0, opacity: 1 },
    visible: { 
      pathLength: 1, 
      fillOpacity: 1,
      // 1=Solid, 0=Off. Blinks 3 times right after fill finishes at 2.0s
      opacity: [1, 1, 0, 1, 0, 1, 0, 1, 1], 
      transition: { 
        pathLength: { duration: 1.5, ease: "easeInOut" },
        fillOpacity: { duration: 0.8, ease: "easeOut", delay: 1.2 },
        // Total duration 3.5s. 0.57 * 3.5 = 2.0s (Wait for fill to finish)
        opacity: { times: [0, 0.57, 0.61, 0.68, 0.75, 0.82, 0.89, 0.96, 1], duration: 3.5, ease: "linear" }
      }
    }
  };

  const bgVariant = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <svg viewBox="0 0 493 493" className="w-full h-full drop-shadow-xl">
      {/* Blue Background */}
      <motion.rect
        width="493"
        height="493"
        rx="111.52"
        ry="111.52"
        fill="#0991e8"
        stroke="#0991e8"
        strokeWidth="6"
        variants={drawVariant}
        initial="hidden"
        animate="visible"
      />
      
      {/* LMP */}
      <motion.path
        d="M305.32,119.27v118.6h-31.18v-65.44l-21.16,65.44h-26.09l-21.31-65.95v65.95h-31.18v-118.6h37.7l28.15,77.05,27.52-77.05h37.54Z"
        fill="#ffffff"
        stroke="#0991e8"
        strokeWidth="3"
        variants={drawVariant}
        initial="hidden"
        animate="visible"
      />
      <motion.path
        d="M126.11,212.64h34.83v25.23h-66.01v-118.6h31.18v93.37Z"
        fill="#ffffff"
        stroke="#0991e8"
        strokeWidth="3"
        variants={drawVariant}
        initial="hidden"
        animate="visible"
      />
      <motion.path
        d="M405.67,178.4c-3.13,5.89-7.85,10.6-14.16,14.13-6.31,3.53-14.03,5.3-23.14,5.3h-15.43v40.04h-31.18v-118.6h46.61c9.01,0,16.67,1.68,22.99,5.05,6.31,3.36,11.05,8.02,14.24,13.96,3.18,5.95,4.77,12.79,4.77,20.52,0,7.18-1.57,13.71-4.69,19.6ZM378.55,158.8c0-8.64-4.4-12.95-13.2-12.95h-12.41v25.74h12.41c8.8,0,13.2-4.26,13.2-12.79Z"
        fill="#ffffff"
        stroke="#0991e8"
        strokeWidth="3"
        variants={drawVariant}
        initial="hidden"
        animate="visible"
      />

      {/* LOG */}
      <motion.path
        d="M128.26,355.64h34.83v25.23h-66.01v-118.6h31.18v93.37Z"
        fill="#ffffff"
        stroke="#0991e8"
        strokeWidth="3"
        variants={drawVariant}
        initial="hidden"
        animate="visible"
      />
      <motion.path
        d="M371.95,301.3c-1.8-3.14-4.27-5.55-7.4-7.23-3.13-1.68-6.82-2.52-11.06-2.52-7.85,0-14.03,2.69-18.53,8.08-4.51,5.38-6.76,12.62-6.76,21.7,0,10.21,2.41,17.97,7.24,23.3,4.82,5.33,11.85,7.99,21.08,7.99,10.92,0,18.71-5.21,23.38-15.65h-31.34v-23.72h58.22v31.96c-2.44,6.28-6.02,12.17-10.74,17.66-4.72,5.5-10.69,10.01-17.9,13.54-7.21,3.53-15.43,5.3-24.66,5.3-11.24,0-21.18-2.55-29.82-7.65-8.64-5.1-15.33-12.22-20.04-21.37-4.72-9.14-7.08-19.6-7.08-31.38s2.36-22.06,7.08-31.21c4.72-9.14,11.37-16.26,19.96-21.37,8.59-5.1,18.5-7.65,29.75-7.65,14.1,0,25.77,3.59,35,10.77,9.23,7.18,14.95,16.99,17.18,29.44h-33.56Z"
        fill="#ffffff"
        stroke="#0991e8"
        strokeWidth="3"
        variants={drawVariant}
        initial="hidden"
        animate="visible"
      />

      {/* O (White outer ring) */}
      <motion.circle
        cx="226"
        cy="321"
        r="60.5"
        fill="#ffffff"
        stroke="#0991e8"
        strokeWidth="3"
        variants={drawVariant}
        initial="hidden"
        animate="visible"
      />

      {/* o (Red inner dot) */}
      <motion.circle
        cx="226"
        cy="321"
        r="34.5"
        fill="#e42324"
        stroke="#e42324"
        strokeWidth="2"
        variants={redDotVariant}
        initial="hidden"
        animate="visible"
      />
    </svg>
  );
}
