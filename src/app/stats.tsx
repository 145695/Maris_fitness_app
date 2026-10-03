import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Background from "../components/Background";
import BarChart from "../components/BarChart";
import BottomNav from "../components/BottomNav";
import Glass from "../components/Glass";
import { getMonthStats, MONTHS } from "../Logic/stats";

type Stats = Awaited<ReturnType<typeof getMonthStats>>;

export default function Stats() {
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#FFEDB9" : "#161C10";

  const today = new Date();
  const [ym, setYm] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [data, setData] = useState<Stats | null>(null);

  // reload when the page is shown or the month changes
  useFocusEffect(
    useCallback(() => {
      getMonthStats(ym.year, ym.month).then(setData);
    }, [ym]),
  );

  const isCurrentMonth =
    ym.year === today.getFullYear() && ym.month === today.getMonth();

  const shift = (delta: number) => {
    const d = new Date(ym.year, ym.month + delta, 1);
    setData(null);
    setYm({ year: d.getFullYear(), month: d.getMonth() });
  };

  const header = (
    <View className="flex-row justify-between">
      <Text className="text-big">monthly{"\n"}recap</Text>
      <View className="items-end">
        <Text className="text-right font-mono text-xs text-ink">
          {MONTHS[ym.month]}
          {"\n"}
          {ym.year}
        </Text>
        <View className="mt-2 flex-row gap-4">
          <Pressable onPress={() => shift(-1)} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={iconColor} />
          </Pressable>
          <Pressable
            onPress={() => shift(1)}
            disabled={isCurrentMonth}
            hitSlop={10}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={iconColor}
              style={{ opacity: isCurrentMonth ? 0.25 : 1 }}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (!data) {
    return (
      <Background>
        {header}
        <BottomNav />
      </Background>
    );
  }

  const { days, weeks, totals } = data;

  // Sleep chart range. Sleep values are usually 0-12h; keep the range
  // tight enough that small changes are visible.
  const sleeps = weeks
    .map((w) => w.sleepHours)
    .filter((h): h is number => h !== null);
  const sMin = sleeps.length ? Math.max(0, Math.min(...sleeps) - 1) : 0;
  const sMax = sleeps.length ? Math.max(...sleeps) + 1 : 10;

  const maxMinutes = Math.max(60, ...weeks.map((w) => w.minutes ?? 0));
  const hours = Math.floor(totals.minutes / 60);
  const mins = totals.minutes % 60;

  return (
    <Background>
      {header}

      <ScrollView
        className="mt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
      >
        {/* month stat: daily workout progress */}
        <Glass>
          <Text className="mb-1 text-center font-mono text-xs text-ink">
            month stat
          </Text>
          <Text className="mb-4 text-center font-mono text-[9px] text-ink">
            workout completed each day (%)
          </Text>
          <BarChart
            height={150}
            max={100}
            highlight={isCurrentMonth ? today.getDate() - 1 : undefined}
            data={days.map((d) => ({
              value: d.percent,
              label: d.day === 1 || d.day % 5 === 0 ? String(d.day) : "",
            }))}
          />
        </Glass>

        {/* weight + time */}
        <View className="mt-3 flex-row gap-3">
          <Glass className="flex-1">
            <Text className="font-mono text-[10px] text-ink">sleep</Text>
            <Text className="mb-3 mt-1 font-mono text-sm text-accent">
              {totals.avgSleepHours !== null
                ? `${totals.avgSleepHours} h`
                : "-"}
              <Text className="text-[9px] text-ink">{"  "}avg / night</Text>
            </Text>
            <BarChart
              height={80}
              min={sMin}
              max={sMax}
              data={weeks.map((w) => ({
                value: w.sleepHours,
                label: w.label,
              }))}
            />
          </Glass>

          <Glass className="flex-1">
            <Text className="font-mono text-[10px] text-ink">time</Text>
            <Text className="mb-3 mt-1 font-mono text-sm text-accent">
              {hours}h {mins}m
            </Text>
            <BarChart
              height={80}
              max={maxMinutes}
              data={weeks.map((w) => ({ value: w.minutes, label: w.label }))}
            />
          </Glass>
        </View>

        {/* summary */}
        <Glass className="mt-3">
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="font-mono text-lg text-accent">
                {totals.workoutsDone}/{totals.workoutsPlanned}
              </Text>
              <Text className="font-mono text-[9px] text-ink">
                workouts done
              </Text>
            </View>
            <View className="items-center">
              <Text className="font-mono text-lg text-accent">
                {totals.avgPercent}%
              </Text>
              <Text className="font-mono text-[9px] text-ink">
                avg completion
              </Text>
            </View>
          </View>
        </Glass>
      </ScrollView>

      <BottomNav />
    </Background>
  );
}
