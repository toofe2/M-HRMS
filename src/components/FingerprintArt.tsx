import React from 'react';

interface FingerprintArtProps {
  progress: number; // 0..1
  mode: 'checkin' | 'checkout';
  pressing: boolean;
}

export default function FingerprintArt({
  progress,
  mode,
  pressing,
}: FingerprintArtProps) {
  const p = Math.max(0, Math.min(1, progress));

  const accent = mode === 'checkout' ? '#e11d48' : '#059669';
  const base = 'rgba(17,24,39,0.92)';
  const dim = 'rgba(17,24,39,0.18)';

  const clipY = (1 - p) * 100;
  const scanY = 12 + p * 86;

  return (
    <div className="relative w-[260px] h-[340px] sm:w-[300px] sm:h-[390px] md:w-[340px] md:h-[440px]">
      <svg
        viewBox="0 0 360 360"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
        shapeRendering="geometricPrecision"
      >
        <defs>
          <clipPath id="fpFillClip">
            <rect x="0" y={`${clipY}%`} width="360" height="360" />
          </clipPath>

          <linearGradient id="fpAccent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.12" />
            <stop offset="45%" stopColor={accent} stopOpacity="0.38" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.78" />
          </linearGradient>

          <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="ridgeSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.35" />
          </filter>

          <radialGradient id="fpFade" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="72%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0.45" />
          </radialGradient>

          <mask id="fpMask">
            <rect x="0" y="0" width="360" height="360" fill="url(#fpFade)" />
          </mask>
        </defs>

        {/* خلفية خفيفة */}
        <g
          mask="url(#fpMask)"
          fill="none"
          stroke={dim}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        >
          <path d="M60 120c18-34 56-58 120-58s102 24 120 58" />
          <path d="M45 160c12-66 70-110 135-110s123 44 135 110" />
          <path d="M40 200c6-92 72-154 140-154s134 62 140 154" />
          <path d="M58 238c0-100 48-188 122-188s122 88 122 188" />
          <path d="M84 276c0-108 34-224 96-224s96 116 96 224" />
        </g>

        {/* الخطوط الأساسية */}
        <g
          mask="url(#fpMask)"
          fill="none"
          stroke={base}
          strokeWidth="7.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#ridgeSoft)"
          style={{
            opacity: pressing ? 0.98 : 0.92,
            transition: 'opacity 180ms ease',
          }}
        >
          <path d="M176 20c-60 8-110 46-138 100-28 54-28 120-2 176 26 56 76 98 140 108 74 10 144-24 184-86 40-62 44-142 8-206-36-64-108-102-192-92" />
          <path d="M180 52c-46 6-84 34-106 74-22 40-24 90-6 132 18 42 54 72 98 80 54 10 108-10 140-52 32-42 38-96 14-142-24-46-72-76-140-92" />
          <path d="M120 120c20-26 52-42 88-42s68 16 88 42" />
          <path d="M96 156c12-50 56-86 112-86s100 36 112 86" />
          <path d="M94 198c6-74 58-126 118-126s112 52 118 126" />
          <path d="M112 238c0-82 40-152 100-152s100 70 100 152" />
          <path d="M142 280c0-88 24-184 70-184s70 96 70 184" />
          <path d="M168 312c0-94 6-214 12-214s12 120 12 214" />
        </g>

        {/* التعبئة حسب progress */}
        <g
          clipPath="url(#fpFillClip)"
          mask="url(#fpMask)"
          fill="none"
          stroke="url(#fpAccent)"
          strokeWidth="7.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#softGlow)"
          style={{
            opacity: pressing ? 1 : 0,
            transition: pressing ? 'none' : 'opacity 180ms ease',
          }}
        >
          <path d="M176 20c-60 8-110 46-138 100-28 54-28 120-2 176 26 56 76 98 140 108 74 10 144-24 184-86 40-62 44-142 8-206-36-64-108-102-192-92" />
          <path d="M180 52c-46 6-84 34-106 74-22 40-24 90-6 132 18 42 54 72 98 80 54 10 108-10 140-52 32-42 38-96 14-142-24-46-72-76-140-92" />
          <path d="M120 120c20-26 52-42 88-42s68 16 88 42" />
          <path d="M96 156c12-50 56-86 112-86s100 36 112 86" />
          <path d="M94 198c6-74 58-126 118-126s112 52 118 126" />
          <path d="M112 238c0-82 40-152 100-152s100 70 100 152" />
          <path d="M142 280c0-88 24-184 70-184s70 96 70 184" />
          <path d="M168 312c0-94 6-214 12-214s12 120 12 214" />
        </g>

        {/* Scan line */}
        {pressing && (
          <>
            <line
              x1="70"
              x2="290"
              y1={(scanY / 100) * 360}
              y2={(scanY / 100) * 360}
              stroke={accent}
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.45"
            />
            <line
              x1="70"
              x2="290"
              y1={(scanY / 100) * 360 + 3}
              y2={(scanY / 100) * 360 + 3}
              stroke={accent}
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.18"
            />
          </>
        )}
      </svg>
    </div>
  );
}
