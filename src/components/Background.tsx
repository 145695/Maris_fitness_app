import { useColorScheme } from "nativewind";
import React from "react";
import { useWindowDimensions, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

type Props = {
  children?: React.ReactNode;
  eyes?: boolean;
  position?: "bottom" | "left";
  nav?: boolean; // only reserves space for the bottom nav
  star?: boolean;
};

const STAR_SCALE = 1.25;
const HIDDEN = 0.2;

export default function Background({
  children,
  eyes = true,
  position = "bottom",
  nav = true,
  star = true,
}: Props) {
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  const starFill = colorScheme === "dark" ? "#3A4A2A" : "#97A87A";

  const size = width * STAR_SCALE;
  const height = size * 0.95;
  const left = position === "left" ? -size * 0.35 : (width - size) / 2;

  return (
    <View className="flex-1 overflow-hidden bg-bg">
      {star && (
        <View
          className="pointer-events-none absolute animate-bob"
          style={{ width: size, height, left, bottom: -height * HIDDEN }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 400 380">
            <Path
              fill={starFill}
              stroke={starFill}
              strokeWidth={22}
              strokeLinejoin="round"
              d="M200 20 L258.8 124.1 L375.9 147.8 L295.1 235.9 L308.7 354.7 L200 305 L91.3 354.7 L104.9 235.9 L24.1 147.8 L141.2 124.1 Z"
            />
            {eyes && (
              <>
                <Circle cx="170" cy="140" r="10" fill="#000" />
                <Circle cx="230" cy="140" r="10" fill="#000" />
              </>
            )}
          </Svg>
        </View>
      )}

      <View className={`flex-1 px-5 pt-14 ${nav ? "pb-24" : "pb-4"}`}>
        {children}
      </View>
    </View>
  );
}
