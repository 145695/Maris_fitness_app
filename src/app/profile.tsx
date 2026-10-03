import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AvatarPicker from "../components/AvatarPicker";
import Background from "../components/Background";
import BottomNav from "../components/BottomNav";
import StarAvatar, { Avatar } from "../components/StarAvatar";
import { getAccount, logout, saveAvatar } from "../Logic/account";

type Account = { name: string; avatar: Avatar };

export default function Profile() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [picking, setPicking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getAccount().then((a) => setAccount(a as Account));
    }, []),
  );

  if (!account) {
    return (
      <Background position="left">
        <BottomNav />
      </Background>
    );
  }

  const onSave = async (avatar: Avatar) => {
    setAccount({ ...account, avatar });
    setPicking(false);
    await saveAvatar(avatar);
  };

  const onLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <Background position="left">
      {/* avatar + name */}
      <View className="items-center">
        <Pressable
          onPress={() => setPicking(true)}
          className="active:opacity-80"
        >
          <View className="h-32 w-32 items-center justify-center rounded-full border border-glass-line/50 bg-glass/30">
            <StarAvatar
              shape={account.avatar.shape}
              color={account.avatar.color}
              size={96}
            />
          </View>
          {/* little pencil badge so it's clear the image is tappable */}
          <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full bg-accent">
            <Ionicons name="pencil" size={16} color="#161C10" />
          </View>
        </Pressable>
        <Text className="mt-3 text-big">{account.name}</Text>
      </View>

      <View className="flex-1" />

      <Pressable
        onPress={onLogout}
        className="self-center rounded-full border border-glass-line/50 bg-glass/30 px-8 py-3 active:opacity-70"
      >
        <Text className="font-mono text-xs tracking-widest text-accent">
          log out
        </Text>
      </Pressable>

      <BottomNav />

      <AvatarPicker
        visible={picking}
        current={account.avatar}
        onSave={onSave}
        onClose={() => setPicking(false)}
      />
    </Background>
  );
}
