import { describe, expect, it } from "vitest";
import { compareTwoWay, gradeExtreme } from "./grading-logic";

describe("compareTwoWay", () => {
  it("a wins when a > b (moneyline home win / player A outscores B / over hits)", () => {
    expect(compareTwoWay(120, 100)).toEqual({ a: "win", b: "loss" });
  });

  it("b wins when b > a", () => {
    expect(compareTwoWay(100, 120)).toEqual({ a: "loss", b: "win" });
  });

  it("pushes both on an exact tie", () => {
    expect(compareTwoWay(110, 110)).toEqual({ a: "push", b: "push" });
  });

  it("works for an over/under framing (total vs line)", () => {
    // total=71, line=70.5 -> over hits
    expect(compareTwoWay(71, 70.5)).toEqual({ a: "win", b: "loss" });
    // total=70, line=70.5 -> under hits
    expect(compareTwoWay(70, 70.5)).toEqual({ a: "loss", b: "win" });
  });
});

describe("gradeExtreme", () => {
  function scores(values: number[]): Map<number, number> {
    return new Map(values.map((v, i) => [i + 1, v]));
  }

  it("the single highest scorer wins, everyone else loses", () => {
    const result = gradeExtreme(scores([100, 150, 90]), [1, 2, 3], "highest");
    expect(result.get(1)).toBe("loss");
    expect(result.get(2)).toBe("win");
    expect(result.get(3)).toBe("loss");
  });

  it("the single lowest scorer wins a lowest-scorer market", () => {
    const result = gradeExtreme(scores([100, 150, 90]), [1, 2, 3], "lowest");
    expect(result.get(1)).toBe("loss");
    expect(result.get(2)).toBe("loss");
    expect(result.get(3)).toBe("win");
  });

  it("voids every selection on an exact tie for highest, not just the tied teams", () => {
    const result = gradeExtreme(scores([150, 150, 90]), [1, 2, 3], "highest");
    expect(result.get(1)).toBe("void");
    expect(result.get(2)).toBe("void");
    expect(result.get(3)).toBe("void");
  });

  it("voids every selection on an exact tie for lowest", () => {
    const result = gradeExtreme(scores([100, 80, 80]), [1, 2, 3], "lowest");
    expect(result.get(1)).toBe("void");
    expect(result.get(2)).toBe("void");
    expect(result.get(3)).toBe("void");
  });

  it("a three-way tie for the extreme still voids everyone, not just two", () => {
    const result = gradeExtreme(scores([120, 120, 120, 90]), [1, 2, 3, 4], "highest");
    expect(result.get(1)).toBe("void");
    expect(result.get(2)).toBe("void");
    expect(result.get(3)).toBe("void");
    expect(result.get(4)).toBe("void");
  });

  it("marks every team pending if no scores are known yet", () => {
    const result = gradeExtreme(new Map(), [1, 2, 3], "highest");
    expect(result.get(1)).toBe("pending");
    expect(result.get(2)).toBe("pending");
    expect(result.get(3)).toBe("pending");
  });
});
