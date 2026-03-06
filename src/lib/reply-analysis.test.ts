import { describe, it, expect } from "vitest";
import { classifyReplyText } from "./reply-analysis";

describe("classifyReplyText", () => {
  it("detects ooo replies", () => {
    expect(classifyReplyText("I am out of office until March 15")).toBe("ooo");
    expect(classifyReplyText("Thanks for your email. I'm currently OOO")).toBe("ooo");
    expect(classifyReplyText("Auto-reply: I will be out of the office")).toBe("ooo");
    expect(classifyReplyText("I'm away on vacation until next week")).toBe("ooo");
  });

  it("detects unsubscribe replies", () => {
    expect(classifyReplyText("Please remove me from your list")).toBe("unsubscribe");
    expect(classifyReplyText("Unsubscribe me")).toBe("unsubscribe");
    expect(classifyReplyText("stop emailing me")).toBe("unsubscribe");
    expect(classifyReplyText("Please do not contact me again")).toBe("unsubscribe");
  });

  it("detects wrong person replies", () => {
    expect(classifyReplyText("I'm not the right person for this. Try reaching out to John.")).toBe("wrong_person");
    expect(classifyReplyText("Wrong department. You should contact our CTO")).toBe("wrong_person");
  });

  it("returns null for ambiguous text needing Claude", () => {
    expect(classifyReplyText("Interesting, tell me more about pricing")).toBeNull();
    expect(classifyReplyText("We already have a solution for this")).toBeNull();
    expect(classifyReplyText("Not a good time right now")).toBeNull();
    expect(classifyReplyText("Let's schedule a call next week")).toBeNull();
  });
});
