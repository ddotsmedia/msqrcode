// Shapes returned by the live API (only the fields the app uses).
export type Choice = { name: string; price_adjustment?: number };
export type OptionSet = { id: string; name: string; options?: { choices?: Choice[] } | null };
export type ProductFull = {
  id: string;
  name: string;
  description: string;
  category_id: string;
  base_price: number | string;
  image_url: string | null;
  status: string;
  variants?: OptionSet[];
  option_groups?: OptionSet[];
};
