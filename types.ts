export interface Review {
  id: string;
  title: string;
  game_name: string;
  review_text: string;
  rating: number;
  positive_points: string[];
  negative_points: string[];
  tags?: string[];
  name: string;
}

export type NewReviewData = Omit<Review, "id">;
