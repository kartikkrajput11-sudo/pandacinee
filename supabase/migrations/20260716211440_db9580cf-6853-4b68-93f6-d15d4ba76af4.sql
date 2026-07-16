
ALTER TABLE public.shop_items DROP CONSTRAINT shop_items_category_check;
ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_category_check
  CHECK (category = ANY (ARRAY['chat_theme','site_theme','chat_perk','profile_flair','ai_sticker_pack','chess_board']));

INSERT INTO public.shop_items (item_key, category, name, description, price, metadata, sort_order, active) VALUES
('chess_board_classic_rose', 'chess_board', 'Rose Marble', 'A soft petal-toned board with velvet dark squares.', 300, '{"light":"oklch(0.82 0.04 320)","dark":"oklch(0.42 0.09 310)","accent":"#e879a5","label":"Rose"}'::jsonb, 10, true),
('chess_board_bamboo', 'chess_board', 'Bamboo Grove', 'Warm bamboo greens for a calm forest match.', 350, '{"light":"oklch(0.86 0.05 130)","dark":"oklch(0.38 0.08 145)","accent":"#7cc47a","label":"Bamboo"}'::jsonb, 20, true),
('chess_board_midnight', 'chess_board', 'Midnight Neon', 'Cyberpunk board with electric-blue accents.', 500, '{"light":"oklch(0.72 0.06 260)","dark":"oklch(0.28 0.12 275)","accent":"#7dd3fc","label":"Neon"}'::jsonb, 30, true),
('chess_board_sunset', 'chess_board', 'Sunset Amber', 'Golden hour warmth on every square.', 500, '{"light":"oklch(0.86 0.07 75)","dark":"oklch(0.44 0.12 45)","accent":"#facc15","label":"Sunset"}'::jsonb, 40, true),
('chess_board_ivory_gold', 'chess_board', 'Ivory & Gold', 'Regal ivory board with a gilded glow — for grandmasters only.', 900, '{"light":"oklch(0.94 0.02 90)","dark":"oklch(0.38 0.05 60)","accent":"#facc15","label":"Ivory Gold","premium":true}'::jsonb, 50, true)
ON CONFLICT (item_key) DO NOTHING;
