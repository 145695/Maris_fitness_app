import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Background from "../components/Background";
import BottomNav from "../components/BottomNav";
import Glass from "../components/Glass";
import MacroModal from "../components/MacroModal";
import MoodStar, { type Mood } from "../components/MoodStar";
import TrackModal, { type TrackType } from "../components/TrackModal";
import { getHomeData, saveMeal, saveStat } from "../Logic/home";

const WEEK_ROWS = [
  [0, 1],
  [2, 3, 4],
  [5, 6],
];

const MACRO_FIELD: Record<
  string,
  "calories" | "protein_g" | "carbs_g" | "fat_g"
> = {
  calories: "calories",
  protein: "protein_g",
  carbs: "carbs_g",
  fat: "fat_g",
};

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Bar({ value }: { value: number }) {
  return (
    <View className="mt-1 h-2 overflow-hidden rounded-full bg-ink/15">
      <View
        className="h-full rounded-full bg-accent"
        style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }}
      />
    </View>
  );
}

export default function Home() {
  const { colorScheme } = useColorScheme();
  const dimStar =
    colorScheme === "dark" ? "rgba(255,237,185,0.25)" : "rgba(22,28,16,0.2)";
  const now = useNow();
  const [tracking, setTracking] = useState<TrackType | null>(null);
  const [macroModal, setMacroModal] = useState<{
    label: string;
    field: "calories" | "protein_g" | "carbs_g" | "fat_g";
    unit: string;
  } | null>(null);

  const [data, setData] = useState<Awaited<
    ReturnType<typeof getHomeData>
  > | null>(null);

  useFocusEffect(
    useCallback(() => {
      getHomeData().then(setData);
    }, []),
  );

  if (!data) return <Background />;

  const h = now.getHours();
  const date = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const time = `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  const statRows = [
    { type: "sleep" as const, label: "sleep", ...data.stats.sleep },
    { type: "water" as const, label: "water", ...data.stats.water },
  ];

  const onSaveStat = async (type: TrackType, value: number) => {
    setData({
      ...data,
      stats: { ...data.stats, [type]: { ...data.stats[type], value } },
    });
    setTracking(null);
    await saveStat(type, value);
  };

  const onSaveMacro = async (value: number) => {
    if (!macroModal) return;
    const field = macroModal.field;
    setMacroModal(null);
    await saveMeal({ [field]: value });
    getHomeData().then(setData);
  };

  return (
    <Background>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 12 }}
      >
        <View className="flex-row justify-between">
          <Text className="text-big">
            HI,{"\n"}
            {data.name}
          </Text>
          <Text className="text-right font-mono text-xs text-ink">
            {date}
            {"\n"}
            {time}
          </Text>
        </View>

        <View className="mt-4 h-[330px] flex-row gap-3">
          <View className="flex-1 gap-3">
            <Glass className="h-32">
              <Text className="text-center font-mono text-[10px] text-ink">
                Maris's mood
              </Text>
              <View className="flex-1 items-center justify-center">
                <MoodStar mood={data.mood as Mood} />
              </View>
            </Glass>

            <Glass className="flex-1">
              <Text className="mb-3 font-mono text-[10px] text-ink">
                Today's stat
              </Text>
              {statRows.map((s) => (
                <Pressable
                  key={s.type}
                  onPress={() => setTracking(s.type)}
                  className="mb-3 active:opacity-70"
                >
                  <View className="flex-row justify-between">
                    <Text className="font-mono text-[9px] text-ink">
                      {s.label}
                    </Text>
                    <Text className="font-mono text-[9px] text-ink">
                      {s.value}
                      {s.unit}
                    </Text>
                  </View>
                  <Bar value={s.value / s.goal} />
                </Pressable>
              ))}
            </Glass>
          </View>

          <View className="gap-3" style={{ flex: 1.25 }}>
            <Glass className="flex-1">
              <Text className="text-center font-mono text-[10px] text-ink">
                This week
              </Text>
              <View className="flex-1 justify-around">
                {WEEK_ROWS.map((row, r) => (
                  <View key={r} className="flex-row justify-center gap-2">
                    {row.map((i) => (
                      <View
                        key={i}
                        className={`h-9 w-9 items-center justify-center rounded-full ${
                          data.week[i] ? "bg-accent/25" : "bg-ink/10"
                        } ${i === data.today ? "border border-accent" : ""}`}
                      >
                        <Ionicons
                          name="star"
                          size={18}
                          color={data.week[i] ? "#DAA464" : dimStar}
                        />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </Glass>

            <Glass className="h-20 justify-center">
              <Text
                className="text-center font-mono text-[10px] leading-4 text-ink"
                numberOfLines={3}
              >
                {data.quote}
              </Text>
            </Glass>
          </View>
        </View>

        <Glass className="mt-3 min-h-[200px] flex-1">
          <Text className="mb-3 text-right font-mono text-xs text-ink">
            Today's macros
          </Text>
          {data.macros.map((m) => (
            <Pressable
              key={m.label}
              onPress={() =>
                setMacroModal({
                  label: m.label,
                  field: MACRO_FIELD[m.label] ?? "calories",
                  unit: m.unit,
                })
              }
              className="mb-3 active:opacity-70"
            >
              <View className="flex-row justify-between">
                <Text className="font-mono text-[10px] text-ink">
                  {m.label}
                </Text>
                <Text className="font-mono text-[10px] text-ink">
                  {m.value} / {m.goal} {m.unit}
                </Text>
              </View>
              <Bar value={m.goal > 0 ? m.value / m.goal : 0} />
            </Pressable>
          ))}
        </Glass>
      </ScrollView>
      <BottomNav />

      <TrackModal
        type={tracking}
        current={tracking ? data.stats[tracking].value : 0}
        goal={tracking ? data.stats[tracking].goal : 1}
        onSave={onSaveStat}
        onClose={() => setTracking(null)}
      />

      {macroModal && (
        <MacroModal
          label={macroModal.label}
          unit={macroModal.unit}
          onSave={onSaveMacro}
          onClose={() => setMacroModal(null)}
        />
      )}
    </Background>
  );
}
