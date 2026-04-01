import { describe, expect, it } from "vitest";
import {
  buildRecentNewsExpansionQueries,
  getSourceDuplicateClusterKey,
} from "./hooks";

describe("buildRecentNewsExpansionQueries", () => {
  it("builds event-specific news expansion queries", () => {
    expect(
      buildRecentNewsExpansionQueries("Federato", "federato.com"),
    ).toEqual([
      "\"Federato\" OR \"federato.com\" funding OR raised OR series OR investment",
      "\"Federato\" OR \"federato.com\" launch OR launched OR product OR feature OR AI",
      "\"Federato\" OR \"federato.com\" hiring OR hires OR appointed OR partnership OR expansion",
    ]);
  });
});

describe("getSourceDuplicateClusterKey", () => {
  it("clusters syndicated funding headlines together", () => {
    const a = getSourceDuplicateClusterKey({
      title: "Federato Raises $100M Series D - Business Wire",
      date: "2026-03-31",
    });
    const b = getSourceDuplicateClusterKey({
      title: "Reuters: Federato raised $100 million Series D",
      date: "2026-03-28",
    });

    expect(a).toBe(b);
  });

  it("keeps different event families in separate clusters", () => {
    const funding = getSourceDuplicateClusterKey({
      title: "Federato Raises $100M Series D",
      date: "2026-03-31",
    });
    const launch = getSourceDuplicateClusterKey({
      title: "Federato launches AI underwriting assistant",
      date: "2026-03-31",
    });

    expect(funding).not.toBe(launch);
  });
});
