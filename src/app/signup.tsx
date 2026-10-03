import { useRouter } from "expo-router";
import { Text } from "react-native";
import AuthSheet from "../components/AuthSheet";
import Background from "../components/Background";

export default function Signup() {
  const router = useRouter();
  return (
    <Background nav={false}>
      <Text className="mt-32 text-big">let's Go,{"\n"}hero</Text>
      {/* later this goes to the "activity you enjoy" screen instead of home */}
      <AuthSheet
        mode="signup"
        onSuccess={() => router.replace("/onboarding")}
      />
    </Background>
  );
}
