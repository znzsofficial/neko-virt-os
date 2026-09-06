import { describe, expect, it } from "vitest";
import type { TranslationKey } from "../languageStore";
import { phrase, pluralize } from "./phrase";

const strings: Record<string, string> = {
  prefix: "共 ",
  countOne: " item",
  countOther: " items",
};

const asKey = (key: string) => key as unknown as TranslationKey;
const t = ((key: string) => strings[key] ?? key) as (key: TranslationKey) => string;

describe("phrase helpers", () => {
  it("pluralize picks the singular form for count 1 and the other form otherwise", () => {
    expect(pluralize(t, 1, asKey("countOne"), asKey("countOther"))).toBe(" item");
    expect(pluralize(t, 0, asKey("countOne"), asKey("countOther"))).toBe(" items");
    expect(pluralize(t, 3, asKey("countOne"), asKey("countOther"))).toBe(" items");
  });

  it("pluralize keeps Chinese strings identical across counts", () => {
    const zhStrings: Record<string, string> = { one: " 项", other: " 项" };
    const zhT = ((key: string) => zhStrings[key] ?? key) as (key: TranslationKey) => string;
    expect(pluralize(zhT, 1, asKey("one"), asKey("other"))).toBe(" 项");
    expect(pluralize(zhT, 5, asKey("one"), asKey("other"))).toBe(" 项");
  });

  it("phrase composes prefix + value + suffix", () => {
    expect(phrase(t, asKey("prefix"), 3, asKey("countOne"))).toBe("共 3 item");
  });
});
