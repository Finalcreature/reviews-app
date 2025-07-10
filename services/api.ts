/**
 * [Backend] Updates the tags of a review by its ID.
 * @param id - The ID of the review to update.
 * @param tags - The new tags array.
 * @returns A promise that resolves to the updated review.
 */

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
// The updated services/api.ts file
import { Review, NewReviewData } from "../types";

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
    throw new Error("Failed to create review on server");
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
  const response = await fetch(`${API_BASE_URL}/api/raw-reviews/download`);
  if (!response.ok) {
    throw new Error("Failed to fetch raw reviews from server");
  }
  return response.json();
};
