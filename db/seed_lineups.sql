-- Common grenade lineups for CS2 active duty maps
-- Source: well-known community lineups, cross-referenced with csnades.gg
-- Coordinates left NULL where not precisely known — display uses name/notes only.
-- Run: docker exec -i postgres psql -U cs2user -d cs2 < db/seed_lineups.sql

ALTER TABLE grenade_lineups ADD COLUMN IF NOT EXISTS ref_url TEXT;

INSERT INTO grenade_lineups (map, grenade_type, name, side, difficulty, notes, ref_url) VALUES

-- ═══ de_mirage ═══
('de_mirage','smoke','Window (from T spawn)',   'T',   'easy',   'From T spawn ramp, throw at the corner of the roof — lands window to block CT view of mid.', 'https://csnades.gg/maps/cs2/mirage'),
('de_mirage','smoke','Jungle CT smoke',          'T',   'medium', 'Stand in the T spawn doorway, aim at the left edge of the tall building — smokes off CT aggression to A.', 'https://csnades.gg/maps/cs2/mirage'),
('de_mirage','smoke','Short smoke (B apps)',     'CT',  'easy',   'From CT mid, bounce off the wall to smoke the short corner — stops T aggression on short.', 'https://csnades.gg/maps/cs2/mirage'),
('de_mirage','smoke','Ticket booth smoke',       'T',   'easy',   'From T spawn, jump throw at the top-right corner of the apartments building.', 'https://csnades.gg/maps/cs2/mirage'),
('de_mirage','smoke','Market window (B site)',   'CT',  'medium', 'From B spawn, aim at the corner of the market building roof — blocks market window peekers.', 'https://csnades.gg/maps/cs2/mirage'),
('de_mirage','flash','A main pop flash',         'CT',  'easy',   'Stand inside A ramp, left-click throw over the wall — flashes anyone peeking from A main.', 'https://csnades.gg/maps/cs2/mirage'),
('de_mirage','flash','Short pop flash',          'CT',  'easy',   'From CT, throw over the short wall — flashes anyone holding short from T side.', 'https://csnades.gg/maps/cs2/mirage'),
('de_mirage','molotov','Jungle corner molly',    'CT',  'easy',   'Throw from CT toward the jungle corner to clear the common CT boost spot.', 'https://csnades.gg/maps/cs2/mirage'),
('de_mirage','molotov','B site default plant',   'T',   'medium', 'From B apps, throw to clear the default plant area and CT corner.', 'https://csnades.gg/maps/cs2/mirage'),

-- ═══ de_inferno ═══
('de_inferno','smoke','CT smoke (from T)',        'T',   'medium', 'From T spawn, aim at the corner between the arch and buildings — smokes off CT retake.', 'https://csnades.gg/maps/cs2/inferno'),
('de_inferno','smoke','Banana top CT smoke',      'CT',  'easy',   'From CT spawn, throw to block the top of banana — stops early T aggression.', 'https://csnades.gg/maps/cs2/inferno'),
('de_inferno','smoke','Graveyard smoke',          'T',   'easy',   'From T spawn, aim at the antenna — smokes the graveyard area on B site.', 'https://csnades.gg/maps/cs2/inferno'),
('de_inferno','smoke','Second mid smoke',         'T',   'medium', 'From apartments window, bounce off the wall — blocks second mid and allows safe B entry.', 'https://csnades.gg/maps/cs2/inferno'),
('de_inferno','smoke','Library smoke (A site)',   'CT',  'medium', 'From CT toward library — blocks the common AWP spot and retake lane.', 'https://csnades.gg/maps/cs2/inferno'),
('de_inferno','flash','Banana pop flash',         'T',   'easy',   'From T side banana, throw around the corner — flashes CTs holding banana.', 'https://csnades.gg/maps/cs2/inferno'),
('de_inferno','flash','Apartment window flash',   'T',   'easy',   'From outside apartments, throw through the window — flashes CT inside.', 'https://csnades.gg/maps/cs2/inferno'),
('de_inferno','molotov','Banana corner molly',    'CT',  'easy',   'From CT banana, throw to the bend — forces Ts off the corner.', 'https://csnades.gg/maps/cs2/inferno'),
('de_inferno','molotov','A site entry molly',     'T',   'medium', 'From arch, throw toward CT position — clears the right side of A site.', 'https://csnades.gg/maps/cs2/inferno'),

