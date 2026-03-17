interface RiskScoreRingProps {
  score: number  // 0–100
  size?: number
}

function riskColor(score: number): string {
  if (score <= 30) return "#22c55e"  // green-500
  if (score <= 60) return "#f59e0b"  // amber-500
  return "#ef4444"                    // red-500
}

function riskLabel(score: number): string {
  if (score <= 30) return "Low Risk"
  if (score <= 60) return "Medium Risk"
  return "High Risk"
}

export function RiskScoreRing({ score, size = 120 }: RiskScoreRingProps) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const filled = circumference * (score / 100)
  const color = riskColor(score)
  const center = size / 2

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={10}
          className="text-muted/40"
        />
        {/* Progress */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        {/* Score text — counter-rotate so it reads correctly */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${center}px ${center}px`, fill: color }}
          className="text-xl font-bold"
          fontSize={size * 0.22}
          fontWeight={700}
        >
          {score}
        </text>
      </svg>
      <span className="text-xs font-medium" style={{ color }}>{riskLabel(score)}</span>
    </div>
  )
}
