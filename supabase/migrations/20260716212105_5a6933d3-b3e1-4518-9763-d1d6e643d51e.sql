
ALTER TABLE public.shop_items DROP CONSTRAINT shop_items_category_check;
ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_category_check
  CHECK (category = ANY (ARRAY['chat_theme','site_theme','chat_perk','profile_flair','ai_sticker_pack','chess_board','chess_pieces']));

INSERT INTO public.shop_items (item_key, category, name, description, price, metadata, sort_order, active) VALUES
('chess_pieces_solid_ink', 'chess_pieces', 'Solid Ink', 'Filled silhouettes for both sides — sharp, modern, high contrast.', 250,
 '{"label":"Ink","glyphs":{"w":{"k":"♚","q":"♛","r":"♜","b":"♝","n":"♞","p":"♟"},"b":{"k":"♚","q":"♛","r":"♜","b":"♝","n":"♞","p":"♟"}}}'::jsonb, 60, true),
('chess_pieces_outline_marble', 'chess_pieces', 'Outline Marble', 'Elegant hollow glyphs carved from moonlit marble.', 250,
 '{"label":"Marble","glyphs":{"w":{"k":"♔","q":"♕","r":"♖","b":"♗","n":"♘","p":"♙"},"b":{"k":"♔","q":"♕","r":"♖","b":"♗","n":"♘","p":"♙"}}}'::jsonb, 70, true),
('chess_pieces_panda_court', 'chess_pieces', 'Panda Court', 'A whimsical set — pandas, blossoms, and bamboo replace the royals.', 600,
 '{"label":"Panda","glyphs":{"w":{"k":"🐼","q":"🌸","r":"🎋","b":"🍡","n":"🐾","p":"🥟"},"b":{"k":"🐼","q":"🌸","r":"🎋","b":"🍡","n":"🐾","p":"🥟"}},"emoji":true}'::jsonb, 80, true),
('chess_pieces_royal_court', 'chess_pieces', 'Royal Court', 'Crown-jewel emoji set fit for a state banquet.', 500,
 '{"label":"Royal","glyphs":{"w":{"k":"👑","q":"💎","r":"🏰","b":"⛪","n":"🐴","p":"⚔️"},"b":{"k":"👑","q":"💎","r":"🏰","b":"⛪","n":"🐴","p":"⚔️"}},"emoji":true}'::jsonb, 90, true)
ON CONFLICT (item_key) DO NOTHING;
