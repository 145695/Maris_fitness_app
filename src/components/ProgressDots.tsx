import { useColorScheme } from "nativewind";
import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

type Props = { total: number; current: number };

const DOT = 24;
const LINE = 8;

export default function ProgressDots({ total, current }: Props) {
  const { colorScheme } = useColorScheme();
  const color = colorScheme === "dark" ? "#FFEDB9" : "#3A4A2A";

  // one animated value per dot: 0 = up (waiting), 1 = down (you are here)
  const anims = useRef(
    Array.from(
      { length: total },
      (_, i) => new Animated.Value(i === current ? 1 : 0),
    ),
  ).current;

  useEffect(() => {
    anims.forEach((v, i) =>
      Animated.spring(v, {
        toValue: i === current ? 1 : 0,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }).start(),
    );
  }, [current]);

  return (
    <View style={{ height: 52 }}>
      {/* the line */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 24,
          height: LINE,
          borderRadius: LINE,
          backgroundColor: color,
        }}
      />
      {/* the dots: resting = top half above the line, active = bottom half below it */}
      <View
        style={{
          position: "absolute",
          top: 4,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "space-around",
          paddingHorizontal: 16,
        }}
      >
        {anims.map((v, i) => (
          <Animated.View
            key={i}
            style={{
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              backgroundColor: color,
              transform: [
                {
                  translateY: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, DOT],
                  }),
                },
              ],
            }}
          />
        ))}
      </View>
    </View>
  );
}
