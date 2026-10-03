import { useRouter } from "expo-router";
import { Text } from "react-native";
import AuthSheet from "../components/AuthSheet";
import Background from "../components/Background";
import { apiFetch } from "../Logic/api";
import { setupNotifications } from "../Logic/notifications";

export default function Login() {
  const router = useRouter();

  const handleSuccess = async () => {
    // Fire-and-forget; don't block navigation on the permission prompt.
    setupNotifications().catch(() => {});

    try {
      const me = await apiFetch("/me");
      if (me.testDone) router.replace("/home");
      else router.replace("/onboarding");
    } catch {
      router.replace("/home");
    }
  };

  return (
    <Background nav={false}>
      <Text className="mt-32 text-big">Welcome{"\n"}back, hero</Text>
      <AuthSheet mode="login" onSuccess={handleSuccess} />
    </Background>
  );
}
