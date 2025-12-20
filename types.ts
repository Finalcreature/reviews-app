export interface Review {
  id: string;
  title: string;
  game_name: string;
  review_text: string;
  rating: number;
  /** Optional genre (e.g., "RPG", "Action") */
  genre?: string;
  positive_points: string[];
  negative_points: string[];
  tags?: string[];
}

export type NewReviewData = Omit<Review, "id">;

export interface GameSummary {
  game_name: string;
  rating: number;
  /** Optional genre from archived review JSON */
  genre?: string;
}

export interface WipReview {
  id: string;
  gameName: string;
  remarks: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}
