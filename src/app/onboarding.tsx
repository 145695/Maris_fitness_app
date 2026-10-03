import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Background from "../components/Background";
import Blob, { BlobShape } from "../components/Blob";
import ProgressDots from "../components/ProgressDots";
import { GOALS } from "../constants/goals";
import { saveProfile } from "../Logic/profile";

type Option = { value: string; label: string };
type Field =
  | {
      key: string;
      label: string;
      type: "number";
      placeholder: string;
      min: number;
      max: number;
      integer?: boolean;
    }
  | { key: string; label: string; type: "single" | "multi"; options: Option[] };

const opts = (...labels: string[]): Option[] =>
  labels.map((l) => ({ value: l.toLowerCase(), label: l }));

const LEVELS = opts("Low", "Moderate", "High");

const STEPS: Field[][] = [
  [
    {
      key: "weight",
      label: "weight (kg)",
      type: "number",
      placeholder: "ex : 80",
      min: 20,
      max: 300,
    },
    {
      key: "height",
      label: "height (cm)",
      type: "number",
      placeholder: "ex : 175",
      min: 100,
      max: 250,
    },
    {
      key: "age",
      label: "age",
      type: "number",
      placeholder: "ex : 25",
      min: 13,
      max: 100,
      integer: true,
    },
    {
      key: "gender",
      label: "gender",
      type: "single",
      options: opts("Male", "Female"),
    },
  ],
  [
    {
      key: "job",
      label: "job type",
      type: "single",
      options: opts("Sedentary", "Light Movement", "Active", "Heavy Physical"),
    },
    {
      key: "activities",
      label: "activity you enjoy",
      type: "multi",
      options: opts("Indoor", "Outdoor", "Gaming"),
    },
    {
      key: "availability",
      label: "availability per day (hours)",
      type: "number",
      placeholder: "ex : 2",
      min: 0.5,
      max: 8,
    },
  ],
  [
    {
      key: "weightTraining",
      label: "weight training level",
      type: "single",
      options: LEVELS,
    },
    { key: "cardio", label: "cardio history", type: "single", options: LEVELS },
  ],
  [
    {
      key: "healthIssues",
      label: "number of health issues",
      type: "number",
      placeholder: "ex : 0",
      min: 0,
      max: 20,
      integer: true,
    },
  ],
  [
    {
      key: "goal",
      label: "your goal",
      type: "single",
      options: GOALS.map((g) => ({ value: g.id, label: g.text })),
    },
  ],
];

const SHAPES: BlobShape[] = ["a", "b", "c"];

type Answers = Record<string, string | string[]>;

function getError(f: Field, v: string | string[] | undefined): string | null {
  if (f.type !== "number") return null;
  const raw = ((v as string) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (isNaN(n)) return "enter a number";
  if (f.integer && !Number.isInteger(n)) return "whole numbers only";
  if (n < f.min || n > f.max) return `must be between ${f.min} and ${f.max}`;
  return null;
}

function isValid(f: Field, v: string | string[] | undefined) {
  if (f.type === "number")
    return ((v as string) ?? "").trim() !== "" && getError(f, v) === null;
  if (f.type === "multi") return Array.isArray(v) && v.length > 0;
  return !!v;
}

export default function Onboarding() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const placeholderColor =
    colorScheme === "dark" ? "rgba(255,237,185,0.6)" : "rgba(22,28,16,0.55)";

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const fields = STEPS[step];
  const last = step === STEPS.length - 1;
  const valid = fields.every((f) => isValid(f, answers[f.key]));

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const setValue = (key: string, value: string | string[]) =>
    setAnswers((a) => ({ ...a, [key]: value }));

  const toggle = (key: string, value: string) => {
    const current = (answers[key] as string[]) ?? [];
    setValue(
      key,
      current.includes(value)
        ? current.filter((x) => x !== value)
        : [...current, value],
    );
  };

  const next = async () => {
    if (!valid || saving) return;
    if (!last) return setStep(step + 1);

    setError("");
    setSaving(true);
    console.log("[onboarding] submitting", answers);
    const result = await saveProfile(answers);
    setSaving(false);

    if (result.ok) {
      console.log("[onboarding] success, navigating to /home");
      router.replace("/home");
    } else {
      console.log("[onboarding] error:", result.error);
      setError(result.error ?? "Something went wrong. Try again.");
    }
  };

  return (
    <Background nav={false} star={false}>
      <ProgressDots total={STEPS.length} current={step} />

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 16 }}
      >
        {fields.map((f) => (
          <View key={f.key} className="mb-6">
            <Text className="mb-4 text-center font-mono text-base tracking-widest text-ink">
              {f.label}
            </Text>

            {f.type === "number" ? (
              <>
                <Blob shape="a">
                  <TextInput
                    className="w-full font-mono text-xs text-ink outline-none"
                    placeholder={f.placeholder}
                    placeholderTextColor={placeholderColor}
                    keyboardType="decimal-pad"
                    value={(answers[f.key] as string) ?? ""}
                    onChangeText={(t) =>
                      setValue(
                        f.key,
                        t.replace(",", ".").replace(/[^0-9.]/g, ""),
                      )
                    }
                  />
                </Blob>
                {getError(f, answers[f.key]) && (
                  <Text className="mt-1 text-center font-mono text-[11px] text-accent">
                    {getError(f, answers[f.key])}
                  </Text>
                )}
              </>
            ) : (
              f.options.map((o, i) => {
                const selected =
                  f.type === "multi"
                    ? ((answers[f.key] as string[]) ?? []).includes(o.value)
                    : answers[f.key] === o.value;
                return (
                  <View key={o.value} className="mb-3">
                    <Blob
                      shape={SHAPES[i % 3]}
                      align={i % 3 === 1 ? "right" : "left"}
                      selected={selected}
                      onPress={() =>
                        f.type === "multi"
                          ? toggle(f.key, o.value)
                          : setValue(f.key, o.value)
                      }
                    >
                      <Text
                        className={`font-mono text-xs ${
                          selected ? "text-[#161C10]" : "text-ink"
                        }`}
                      >
                        {o.label}
                      </Text>
                    </Blob>
                  </View>
                );
              })
            )}
          </View>
        ))}
      </ScrollView>

      {!!error && (
        <Text className="mb-2 text-center font-mono text-[11px] text-accent">
          {error}
        </Text>
      )}

      {step > 0 && (
        <Pressable
          onPress={() => setStep(step - 1)}
          className="mb-2 self-start px-2 py-1"
        >
          <Text className="font-mono text-xs tracking-widest text-ink">
            ← back
          </Text>
        </Pressable>
      )}
      <Blob
        shape="cta"
        align="center"
        disabled={!valid || saving}
        onPress={next}
      >
        <Text className="font-mono text-base tracking-widest text-ink">
          {saving ? "..." : last ? "finish" : "continue"}
        </Text>
      </Blob>
    </Background>
  );
}
