import { Text, View } from "react-native";

export type Bar = { label?: string; value: number | null };

type Props = {
  data: Bar[];
  max: number;
  min?: number; // use for values like weight so the bars don't all look the same
  height?: number;
  highlight?: number; // index drawn in full color
};

export default function BarChart({
  data,
  max,
  min = 0,
  height = 120,
  highlight,
}: Props) {
  return (
    <View>
      <View className="flex-row items-end gap-[3px]" style={{ height }}>
        {data.map((b, i) => {
          const ratio =
            b.value === null
              ? 0
              : Math.max(0.06, (b.value - min) / (max - min || 1));
          return (
            <View
              key={i}
              className="h-full flex-1 justify-end overflow-hidden rounded-full bg-ink/10"
            >
              <View
                className={`w-full rounded-full ${
                  highlight === undefined || highlight === i
                    ? "bg-accent"
                    : "bg-accent/70"
                }`}
                style={{ height: `${Math.min(1, ratio) * 100}%` }}
              />
            </View>
          );
        })}
      </View>

      <View className="mt-1 flex-row gap-[3px]">
        {data.map((b, i) => (
          <View key={i} className="flex-1 items-center">
            <Text className="font-mono text-[8px] text-ink" numberOfLines={1}>
              {b.label ?? ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
