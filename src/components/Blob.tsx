import { useColorScheme } from "nativewind";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

export type BlobShape = "a" | "b" | "c" | "cta";

// polygons are inset from the edge; the round stroke rounds the corners
const SHAPES: Record<BlobShape, { d: string; w: number; h: number }> = {
  a: { w: 320, h: 64, d: "M30 10 L294 10 L310 54 L10 46 Z" },
  b: { w: 320, h: 64, d: "M12 10 L294 10 L310 54 L12 40 Z" },
  c: { w: 320, h: 64, d: "M26 10 L302 10 L302 40 L10 54 Z" },
  cta: { w: 320, h: 84, d: "M34 10 L296 10 L266 40 L310 62 L308 76 L12 68 Z" },
};

type Props = {
  shape?: BlobShape;
  selected?: boolean;
  disabled?: boolean;
  align?: "left" | "right" | "center";
  height?: number;
  onPress?: () => void;
  children?: React.ReactNode;
};

export default function Blob({
  shape = "a",
  selected = false,
  disabled = false,
  align = "left",
  height,
  onPress,
  children,
}: Props) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const s = SHAPES[shape];
  const fill = selected ? "#DAA464" : dark ? "#252A1D" : "#C3C596";
  const alignItems =
    align === "right"
      ? "flex-end"
      : align === "center"
        ? "center"
        : "flex-start";

  const Wrapper: any = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      disabled={disabled}
      style={{
        height: height ?? (shape === "cta" ? 76 : 56),
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox={`0 0 ${s.w} ${s.h}`}
        preserveAspectRatio="none"
      >
        <Path
          d={s.d}
          fill={fill}
          stroke={fill}
          strokeWidth={16}
          strokeLinejoin="round"
        />
      </Svg>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems,
          paddingHorizontal: 36,
        }}
      >
        {children}
      </View>
    </Wrapper>
  );
}