-- ═══ de_dust2 ═══
('de_dust2','smoke','Long corner smoke',          'T',   'easy',   'From T spawn, aim at the corner of the CT building — smokes long corner for safe long push.', 'https://csnades.gg/maps/cs2/dust2'),
('de_dust2','smoke','Cross smoke (B site)',       'CT',  'easy',   'From CT, throw to smoke the B cross — blocks T short cross aggression.', 'https://csnades.gg/maps/cs2/dust2'),
('de_dust2','smoke','B door smoke',               'T',   'easy',   'From T spawn, aim at the edge of the upper B tunnel wall — smokes B doors.', 'https://csnades.gg/maps/cs2/dust2'),
('de_dust2','smoke','CT cross smoke',             'T',   'medium', 'From upper tunnel, throw to block CT cross — lets team take mid safely.', 'https://csnades.gg/maps/cs2/dust2'),
('de_dust2','smoke','Goose smoke (A site)',       'CT',  'medium', 'From CT, bounce off the wall to smoke the goose corner — helps retake A.', 'https://csnades.gg/maps/cs2/dust2'),
('de_dust2','flash','Long pop flash',             'T',   'easy',   'From long doors, throw over the door — flashes anyone holding pit or long corner.', 'https://csnades.gg/maps/cs2/dust2'),
('de_dust2','flash','B site entry flash',         'T',   'easy',   'From upper B, throw over the barrier — flashes B site for entry.', 'https://csnades.gg/maps/cs2/dust2'),
('de_dust2','molotov','Catwalk corner molly',     'CT',  'easy',   'From mid CT, throw toward catwalk corner — clears common T catwalk hold.', 'https://csnades.gg/maps/cs2/dust2'),

-- ═══ de_nuke ═══
('de_nuke','smoke','Ramp smoke (outside)',        'T',   'medium', 'From T side outside, throw to smoke the ramp entry — blocks CT sight line.', 'https://csnades.gg/maps/cs2/nuke'),
('de_nuke','smoke','Lobby smoke',                 'T',   'easy',   'From T spawn, aim at the crane — smokes lobby door for safe entry.', 'https://csnades.gg/maps/cs2/nuke'),
('de_nuke','smoke','Silo smoke (outside)',        'T',   'medium', 'From T spawn, bounce off the silo corner — blocks CT long sight line outside.', 'https://csnades.gg/maps/cs2/nuke'),
('de_nuke','smoke','Squeaky smoke',               'CT',  'easy',   'From upper site, throw to smoke squeaky door — blocks T rotation.', 'https://csnades.gg/maps/cs2/nuke'),
('de_nuke','flash','Ramp entry flash',            'T',   'easy',   'From outside, throw around ramp corner — flashes CT holding ramp.', 'https://csnades.gg/maps/cs2/nuke'),
('de_nuke','molotov','Ramp corner molly',         'CT',  'easy',   'From CT ramp, throw toward T corner — clears the T-side push position.', 'https://csnades.gg/maps/cs2/nuke'),
('de_nuke','molotov','Outside default molly',     'T',   'medium', 'From outside, throw to the CT corner near yard — clears CT retake setup.', 'https://csnades.gg/maps/cs2/nuke'),

