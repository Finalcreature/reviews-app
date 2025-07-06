export interface Review {
  id: string;
  title: string;
  game_name: string;
  review_text: string;
  rating: number;
  positive_points: string[];
  negative_points: string[];
  tags?: string[];
  raw_text: string;
}

export type NewReviewData = Omit<Review, "id">;
