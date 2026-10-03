import Svg, { Circle, Path } from "react-native-svg";

export type ShapeId = "classic" | "chubby" | "spiky" | "four" | "six";
export type ColorId = "sage" | "moss" | "orange" | "brown" | "forest";
export type Avatar = { shape: ShapeId; color: ColorId };

// points = how many arms, inner = how fat the body is (bigger = rounder)
export const SHAPES: { id: ShapeId; points: number; inner: number }[] = [
  { id: "classic", points: 5, inner: 0.5 },
  { id: "chubby", points: 5, inner: 0.72 },
  { id: "spiky", points: 5, inner: 0.4 },
  { id: "four", points: 4, inner: 0.5 },
  { id: "six", points: 6, inner: 0.58 },
];

// fill = star color, face = eyes and mouth (picked to stay readable)
export const COLORS: { id: ColorId; fill: string; face: string }[] = [
  { id: "sage", fill: "#97A87A", face: "#161C10" },
  { id: "moss", fill: "#3A4A2A", face: "#FFEDB9" },
  { id: "orange", fill: "#DAA464", face: "#161C10" },
  { id: "brown", fill: "#3E3929", face: "#FFEDB9" },
  { id: "forest", fill: "#161C10", face: "#FFEDB9" },
];

function starPath(points: number, inner: number) {
  const cx = 100;
  const cy = 104;
  const outer = 76;
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : outer * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    d += `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)} `;
  }
  return d + "Z";
}

type Props = Avatar & { size?: number };

export default function StarAvatar({ shape, color, size = 96 }: Props) {
  const s = SHAPES.find((x) => x.id === shape) ?? SHAPES[0];
  const c = COLORS.find((x) => x.id === color) ?? COLORS[0];

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Path
        d={starPath(s.points, s.inner)}
        fill={c.fill}
        stroke={c.fill}
        strokeWidth={14}
        strokeLinejoin="round"
      />
      <Circle cx="84" cy="98" r="6" fill={c.face} />
      <Circle cx="116" cy="98" r="6" fill={c.face} />
      <Path
        d="M85 116 Q100 132 115 116"
        stroke={c.face}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
