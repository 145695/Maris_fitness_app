import { useColorScheme } from "nativewind";
import { Pressable } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export type Mood = "happy" | "sad" | "angry";

// mouth + eyebrows for each mood (eyes are the same dots for all)
const FACES: Record<Mood, { mouth: string; brows: string[] }> = {
  happy: {
    mouth: "M172 190 Q200 224 228 190", // smile
    brows: [],
  },
  sad: {
    mouth: "M174 220 Q200 190 226 220", // frown
    brows: ["M146 126 L188 110", "M212 110 L254 126"], // inner ends raised
  },
  angry: {
    mouth: "M176 216 Q200 200 224 216", // tight frown
    brows: ["M146 108 L190 128", "M210 128 L254 108"], // inner ends lowered
  },
};

type Props = { mood: Mood; size?: number; onPress?: () => void };

export default function MoodStar({ mood, size = 64, onPress }: Props) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const body = dark ? "#97A87A" : "#3A4A2A";
  const face = dark ? "#161C10" : "#FFEDB9";
  const { mouth, brows } = FACES[mood];

  return (
    <Pressable onPress={onPress} disabled={!onPress} hitSlop={8}>
      <Svg width={size} height={size * 0.95} viewBox="0 0 400 380">
        <Path
          fill={body}
          stroke={body}
          strokeWidth={22}
          strokeLinejoin="round"
          d="M200 20 L258.8 124.1 L375.9 147.8 L295.1 235.9 L308.7 354.7 L200 305 L91.3 354.7 L104.9 235.9 L24.1 147.8 L141.2 124.1 Z"
        />

        {/* eyes */}
        <Circle cx="170" cy="145" r="10" fill={face} />
        <Circle cx="230" cy="145" r="10" fill={face} />

        {/* eyebrows (sad and angry only) */}
        {brows.map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke={face}
            strokeWidth={9}
            strokeLinecap="round"
            fill="none"
          />
        ))}

        {/* mouth */}
        <Path
          d={mouth}
          stroke={face}
          strokeWidth={10}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );
}
