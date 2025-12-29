import { describe, test, expect, vi, beforeEach } from "vitest";
import { updateReviewGenre } from "../api";

describe("updateReviewGenre", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("falls back to materialize on 404", async () => {
    const mockPatch = {
      ok: false,
      status: 404,
      text: async () => "Not found",
    } as any;

    const materializeResp = {
      review: { id: "arch1" },
      genre: { id: "g1", name: "n" },
      materialized: "updated",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockPatch)
      .mockResolvedValueOnce({ ok: true, json: async () => materializeResp });

    (global as any).fetch = fetchMock;

    const res = await updateReviewGenre("arch1", { genreName: "X" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res).toEqual(materializeResp);
  });

  test("returns response when patch succeeds", async () => {
    const patchResp = {
      ok: true,
      json: async () => ({
        review: { id: "r1" },
        genre: { id: "g1", name: "n" },
      }),
    } as any;
    const fetchMock = vi.fn().mockResolvedValueOnce(patchResp);
    (global as any).fetch = fetchMock;
    const res = await updateReviewGenre("r1", { genreName: "X" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res).toHaveProperty("review");
  });
});