-- ═══ de_anubis ═══
('de_anubis','smoke','Mid palace smoke',          'T',   'easy',   'From T spawn, aim at the corner of mid palace — blocks CT sight line and allows mid control.', 'https://csnades.gg/maps/cs2/anubis'),
('de_anubis','smoke','A site entry smoke',        'T',   'medium', 'From A main, throw to smoke the CT position on A site — enables entry.', 'https://csnades.gg/maps/cs2/anubis'),
('de_anubis','smoke','B site canal smoke',        'T',   'easy',   'From T side, throw to block CT crossing through canal — isolates B site.', 'https://csnades.gg/maps/cs2/anubis'),
('de_anubis','smoke','CT spawn smoke',            'T',   'medium', 'From A main, throw to smoke CT spawn — delays retake on A.', 'https://csnades.gg/maps/cs2/anubis'),
('de_anubis','flash','A main entry flash',        'CT',  'easy',   'From CT A position, throw pop flash toward A main entrance.', 'https://csnades.gg/maps/cs2/anubis'),
('de_anubis','molotov','Mid corner molly',        'CT',  'easy',   'From CT mid, throw to the T-side mid corner — forces Ts off mid control.', 'https://csnades.gg/maps/cs2/anubis'),

-- ═══ de_ancient ═══
('de_ancient','smoke','A site entry smoke',       'T',   'medium', 'From A main, throw to block CT — allows safe A site entry without CT pressure.', 'https://csnades.gg/maps/cs2/ancient'),
('de_ancient','smoke','Mid control smoke',        'both','easy',   'Smokes the center mid pillar — denies mid information and control.', 'https://csnades.gg/maps/cs2/ancient'),
('de_ancient','smoke','B site default smoke',     'T',   'easy',   'From B corridor, throw to block CT retake position on B site.', 'https://csnades.gg/maps/cs2/ancient'),
('de_ancient','smoke','A ramp smoke',             'CT',  'medium', 'From CT toward A ramp — blocks T aggression on A ramp and allows CT setup.', 'https://csnades.gg/maps/cs2/ancient'),
('de_ancient','flash','A site entry flash',       'T',   'easy',   'From A main, throw around the corner — flashes CTs on A site.', 'https://csnades.gg/maps/cs2/ancient'),
('de_ancient','molotov','B corner molly',         'CT',  'easy',   'From B site, throw to the T entry corner — denies default B push.', 'https://csnades.gg/maps/cs2/ancient'),

-- ═══ de_vertigo ═══
('de_vertigo','smoke','A site CT smoke',          'T',   'medium', 'From T side, throw to block CT position on A — essential for A execute.', 'https://csnades.gg/maps/cs2/vertigo'),
('de_vertigo','smoke','Ramp smoke (B site)',      'CT',  'easy',   'From CT, throw to smoke T ramp — stops early B rush.', 'https://csnades.gg/maps/cs2/vertigo'),
('de_vertigo','smoke','Mid scaffold smoke',       'T',   'easy',   'From T spawn, smoke the mid scaffold — blocks CT mid aggression.', 'https://csnades.gg/maps/cs2/vertigo'),
('de_vertigo','flash','B ramp entry flash',       'T',   'easy',   'From T spawn, throw pop flash over the B ramp corner — flashes CT holding ramp.', 'https://csnades.gg/maps/cs2/vertigo'),
('de_vertigo','molotov','A site corner molly',    'CT',  'easy',   'From CT A, throw to the T entry corner — denies planting position.', 'https://csnades.gg/maps/cs2/vertigo'),

-- ═══ de_train ═══
('de_train','smoke','Upper B smoke (ivy)',         'T',   'easy',   'From T spawn, throw toward ivy — smokes off CT sight line into upper B.', 'https://csnades.gg/maps/cs2/train'),
('de_train','smoke','A site CT smoke',             'T',   'medium', 'From upper A, throw to block CT position — enables A site take without CT pressure.', 'https://csnades.gg/maps/cs2/train'),
('de_train','smoke','Lower B smoke',               'T',   'easy',   'From T lower, throw to block CT lower B rotation — slows retake.', 'https://csnades.gg/maps/cs2/train'),
('de_train','flash','Upper B pop flash',           'T',   'easy',   'From upper B, throw over the train — flashes CT holding inside upper B.', 'https://csnades.gg/maps/cs2/train'),
('de_train','molotov','B site default molly',      'CT',  'easy',   'From CT B, throw to the default plant corner — denies easy planting.', 'https://csnades.gg/maps/cs2/train')

ON CONFLICT DO NOTHING;
