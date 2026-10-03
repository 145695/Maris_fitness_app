import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Background from "../components/Background";

export default function Welcome() {
  const router = useRouter();

  return (
    <Background nav={false}>
      <Text className="mt-16 text-big">HI,{"\n"}hero</Text>

      {/* pushes the button to the bottom */}
      <View className="flex-1" />

      <Pressable
        onPress={() => router.push("/signup")}
        className="items-center rounded-3xl bg-surface py-5 active:opacity-80"
      >
        <Text className="font-mono text-base tracking-widest text-accent">
          let's start
        </Text>
      </Pressable>

      <View className="mt-2 flex-row justify-center">
        <Text className="font-mono text-[10px] tracking-widest text-[#FFEDB9]">
          already using Maris ?{" "}
        </Text>
        <Pressable onPress={() => router.push("/login")}>
          <Text className="font-mono text-[10px] font-bold text-black">
            Log in
          </Text>
        </Pressable>
      </View>
    </Background>
  );
}
