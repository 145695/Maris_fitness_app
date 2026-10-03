import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

export type TrackType = "sleep" | "water";

// everything that differs between the two trackers lives here
const CONFIG = {
  sleep: {
    title: "how long did you sleep?",
    unit: "h",
    step: 0.5,
    max: 14,
    quick: [] as number[],
  },
  water: {
    title: "how much did you drink?",
    unit: "L",
    step: 0.25,
    max: 8,
    quick: [0.25, 0.5, 1], // "+ 0.25 L" style shortcuts
  },
};

const CREAM = "#FFEDB9";
const round = (n: number) => Math.round(n * 100) / 100;

type Props = {
  type: TrackType | null; // null = closed
  current: number; // value already saved for today
  goal: number;
  onSave: (type: TrackType, value: number) => void;
  onClose: () => void;
};

export default function TrackModal({
  type,
  current,
  goal,
  onSave,
  onClose,
}: Props) {
  const [draft, setDraft] = useState(current);

  // every time it opens, start from what's saved
  useEffect(() => {
    if (type) setDraft(current);
  }, [type, current]);

  if (!type) return null;
  const cfg = CONFIG[type];

  const change = (delta: number) =>
    setDraft((d) => Math.min(cfg.max, Math.max(0, round(d + delta))));

  const ratio = Math.min(1, draft / goal);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* dark area: tap it to cancel */}
      <Pressable className="flex-1 bg-black/50" onPress={onClose} />

      <View className="sheet pb-10">
        <Text className="text-center font-mono text-xs tracking-widest text-accent">
          {cfg.title}
        </Text>

        {/* value with - and + */}
        <View className="my-6 flex-row items-center justify-center gap-6">
          <Pressable
            onPress={() => change(-cfg.step)}
            className="h-12 w-12 items-center justify-center rounded-full active:opacity-70"
            style={{ borderWidth: 1, borderColor: "rgba(255,237,185,0.5)" }}
          >
            <Text className="font-mono text-2xl" style={{ color: CREAM }}>
              -
            </Text>
          </Pressable>

          <View className="w-32 items-center">
            <Text className="font-mono text-4xl text-accent">{draft}</Text>
            <Text className="font-mono text-xs" style={{ color: CREAM }}>
              {cfg.unit} / {goal} {cfg.unit}
            </Text>
          </View>

          <Pressable
            onPress={() => change(cfg.step)}
            className="h-12 w-12 items-center justify-center rounded-full active:opacity-70"
            style={{ borderWidth: 1, borderColor: "rgba(255,237,185,0.5)" }}
          >
            <Text className="font-mono text-2xl" style={{ color: CREAM }}>
              +
            </Text>
          </Pressable>
        </View>

        {/* progress toward the goal */}
        <View
          className="h-2 overflow-hidden rounded-full"
          style={{ backgroundColor: "rgba(255,237,185,0.2)" }}
        >
          <View
            className="h-full rounded-full bg-accent"
            style={{ width: `${ratio * 100}%` }}
          />
        </View>

        {/* quick add (water only) */}
        {cfg.quick.length > 0 && (
          <View className="mt-6 flex-row justify-center gap-3">
            {cfg.quick.map((q) => (
              <Pressable
                key={q}
                onPress={() => change(q)}
                className="rounded-full px-4 py-2 active:opacity-70"
                style={{ borderWidth: 1, borderColor: "rgba(255,237,185,0.5)" }}
              >
                <Text className="font-mono text-xs" style={{ color: CREAM }}>
                  + {q} {cfg.unit}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* buttons */}
        <View className="mt-8 flex-row justify-center gap-4">
          <Pressable
            onPress={onClose}
            className="rounded-full px-8 py-3 active:opacity-70"
            style={{ borderWidth: 1, borderColor: "rgba(255,237,185,0.5)" }}
          >
            <Text
              className="font-mono text-xs tracking-widest"
              style={{ color: CREAM }}
            >
              cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onSave(type, draft)}
            className="rounded-full bg-accent px-8 py-3 active:opacity-80"
          >
            <Text className="font-mono text-xs tracking-widest text-[#161C10]">
              save
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
