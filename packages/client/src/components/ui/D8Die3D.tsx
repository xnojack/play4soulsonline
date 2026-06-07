import React from 'react';
import { motion } from 'framer-motion';

interface D8Die3DProps {
  value: number;
}

export function D8Die3D({ value }: D8Die3DProps) {
  const isLow = value <= 2;
  const isCritical = value <= 1;

  const faceColor = isCritical ? '#7f1d1d' : isLow ? '#431407' : '#451a03';
  const edgeColor = isCritical ? '#ef4444' : isLow ? '#f97316' : '#eab308';
  const textColor = isCritical ? '#fca5a5' : isLow ? '#fdba74' : '#fde047';
  const glowColor = isCritical ? 'rgba(239, 68, 68, 0.4)' : isLow ? 'rgba(249, 115, 22, 0.2)' : 'rgba(234, 179, 8, 0.15)';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative"
        style={{
          width: 80,
          height: 92,
          perspective: '400px',
        }}
      >
        <motion.div
          className="relative w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(-10deg) rotateY(-15deg)',
          }}
          animate={
            isCritical && value > 0
              ? {
                  rotateY: [-15, -10, -15, -20, -15],
                }
              : {}
          }
          transition={
            isCritical && value > 0
              ? {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              : undefined
          }
        >
          {/* Front face */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(14px)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: `linear-gradient(180deg, ${faceColor}ee, ${faceColor})`,
              boxShadow: `0 0 ${isCritical ? 16 : isLow ? 10 : 6}px ${glowColor}`,
            }}
          >
            <div
              className="absolute inset-[6%]"
              style={{
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                border: `2px solid ${edgeColor}`,
              }}
            />
            {/* Number — absolutely centered within the face */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: 'translateZ(1px)' }}
            >
              <span
                className="text-4xl font-bold font-mono"
                style={{ color: textColor, textShadow: `0 0 8px ${glowColor}` }}
              >
                {value}
              </span>
            </div>
          </div>

          {/* Back face */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(-14px) rotateY(180deg)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: faceColor,
            }}
          />

          {/* Left bevel */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(0px) rotateY(-30deg) translateX(-10px)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: `${faceColor}aa`,
            }}
          />

          {/* Right bevel */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(0px) rotateY(30deg) translateX(10px)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: `${faceColor}aa`,
            }}
          />

          {/* Top bevel */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(0px) rotateX(30deg) translateY(-10px)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: `${faceColor}cc`,
            }}
          />

          {/* Bottom bevel */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(0px) rotateX(-30deg) translateY(10px)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: `${faceColor}88`,
            }}
          />
        </motion.div>
      </div>

      <span
        className="text-xs font-medium uppercase tracking-wider"
        style={{
          color: isCritical ? '#f8717180' : isLow ? '#fb923c80' : '#e5e5e566',
        }}
      >
        D8
      </span>
    </div>
  );
}
