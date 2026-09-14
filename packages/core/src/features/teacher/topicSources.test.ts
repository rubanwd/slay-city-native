import { describe, expect, it } from "vitest";

import {
  buildTopicSources,
  describeSource,
  sourcesForKind,
  type TopicSource,
} from "./topicSources";

const groupNames = new Map([
  ["g1", "Group 6"],
  ["g2", "Group 12"],
]);

const topics = [
  { id: "t1", groupId: "g2", title: "Food", orderIndex: 1 },
  { id: "t2", groupId: "g1", title: "Animals", orderIndex: 1 },
  { id: "t3", groupId: "g1", title: "Colours", orderIndex: 0 },
  { id: "t4", groupId: "g1", title: "Empty", orderIndex: 2 },
];

describe("buildTopicSources", () => {
  it("keeps only topics that carry content, counting rows per topic", () => {
    const sources = buildTopicSources({
      topics,
      groupNames,
      vocabWordTopicIds: ["t1", "t1", "t3"],
      grammarPointTopicIds: ["t2"],
    });

    expect(sources.map((s) => s.topicId)).toEqual(["t3", "t2", "t1"]);
    expect(sources.find((s) => s.topicId === "t1")).toMatchObject({
      title: "Food",
      groupName: "Group 12",
      wordCount: 2,
      pointCount: 0,
    });
    expect(sources.find((s) => s.topicId === "t2")).toMatchObject({
      wordCount: 0,
      pointCount: 1,
    });
  });

  it("orders by group name, then by the topic's own order", () => {
    const sources = buildTopicSources({
      topics,
      groupNames,
      vocabWordTopicIds: ["t1", "t2", "t3"],
      grammarPointTopicIds: [],
    });

    expect(sources.map((s) => `${s.groupName}/${s.title}`)).toEqual([
      "Group 6/Colours",
      "Group 6/Animals",
      "Group 12/Food",
    ]);
  });

  it("never offers the topic being edited as a source for itself", () => {
    const sources = buildTopicSources({
      topics,
      groupNames,
      vocabWordTopicIds: ["t1", "t3"],
      grammarPointTopicIds: [],
      excludeTopicId: "t3",
    });

    expect(sources.map((s) => s.topicId)).toEqual(["t1"]);
  });

  it("falls back to a generic group label when the group name is unknown", () => {
    const sources = buildTopicSources({
      topics: [{ id: "t1", groupId: "gone", title: "Food", orderIndex: 0 }],
      groupNames: new Map(),
      vocabWordTopicIds: ["t1"],
      grammarPointTopicIds: [],
    });

    expect(sources[0].groupName).toBe("Group");
  });
});

describe("sourcesForKind", () => {
  const sources: TopicSource[] = [
    { topicId: "t1", title: "Food", groupName: "Group 12", wordCount: 8, pointCount: 0 },
    { topicId: "t2", title: "Past Simple", groupName: "Group 6", wordCount: 0, pointCount: 3 },
    { topicId: "t3", title: "Travel", groupName: "Group 6", wordCount: 4, pointCount: 2 },
  ];

  it("offers vocabulary sources only where words exist", () => {
    expect(sourcesForKind(sources, "vocabulary").map((s) => s.topicId)).toEqual(["t1", "t3"]);
  });

  it("offers grammar sources only where rule points exist", () => {
    expect(sourcesForKind(sources, "grammar").map((s) => s.topicId)).toEqual(["t2", "t3"]);
  });
});

describe("describeSource", () => {
  const source: TopicSource = {
    topicId: "t1",
    title: "Food",
    groupName: "Group 12",
    wordCount: 12,
    pointCount: 1,
  };

  it("labels a vocabulary source with its group and word count", () => {
    expect(describeSource(source, "vocabulary")).toBe("Food — Group 12 · 12 words");
  });

  it("singularises a one-item grammar source", () => {
    expect(describeSource(source, "grammar")).toBe("Food — Group 12 · 1 rule");
  });
});
