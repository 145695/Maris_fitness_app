import { SpaceMono_400Regular, useFonts } from "@expo-google-fonts/space-mono";
import { Slot } from "expo-router";
import "../global.css";

export default function Layout() {
  const [loaded] = useFonts({ SpaceMono_400Regular });
  if (!loaded) return null;
  return <Slot />;
}
