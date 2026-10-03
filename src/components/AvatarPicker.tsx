import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import StarAvatar, { Avatar, COLORS, SHAPES } from "./StarAvatar";

type Props = {
  visible: boolean;
  current: Avatar;
  onSave: (avatar: Avatar) => void;
  onClose: () => void;
};

// options sit on a cream tile so every star color stays visible in both themes
const TILE = "rgba(255,237,185,0.9)";
const CREAM = "#FFEDB9";

export default function AvatarPicker({
  visible,
  current,
  onSave,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<Avatar>(current);

  // every time it opens, start from the saved avatar
  useEffect(() => {
    if (visible) setDraft(current);
  }, [visible, current]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* dark area: tap it to cancel */}
      <Pressable className="flex-1 bg-black/50" onPress={onClose} />

      <View className="sheet pb-10">
        <Text className="text-center font-mono text-xs tracking-widest text-accent">
          choose your star
        </Text>

        {/* live preview */}
        <View className="my-5 items-center">
          <View
            className="h-28 w-28 items-center justify-center rounded-full"
            style={{ backgroundColor: TILE }}
          >
            <StarAvatar shape={draft.shape} color={draft.color} size={88} />
          </View>
        </View>

        {/* shapes */}
        <Text
          className="mb-2 text-center font-mono text-[10px]"
          style={{ color: CREAM }}
        >
          shape
        </Text>
        <View className="flex-row justify-around">
          {SHAPES.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setDraft({ ...draft, shape: s.id })}
              className={`rounded-2xl border-2 p-1 ${
                draft.shape === s.id ? "border-accent" : "border-transparent"
              }`}
              style={{ backgroundColor: TILE }}
            >
              <StarAvatar shape={s.id} color={draft.color} size={40} />
            </Pressable>
          ))}
        </View>

        {/* colors */}
        <Text
          className="mb-2 mt-5 text-center font-mono text-[10px]"
          style={{ color: CREAM }}
        >
          color
        </Text>
        <View className="flex-row justify-around">
          {COLORS.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setDraft({ ...draft, color: c.id })}
              className={`h-9 w-9 rounded-full border-2 ${
                draft.color === c.id ? "border-accent" : ""
              }`}
              style={{
                backgroundColor: c.fill,
                borderColor:
                  draft.color === c.id ? undefined : "rgba(255,237,185,0.5)",
              }}
            />
          ))}
        </View>

        {/* buttons */}
        <View className="mt-8 flex-row justify-center gap-4">
          <Pressable
            onPress={onClose}
            className="rounded-full border px-8 py-3 active:opacity-70"
            style={{ borderColor: "rgba(255,237,185,0.5)" }}
          >
            <Text
              className="font-mono text-xs tracking-widest"
              style={{ color: CREAM }}
            >
              cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onSave(draft)}
            className="rounded-full bg-accent px-8 py-3 active:opacity-80"
          >
            <Text className="font-mono text-xs tracking-widest text-[#161C10]">
              save
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
