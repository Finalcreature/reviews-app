import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ArchivedReviewPreviewModal } from "../ArchivedReviewPreviewModal";
import { Review } from "../../types";
import * as api from "../../services/api";

const mockReview: Review = {
  id: "ar1",
  title: "Archived Title",
  game_name: "Archived Game",
  review_text: "text",
  rating: 8,
  genre: undefined,
  positive_points: [],
  negative_points: [],
};

vi.mock("../../services/api", () => ({
  getGenres: vi.fn(async () => []),
  updateArchivedReview: vi.fn(async () => ({})),
  materializeArchivedReview: vi.fn(async (id, opts) => ({
    review: { id, genre: opts.genreName || null },
    materialized: "updated",
  })),
}));

describe("ArchivedReviewPreviewModal", () => {
  test("clicking Add on genre typeahead shows category prompt", async () => {
    render(
      <ArchivedReviewPreviewModal
        isOpen={true}
        onClose={() => {}}
        archivedReview={mockReview}
      />
    );

    // enter edit mode
    fireEvent.click(screen.getByText("Edit Review"));

    const input = screen.getByPlaceholderText("Genre (optional)");
    fireEvent.change(input, { target: { value: "NewGenre" } });

    // wait for the Add option and click it
    await waitFor(() =>
      expect(screen.getByText('Add "NewGenre"')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText('Add "NewGenre"'));

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Select or add a category")
      ).toBeInTheDocument()
    );
  });

  test("saving category calls materializeArchivedReview and closes prompt", async () => {
    const { getByText, getByPlaceholderText } = render(
      <ArchivedReviewPreviewModal
        isOpen={true}
        onClose={() => {}}
        archivedReview={mockReview}
        onUpdateReview={vi.fn()}
      />
    );
    fireEvent.click(getByText("Edit Review"));
    const input = getByPlaceholderText("Genre (optional)");
    fireEvent.change(input, { target: { value: "NewGenre" } });
    await waitFor(() =>
      expect(screen.getByText('Add "NewGenre"')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText('Add "NewGenre"'));
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Select or add a category")
      ).toBeInTheDocument()
    );

    fireEvent.change(screen.getByPlaceholderText("Select or add a category"), {
      target: { value: "TestCat" },
    });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(api.materializeArchivedReview).toHaveBeenCalled()
    );
    // Should persist merged archived review (preserve game_name and include genre/category)
    await waitFor(() =>
      expect(api.updateArchivedReview).toHaveBeenCalledWith(
        mockReview.id,
        expect.objectContaining({
          game_name: mockReview.game_name,
          genre: "NewGenre",
          categoryName: "TestCat",
        })
      )
    );
    // prompt should be closed
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("Select or add a category")
      ).not.toBeInTheDocument()
    );
  });
});
