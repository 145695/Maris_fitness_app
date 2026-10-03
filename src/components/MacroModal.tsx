import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

type Props = {
  label: string;
  unit: string;
  onSave: (value: number) => void;
  onClose: () => void;
};

export default function MacroModal({ label, unit, onSave, onClose }: Props) {
  const [value, setValue] = useState("");
  const n = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(n) && n > 0;

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/50">
      <Pressable className="absolute inset-0" onPress={onClose} />

      <View className="w-4/5 rounded-2xl bg-ink p-6">
        <Text className="mb-1 text-center font-mono text-[10px] tracking-widest text-accent">
          ADD {label.toUpperCase()}
        </Text>
        <Text className="mb-5 text-center font-mono text-[9px] text-ink/60">
          {unit}
        </Text>

        <TextInput
          className="rounded-xl border border-glass-line/30 bg-glass-line/10 px-4 py-3 font-mono text-center text-base text-paper outline-none"
          placeholder="0"
          placeholderTextColor="rgba(255,237,185,0.4)"
          keyboardType="decimal-pad"
          value={value}
          onChangeText={(t) =>
            setValue(t.replace(",", ".").replace(/[^0-9.]/g, ""))
          }
          autoFocus
        />

        <View className="mt-5 flex-row gap-3">
          <Pressable
            onPress={onClose}
            className="flex-1 items-center rounded-lg border border-glass-line/30 py-2.5 active:opacity-70"
          >
            <Text className="font-mono text-xs text-paper">cancel</Text>
          </Pressable>

          <Pressable
            onPress={() => valid && onSave(n)}
            disabled={!valid}
            className={`flex-1 items-center rounded-lg py-2.5 ${
              valid ? "bg-accent active:opacity-80" : "bg-accent/30"
            }`}
          >
            <Text className="font-mono text-xs font-bold text-black">add</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
