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
          width: 56,
          height: 64,
          perspective: '200px',
        }}
      >
        <motion.div
          className="relative w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(-15deg) rotateY(-25deg)',
          }}
          animate={
            isCritical && value > 0
              ? {
                  rotateY: [-25, -20, -25, -30, -25],
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
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(12px)',
              clipPath: 'polygon(50% 5%, 95% 30%, 95% 70%, 50% 95%, 5% 70%, 5% 30%)',
              background: `linear-gradient(180deg, ${faceColor}dd, ${faceColor})`,
              border: `2px solid ${edgeColor}`,
              boxShadow: `0 0 ${isCritical ? 16 : isLow ? 10 : 6}px ${glowColor}`,
            }}
          >
            <span
              className="text-3xl font-bold font-mono"
              style={{ color: textColor }}
            >
              {value}
            </span>
          </div>

          {/* Back face (behind) */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(-12px) rotateY(180deg)',
              clipPath: 'polygon(50% 5%, 95% 30%, 95% 70%, 50% 95%, 5% 70%, 5% 30%)',
              background: faceColor,
              border: `2px solid ${edgeColor}88`,
            }}
          />

          {/* Left face (side bevel) */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(0px) rotateY(-30deg) translateX(-8px)',
              clipPath: 'polygon(50% 5%, 95% 30%, 95% 70%, 50% 95%, 5% 70%, 5% 30%)',
              background: `${faceColor}aa`,
              border: `1px solid ${edgeColor}44`,
            }}
          />

          {/* Right face (side bevel) */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(0px) rotateY(30deg) translateX(8px)',
              clipPath: 'polygon(50% 5%, 95% 30%, 95% 70%, 50% 95%, 5% 70%, 5% 30%)',
              background: `${faceColor}aa`,
              border: `1px solid ${edgeColor}44`,
            }}
          />

          {/* Top face (upper bevel) */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(0px) rotateX(30deg) translateY(-8px)',
              clipPath: 'polygon(50% 5%, 95% 30%, 95% 70%, 50% 95%, 5% 70%, 5% 30%)',
              background: `${faceColor}cc`,
              border: `1px solid ${edgeColor}66`,
            }}
          />

          {/* Bottom face (lower bevel) */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(0px) rotateX(-30deg) translateY(8px)',
              clipPath: 'polygon(50% 5%, 95% 30%, 95% 70%, 50% 95%, 5% 70%, 5% 30%)',
              background: `${faceColor}88`,
              border: `1px solid ${edgeColor}33`,
            }}
          />
        </motion.div>
      </div>

      <span
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{
          color: isCritical ? '#f8717180' : isLow ? '#fb923c80' : '#e5e5e566',
        }}
      >
        D8
      </span>
    </div>
  );
}
