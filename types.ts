export interface Review {
  id: string;
  title: string;
  game_name: string;
  review_text: string;
  rating: number;
  positive_points: string[];
  negative_points: string[];
  tags?: string[];
}

export type NewReviewData = Omit<Review, "id">;

export interface GameSummary {
  game_name: string;
  rating: number;
}

export interface WipReview {
  id: string;
  gameName: string;
  remarks: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}
