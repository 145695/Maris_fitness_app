import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { login, signInWithGoogle, signup } from "../Logic/auth";

type Props = {
  mode: "login" | "signup";
  onSuccess: () => void;
};

const PLACEHOLDER = "rgba(255,237,185,0.75)";

const INPUT =
  "mt-4 rounded-xl border border-glass-line/30 bg-glass-line/15 px-3 py-3 font-mono text-xs text-glass-line outline-none";

function GoogleG() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <Path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <Path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <Path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </Svg>
  );
}

export default function AuthSheet({ mode, onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async (
    action: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setError("");
    setLoading(true);
    const result = await action();
    setLoading(false);
    if (result.ok) onSuccess();
    else setError(result.error ?? "Something went wrong.");
  };

  const submit = () =>
    run(() =>
      mode === "login" ? login(username, password) : signup(username, password),
    );

  return (
    <View className="sheet absolute bottom-0 left-0 right-0 h-[58%]">
      <Text className="mt-2 text-center font-mono text-xs tracking-widest text-accent">
        {mode === "login" ? "LOG IN" : "sign up"}
      </Text>

      <TextInput
        className={INPUT}
        placeholder="user name"
        placeholderTextColor={PLACEHOLDER}
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        className={INPUT}
        placeholder="password"
        placeholderTextColor={PLACEHOLDER}
        secureTextEntry
        autoCapitalize="none"
        returnKeyType="go"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />

      {/* Primary action button — triggers submit() */}
      <Pressable
        onPress={submit}
        disabled={loading}
        className="mt-5 items-center justify-center rounded-lg bg-accent py-3 active:opacity-80"
      >
        <Text className="font-mono text-xs font-bold tracking-widest text-black">
          {mode === "login" ? "LOG IN" : "SIGN UP"}
        </Text>
      </Pressable>

      {/* Divider */}
      <View className="mt-4 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-glass-line/20" />
        <Text className="font-mono text-[10px] tracking-widest text-glass-line/50">
          OR
        </Text>
        <View className="h-px flex-1 bg-glass-line/20" />
      </View>

      <Pressable
        onPress={() => run(signInWithGoogle)}
        disabled={loading}
        className="mt-4 flex-row items-center justify-center gap-2 rounded-lg bg-white py-2.5 active:opacity-80"
      >
        <GoogleG />
        <Text className="text-xs font-medium text-black">
          Sign in with Google
        </Text>
      </Pressable>

      {loading && <ActivityIndicator className="mt-4" color="#DAA464" />}
      {!!error && (
        <Text className="mt-3 text-center font-mono text-[11px] text-accent">
          {error}
        </Text>
      )}
    </View>
  );
}
