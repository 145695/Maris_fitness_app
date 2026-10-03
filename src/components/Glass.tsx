import { BlurView } from "expo-blur";
import { useColorScheme } from "nativewind";
import { View, ViewProps } from "react-native";

export default function Glass({
  children,
  className = "",
  ...rest
}: ViewProps & { className?: string }) {
  const { colorScheme } = useColorScheme();
  return (
    <View className={`overflow-hidden rounded-3xl ${className}`} {...rest}>
      <BlurView
        intensity={30}
        tint={colorScheme === "dark" ? "dark" : "light"}
        className="absolute inset-0"
      />
      <View className="glass flex-1">{children}</View>
    </View>
  );
}
