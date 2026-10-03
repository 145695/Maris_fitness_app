import { useRouter } from "expo-router";
import { Text } from "react-native";
import AuthSheet from "../components/AuthSheet";
import Background from "../components/Background";

export default function Login() {
  const router = useRouter();
  return (
    <Background nav={false}>
      <Text className="mt-32 text-big">Welcome{"\n"}back, hero</Text>
      <AuthSheet mode="login" onSuccess={() => router.replace("/home")} />
    </Background>
  );
}
