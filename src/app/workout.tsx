import { useFocusEffect } from "expo-router";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Background from "../components/Background";
import BottomNav from "../components/BottomNav";
import Glass from "../components/Glass";
import { formatDate, formatTime, useNow } from "../hooks/useNow";
import { getWorkout, isFinished, saveProgress } from "../Logic/workout";

type Exercise = Awaited<ReturnType<typeof getWorkout>>[number];

const ACCENT = [218, 164, 100]; // DAA464

// blend from the normal text color to the accent color
function mix(from: number[], t: number) {
  const c = from.map((v, i) => Math.round(v + (ACCENT[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export default function Workout() {
  const { colorScheme } = useColorScheme();
  const inkRgb = colorScheme === "dark" ? [255, 237, 185] : [22, 28, 16];
  const inkColor = `rgb(${inkRgb.join(",")})`;
  const now = useNow();

  const [items, setItems] = useState<Exercise[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      getWorkout().then(setItems);
    }, []),
  );

  const setDone = (id: string, done: number) => {
    setItems((list) => list!.map((e) => (e.id === id ? { ...e, done } : e)));
    saveProgress(id, done);
  };

  // tap = +1 round (does nothing once finished)
  const onTap = (e: Exercise) => {
    if (!isFinished(e)) setDone(e.id, e.done + 1);
  };
  // long press = undo one round
  const onUndo = (e: Exercise) => {
    if (e.done > 0) setDone(e.id, e.done - 1);
  };

  if (!items) {
    return (
      <Background>
        <BottomNav />
      </Background>
    );
  }

  const allDone = items.length > 0 && items.every(isFinished);

  return (
    <Background>
      {/* header */}
      <View className="flex-row justify-between">
        <Text className="text-big">let's{"\n"}Go</Text>
        <Text className="text-right font-mono text-xs text-ink">
          {formatDate(now)}
          {"\n"}
          {formatTime(now)}
        </Text>
      </View>

      {/* exercises */}
      <Glass className="mt-6 flex-1">
        <Text className="mb-6 text-center font-mono text-sm text-ink">
          Today's exercises
        </Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {items.map((e) => {
            const finished = isFinished(e);
            // 0 -> ink, last round -> full accent (steps scale with the number of rounds)
            const t = e.rounds > 1 ? Math.min(1, e.done / (e.rounds - 1)) : 0;
            const color = e.done === 0 ? inkColor : mix(inkRgb, t);

            return (
              <Pressable
                key={e.id}
                onPress={() => onTap(e)}
                onLongPress={() => onUndo(e)}
                className="mb-5 active:opacity-70"
              >
                <View className="flex-row justify-between">
                  <Text className="flex-1 font-mono text-xs" style={{ color }}>
                    {e.name}
                  </Text>
                  <Text className="w-20 font-mono text-xs" style={{ color }}>
                    {e.reps} reps
                  </Text>
                  <Text className="w-24 font-mono text-xs" style={{ color }}>
                    {e.done > 0 && !finished
                      ? `${e.done}/${e.rounds}`
                      : e.rounds}{" "}
                    rounds
                  </Text>
                </View>

                {/* the line over a finished exercise */}
                {finished && (
                  <View
                    className="absolute left-0 right-0 top-1/2 h-px"
                    style={{ backgroundColor: inkColor }}
                  />
                )}
              </Pressable>
            );
          })}

          {allDone && (
            <Text className="mt-4 text-center font-mono text-xs text-accent">
              workout done, well played
            </Text>
          )}
        </ScrollView>
      </Glass>

      <BottomNav />
    </Background>
  );
}
