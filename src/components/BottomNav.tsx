import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { Pressable, View } from "react-native";
import Glass from "./Glass";

const TABS = [
  { path: "/home", icon: "star" }, // home
  { path: "/workout", icon: "sparkles" }, // today's workout
  { path: "/stats", icon: "pie-chart" }, // stats
  { path: "/profile", icon: "person" }, // profile
] as const;

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { colorScheme } = useColorScheme();
  const color = colorScheme === "dark" ? "#FFEDB9" : "#161C10";

  return (
    <View className="absolute bottom-6 left-5 right-5">
      <Glass>
        <View className="flex-row items-center justify-around">
          {TABS.map((t) => {
            const active = pathname === t.path;
            return (
              <Pressable
                key={t.path}
                onPress={() => !active && router.replace(t.path as any)}
                hitSlop={10}
              >
                <Ionicons
                  name={(active ? t.icon : `${t.icon}-outline`) as any}
                  size={26}
                  color={active ? "#DAA464" : color}
                />
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}
