/**
 * [Backend] Updates the tags of a review by its ID.
 * @param id - The ID of the review to update.
 * @param tags - The new tags array.
 * @returns A promise that resolves to the updated review.
 */

import { Review, NewReviewData, GameSummary } from "../types";

const API_BASE_URL = "http://localhost:3001"; // URL of your backend server

export const updateReviewTags = async (
  id: string,
  tags: string[]
): Promise<Review> => {
  const response = await fetch(`${API_BASE_URL}/api/reviews/${id}/tags`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tags }),
  });
  if (!response.ok) {
    throw new Error("Failed to update review tags on server");
  }
  return response.json();
};

/**
 * [Backend] Fetches all reviews from the backend server.
 * @returns A promise that resolves to an array of reviews.
 */
export const getReviews = async (): Promise<Review[]> => {
  const response = await fetch(`${API_BASE_URL}/api/reviews`);
  if (!response.ok) {
    throw new Error("Failed to fetch reviews from server");
  }
  return response.json();
};

/**
 * [Backend] Creates a new review by sending it to the backend server.
 * @param reviewData - The review data, without an ID.
 * @returns A promise that resolves to the newly created review returned by the server.
 */
export const createReview = async (
  reviewData: NewReviewData
): Promise<Review> => {
  const response = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(reviewData),
  });

  if (!response.ok) {
    let errorMessage = "Failed to create review on server.";
    try {
      // Attempt to parse the error response body for a more specific message
      const errorBody = await response.json();
      if (errorBody && errorBody.error) {
        errorMessage = errorBody.error; // Use the specific error message from the backend
      } else if (response.status === 409) {
        errorMessage = "A conflict occurred (e.g., duplicate game name).";
      }
    } catch (e) {
      // If parsing fails, stick with the generic message or log the parsing error
      console.error("Failed to parse error response body:", e);
    }
    // Throw an error with the specific message
    throw new Error(errorMessage);
  }
  return response.json();
};

/**
 * [Backend] Deletes a review by its ID by calling the backend server.
 * @param id - The ID of the review to delete.
 * @returns A promise that resolves to an object indicating success.
 */
export const deleteReviewById = async (
  id: string
): Promise<{ success: boolean }> => {
  const response = await fetch(`${API_BASE_URL}/api/reviews/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete review on server");
  }
  return response.json();
};

export const getRawReviews = async (): Promise<any[]> => {
  const response = await fetch(`${API_BASE_URL}/api/archived-reviews/download`);
  if (!response.ok) {
    throw new Error("Failed to fetch raw reviews from server");
  }
  return response.json();
};

/**
 * [Backend] Fetches game summaries from the backend server.
 * @returns A promise that resolves to an array of game summaries.
 */
export const getGameSummaries = async (
  visibleOnly: boolean = false
): Promise<GameSummary[]> => {
  const response = await fetch(
    `${API_BASE_URL}/api/games-summary?visible=${visibleOnly}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch game summaries from server");
  }
  return response.json();
};

export async function updateArchivedReviewTags(
  id: string,
  tags: string[]
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/archived-reviews/${id}/tags`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update tags");
  }
}

export async function fetchArchivedReviewForGame(
  gameName: string
): Promise<Review | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/archived-reviews/game/${encodeURIComponent(gameName)}`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to fetch archived review");
  }

  const data = await response.json();
  return data as Review;
}

export async function updateArchivedReview(id: string, data: any) {
  const res = await fetch(`${API_BASE_URL}/api/archived-reviews/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Failed to update archived review");

  return res.json();
}

// WIP Reviews API
export interface WipCreateData {
  gameName: string;
  remarks: string;
}

export async function getWipReviews(): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/api/wip-reviews`);
  if (!res.ok) throw new Error("Failed to fetch wip reviews");
  return res.json();
}

export async function createWipReview(data: WipCreateData) {
  const res = await fetch(`${API_BASE_URL}/api/wip-reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create wip review");
  return res.json();
}

export async function updateWipReview(id: string, data: WipCreateData) {
  const res = await fetch(`${API_BASE_URL}/api/wip-reviews/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update wip review");
  return res.json();
}

export async function deleteWipReview(id: string) {
  const res = await fetch(`${API_BASE_URL}/api/wip-reviews/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete wip review");
  return res.json();
}
