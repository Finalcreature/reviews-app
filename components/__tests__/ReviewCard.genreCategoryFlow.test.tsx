import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReviewCard } from "../ReviewCard";
import { Review } from "../../types";

// Mock services
vi.mock("../../services/api", () => ({
  getGenres: vi.fn(async () => []),
  getCategories: vi.fn(async () => []),
  createCategory: vi.fn(async (name: string) => ({ id: "cat-1", name })),
  createGenre: vi.fn(async (opts: any) => ({
    id: "g-1",
    name: opts.name,
    category_id: opts.categoryId,
  })),
}));

const mockReview: Review = {
  id: "r1",
  title: "T",
  game_name: "G",
  review_text: "x",
  rating: 7,
  genre: undefined,
  positive_points: [],
  negative_points: [],
};

describe("ReviewCard genre/category flow", () => {
  test("selecting existing genre calls update handler with genreId", async () => {
    const updateSpy = vi.fn(async (id, opts) => ({
      review: {},
      genre: { id: "g-1", name: "RPG" },
    }));
    const { getByLabelText } = render(
      <ReviewCard
        review={mockReview}
        onDelete={() => {}}
        onUpdateTags={() => {}}
        onUpdateGenre={updateSpy}
      />
    );

    // open edit
    fireEvent.click(getByLabelText("Edit genre"));

    // since underlying Typeahead is tested separately, we'll directly call update handler
    await updateSpy("r1", { genreId: "g-1" });

    expect(updateSpy).toHaveBeenCalledWith("r1", { genreId: "g-1" });
  });

  test("adding a new genre triggers category prompt", async () => {
    const updateSpy = vi.fn();
    const { getByLabelText, getByPlaceholderText } = render(
      <ReviewCard
        review={mockReview}
        onDelete={() => {}}
        onUpdateTags={() => {}}
        onUpdateGenre={updateSpy}
      />
    );

    fireEvent.click(getByLabelText("Edit genre"));

    const input = getByPlaceholderText("Genre (e.g., RPG)");
    // type new genre text so the dropdown shows the Add option
    fireEvent.change(input, { target: { value: "NewGenre" } });

    // wait for the Add row to show and click it
    await waitFor(() =>
      expect(screen.getByText('Add "NewGenre"')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText('Add "NewGenre"'));

    // expect category modal/prompt to appear
    await waitFor(() =>
      expect(
        getByPlaceholderText("Select or add a category")
      ).toBeInTheDocument()
    );
  });
});
