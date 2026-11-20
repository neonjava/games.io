// Ingredients (the palette) and every craftable item with its recipe.

export const INGREDIENTS = [
  ['planks', 'Oak Planks'], ['cobblestone', 'Cobblestone'], ['stone', 'Stone'], ['glass', 'Glass'], ['wool', 'White Wool'], ['stick', 'Stick'],
  ['log', 'Oak Log'], ['slab', 'Oak Slab'], ['coal', 'Coal'], ['diamond', 'Diamond'], ['gold_ingot', 'Gold Ingot'], ['iron_ingot', 'Iron Ingot'],
  ['redstone', 'Redstone Dust'], ['quartz', 'Nether Quartz'], ['copper_ingot', 'Copper Ingot'], ['lapis', 'Lapis Lazuli'], ['emerald', 'Emerald'], ['amethyst', 'Amethyst Shard'],
  ['string', 'String'], ['leather', 'Leather'], ['flint', 'Flint'], ['feather', 'Feather'], ['sugar_cane', 'Sugar Cane'], ['paper', 'Paper'],
  ['book', 'Book'], ['wheat', 'Wheat'], ['slime_ball', 'Slimeball'], ['gunpowder', 'Gunpowder'], ['sand', 'Sand'], ['obsidian', 'Obsidian'],
  ['brick', 'Brick'], ['honeycomb', 'Honeycomb'], ['iron_nugget', 'Iron Nugget'], ['gold_nugget', 'Gold Nugget'], ['torch', 'Torch'], ['redstone_torch', 'Redstone Torch'],
];

export const RECIPES = [];

// shaped: rows use letters from key, '.' is an empty slot
function S(id, name, cat, n, rows, key) {
  const w0 = Math.max(...rows.map((r) => r.length));
  let cells = rows.map((r) => Array.from(r.padEnd(w0, '.'), (ch) => (ch === '.' ? null : key[ch])));
  // crop empty columns so the pattern is its true size
  const cols = [];
  for (let x = 0; x < w0; x++) if (cells.some((row) => row[x])) cols.push(x);
  cells = cells.map((row) => row.slice(cols[0], cols[cols.length - 1] + 1));
  RECIPES.push({ id, name, cat, n, shaped: true, w: cells[0].length, h: cells.length, cells });
}
// shapeless: just a list of ingredients
function L(id, name, cat, n, list) {
  RECIPES.push({ id, name, cat, n, shaped: false, list });
}

// ---- wood and utility blocks ----
L('planks', 'Oak Planks', 'Building', 4, ['log']);
S('stick', 'Stick', 'Misc', 4, ['P', 'P'], { P: 'planks' });
S('crafting_table', 'Crafting Table', 'Utility', 1, ['PP', 'PP'], { P: 'planks' });
S('chest', 'Chest', 'Utility', 1, ['PPP', 'P.P', 'PPP'], { P: 'planks' });
S('barrel', 'Barrel', 'Utility', 1, ['PSP', 'P.P', 'PSP'], { P: 'planks', S: 'slab' });
S('furnace', 'Furnace', 'Utility', 1, ['CCC', 'C.C', 'CCC'], { C: 'cobblestone' });
S('smithing_table', 'Smithing Table', 'Utility', 1, ['II', 'PP', 'PP'], { I: 'iron_ingot', P: 'planks' });
S('fletching_table', 'Fletching Table', 'Utility', 1, ['FF', 'PP', 'PP'], { F: 'flint', P: 'planks' });
S('cartography_table', 'Cartography Table', 'Utility', 1, ['AA', 'PP', 'PP'], { A: 'paper', P: 'planks' });
S('loom', 'Loom', 'Utility', 1, ['TT', 'PP'], { T: 'string', P: 'planks' });
S('stonecutter', 'Stonecutter', 'Utility', 1, ['.I.', 'SSS'], { I: 'iron_ingot', S: 'stone' });
S('lectern', 'Lectern', 'Utility', 1, ['SSS', '.B.', '.S.'], { S: 'slab', B: 'book' });
S('composter', 'Composter', 'Utility', 1, ['S.S', 'S.S', 'SSS'], { S: 'slab' });
S('campfire', 'Campfire', 'Utility', 1, ['.S.', 'SCS', 'LLL'], { S: 'stick', C: 'coal', L: 'log' });
S('cauldron', 'Cauldron', 'Utility', 1, ['I.I', 'I.I', 'III'], { I: 'iron_ingot' });
S('enchanting_table', 'Enchanting Table', 'Utility', 1, ['.B.', 'DOD', 'OOO'], { B: 'book', D: 'diamond', O: 'obsidian' });
S('bookshelf', 'Bookshelf', 'Decoration', 1, ['PPP', 'BBB', 'PPP'], { P: 'planks', B: 'book' });
S('beehive', 'Beehive', 'Utility', 1, ['PPP', 'HHH', 'PPP'], { P: 'planks', H: 'honeycomb' });
S('jukebox', 'Jukebox', 'Redstone', 1, ['PPP', 'PDP', 'PPP'], { P: 'planks', D: 'diamond' });
S('note_block', 'Note Block', 'Redstone', 1, ['PPP', 'PRP', 'PPP'], { P: 'planks', R: 'redstone' });

// ---- wooden building pieces ----
S('oak_slab', 'Oak Slab', 'Building', 6, ['PPP'], { P: 'planks' });
S('oak_stairs', 'Oak Stairs', 'Building', 4, ['P..', 'PP.', 'PPP'], { P: 'planks' });
S('oak_door', 'Oak Door', 'Building', 3, ['PP', 'PP', 'PP'], { P: 'planks' });
S('oak_trapdoor', 'Oak Trapdoor', 'Building', 2, ['PPP', 'PPP'], { P: 'planks' });
S('oak_fence', 'Oak Fence', 'Building', 3, ['PSP', 'PSP'], { P: 'planks', S: 'stick' });
S('oak_fence_gate', 'Oak Fence Gate', 'Building', 1, ['SPS', 'SPS'], { P: 'planks', S: 'stick' });
S('oak_sign', 'Oak Sign', 'Decoration', 3, ['PPP', 'PPP', '.S.'], { P: 'planks', S: 'stick' });
S('ladder', 'Ladder', 'Building', 3, ['S.S', 'SSS', 'S.S'], { S: 'stick' });
S('oak_button', 'Oak Button', 'Redstone', 1, ['P'], { P: 'planks' });
S('oak_pressure_plate', 'Oak Pressure Plate', 'Redstone', 1, ['PP'], { P: 'planks' });
S('bowl', 'Bowl', 'Misc', 4, ['P.P', '.P.'], { P: 'planks' });
S('boat', 'Oak Boat', 'Transport', 1, ['P.P', 'PPP'], { P: 'planks' });
S('bed', 'Bed', 'Decoration', 1, ['WWW', 'PPP'], { W: 'wool', P: 'planks' });
S('painting', 'Painting', 'Decoration', 1, ['SSS', 'SWS', 'SSS'], { S: 'stick', W: 'wool' });
S('item_frame', 'Item Frame', 'Decoration', 1, ['SSS', 'SLS', 'SSS'], { S: 'stick', L: 'leather' });
S('white_carpet', 'White Carpet', 'Decoration', 3, ['WW'], { W: 'wool' });
S('candle', 'Candle', 'Decoration', 1, ['T', 'H'], { T: 'string', H: 'honeycomb' });
S('flower_pot', 'Flower Pot', 'Decoration', 1, ['B.B', '.B.'], { B: 'brick' });

// ---- tools and weapons ----
const mats = [['wooden', 'Wooden', 'planks'], ['stone', 'Stone', 'cobblestone'], ['iron', 'Iron', 'iron_ingot'], ['golden', 'Golden', 'gold_ingot'], ['diamond', 'Diamond', 'diamond']];
for (const [m, label, ing] of mats) {
  const key = { M: ing, S: 'stick' };
  S(m + '_pickaxe', label + ' Pickaxe', 'Tools', 1, ['MMM', '.S.', '.S.'], key);
  S(m + '_axe', label + ' Axe', 'Tools', 1, ['MM.', 'MS.', '.S.'], key);
  S(m + '_shovel', label + ' Shovel', 'Tools', 1, ['M', 'S', 'S'], key);
  S(m + '_hoe', label + ' Hoe', 'Tools', 1, ['MM.', '.S.', '.S.'], key);
  S(m + '_sword', label + ' Sword', 'Combat', 1, ['M', 'M', 'S'], key);
}
S('bow', 'Bow', 'Combat', 1, ['.ST', 'S.T', '.ST'], { S: 'stick', T: 'string' });
S('arrow', 'Arrow', 'Combat', 4, ['F', 'S', 'E'], { F: 'flint', S: 'stick', E: 'feather' });
S('shield', 'Shield', 'Combat', 1, ['PIP', 'PPP', '.P.'], { P: 'planks', I: 'iron_ingot' });
S('fishing_rod', 'Fishing Rod', 'Tools', 1, ['..S', '.ST', 'S.T'], { S: 'stick', T: 'string' });
S('shears', 'Shears', 'Tools', 1, ['.I', 'I.'], { I: 'iron_ingot' });
S('bucket', 'Bucket', 'Tools', 1, ['I.I', '.I.'], { I: 'iron_ingot' });
L('flint_and_steel', 'Flint and Steel', 'Tools', 1, ['iron_ingot', 'flint']);
S('compass', 'Compass', 'Tools', 1, ['.I.', 'IRI', '.I.'], { I: 'iron_ingot', R: 'redstone' });
S('clock', 'Clock', 'Tools', 1, ['.G.', 'GRG', '.G.'], { G: 'gold_ingot', R: 'redstone' });
S('spyglass', 'Spyglass', 'Tools', 1, ['.A.', '.C.', '.C.'], { A: 'amethyst', C: 'copper_ingot' });
S('lead', 'Lead', 'Tools', 2, ['TT.', 'TS.', '..T'], { T: 'string', S: 'slime_ball' });

// ---- armor ----
const armor = [['leather', 'Leather', 'leather', ['Cap', 'Tunic', 'Pants', 'Boots']], ['iron', 'Iron', 'iron_ingot', null], ['golden', 'Golden', 'gold_ingot', null], ['diamond', 'Diamond', 'diamond', null]];
for (const [m, label, ing, names] of armor) {
  const n = names || ['Helmet', 'Chestplate', 'Leggings', 'Boots'];
  const k = { M: ing };
  S(m + '_helmet', label + ' ' + n[0], 'Armor', 1, ['MMM', 'M.M'], k);
  S(m + '_chestplate', label + ' ' + n[1], 'Armor', 1, ['M.M', 'MMM', 'MMM'], k);
  S(m + '_leggings', label + ' ' + n[2], 'Armor', 1, ['MMM', 'M.M', 'M.M'], k);
  S(m + '_boots', label + ' ' + n[3], 'Armor', 1, ['M.M', 'M.M'], k);
}

// ---- light ----
S('torch', 'Torch', 'Decoration', 4, ['C', 'S'], { C: 'coal', S: 'stick' });
S('redstone_torch', 'Redstone Torch', 'Redstone', 1, ['R', 'S'], { R: 'redstone', S: 'stick' });
S('lantern', 'Lantern', 'Decoration', 1, ['NNN', 'NTN', 'NNN'], { N: 'iron_nugget', T: 'torch' });
S('daylight_detector', 'Daylight Detector', 'Redstone', 1, ['GGG', 'QQQ', 'SSS'], { G: 'glass', Q: 'quartz', S: 'slab' });

// ---- redstone and transport ----
S('lever', 'Lever', 'Redstone', 1, ['S', 'C'], { S: 'stick', C: 'cobblestone' });
S('tripwire_hook', 'Tripwire Hook', 'Redstone', 2, ['I', 'S', 'P'], { I: 'iron_ingot', S: 'stick', P: 'planks' });
S('repeater', 'Redstone Repeater', 'Redstone', 1, ['TRT', 'SSS'], { T: 'redstone_torch', R: 'redstone', S: 'stone' });
S('comparator', 'Redstone Comparator', 'Redstone', 1, ['.T.', 'TQT', 'SSS'], { T: 'redstone_torch', Q: 'quartz', S: 'stone' });
S('observer', 'Observer', 'Redstone', 1, ['CCC', 'RRQ', 'CCC'], { C: 'cobblestone', R: 'redstone', Q: 'quartz' });
S('piston', 'Piston', 'Redstone', 1, ['PPP', 'CIC', 'CRC'], { P: 'planks', C: 'cobblestone', I: 'iron_ingot', R: 'redstone' });
S('dropper', 'Dropper', 'Redstone', 1, ['CCC', 'C.C', 'CRC'], { C: 'cobblestone', R: 'redstone' });
S('tnt', 'TNT', 'Redstone', 1, ['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: 'sand' });
S('rail', 'Rail', 'Transport', 16, ['I.I', 'ISI', 'IRI'], { I: 'iron_ingot', S: 'stick', R: 'redstone' });
S('powered_rail', 'Powered Rail', 'Transport', 6, ['G.G', 'GSG', 'GRG'], { G: 'gold_ingot', S: 'stick', R: 'redstone' });
S('minecart', 'Minecart', 'Transport', 1, ['I.I', 'III'], { I: 'iron_ingot' });

// ---- iron parts ----
S('iron_bars', 'Iron Bars', 'Building', 16, ['III', 'III'], { I: 'iron_ingot' });
S('iron_door', 'Iron Door', 'Building', 3, ['II', 'II', 'II'], { I: 'iron_ingot' });
S('iron_trapdoor', 'Iron Trapdoor', 'Building', 1, ['II', 'II'], { I: 'iron_ingot' });
S('chain', 'Chain', 'Building', 1, ['N', 'I', 'N'], { N: 'iron_nugget', I: 'iron_ingot' });

// ---- stone building ----
S('stone_bricks', 'Stone Bricks', 'Building', 4, ['SS', 'SS'], { S: 'stone' });
S('stone_slab', 'Stone Slab', 'Building', 6, ['SSS'], { S: 'stone' });
S('stone_stairs', 'Stone Stairs', 'Building', 4, ['S..', 'SS.', 'SSS'], { S: 'stone' });
S('stone_button', 'Stone Button', 'Redstone', 1, ['S'], { S: 'stone' });
S('stone_pressure_plate', 'Stone Pressure Plate', 'Redstone', 1, ['SS'], { S: 'stone' });
S('cobblestone_slab', 'Cobblestone Slab', 'Building', 6, ['CCC'], { C: 'cobblestone' });
S('cobblestone_stairs', 'Cobblestone Stairs', 'Building', 4, ['C..', 'CC.', 'CCC'], { C: 'cobblestone' });
S('cobblestone_wall', 'Cobblestone Wall', 'Building', 6, ['CCC', 'CCC'], { C: 'cobblestone' });
S('bricks', 'Bricks', 'Building', 1, ['BB', 'BB'], { B: 'brick' });
S('sandstone', 'Sandstone', 'Building', 1, ['SS', 'SS'], { S: 'sand' });
S('glass_pane', 'Glass Pane', 'Building', 16, ['GGG', 'GGG'], { G: 'glass' });
S('glass_bottle', 'Glass Bottle', 'Misc', 3, ['G.G', '.G.'], { G: 'glass' });
S('quartz_block', 'Block of Quartz', 'Building', 1, ['QQ', 'QQ'], { Q: 'quartz' });
S('quartz_slab', 'Quartz Slab', 'Building', 6, ['QQQ'], { Q: 'quartz' });
S('quartz_pillar', 'Quartz Pillar', 'Building', 2, ['Q', 'Q'], { Q: 'quartz' });
S('amethyst_block', 'Block of Amethyst', 'Building', 1, ['AA', 'AA'], { A: 'amethyst' });
S('honeycomb_block', 'Honeycomb Block', 'Building', 1, ['HH', 'HH'], { H: 'honeycomb' });
S('lightning_rod', 'Lightning Rod', 'Redstone', 1, ['C', 'C', 'C'], { C: 'copper_ingot' });

// ---- storage blocks ----
const blocks = [['iron_block', 'Block of Iron', 'iron_ingot'], ['gold_block', 'Block of Gold', 'gold_ingot'], ['diamond_block', 'Block of Diamond', 'diamond'],
  ['redstone_block', 'Block of Redstone', 'redstone'], ['coal_block', 'Block of Coal', 'coal'], ['emerald_block', 'Block of Emerald', 'emerald'],
  ['lapis_block', 'Lapis Lazuli Block', 'lapis'], ['copper_block', 'Block of Copper', 'copper_ingot'], ['slime_block', 'Slime Block', 'slime_ball'], ['hay_bale', 'Hay Bale', 'wheat']];
for (const [id, name, ing] of blocks) S(id, name, 'Building', 1, ['III', 'III', 'III'], { I: ing });

// ---- food and paper ----
S('paper', 'Paper', 'Misc', 3, ['SSS'], { S: 'sugar_cane' });
L('book', 'Book', 'Misc', 1, ['paper', 'paper', 'paper', 'leather']);
S('bread', 'Bread', 'Food', 1, ['WWW'], { W: 'wheat' });

// ---------------------------------------------------------------- matching
export const NAMES = {};
for (const [id, name] of INGREDIENTS) NAMES[id] = name;
for (const r of RECIPES) NAMES[r.id] = r.name;

const CATS = {};
for (const r of RECIPES) CATS[r.id] = r.cat;
export const categoryOf = (id) => CATS[id] || 'Misc';

const mirror = (cells) => cells.map((row) => row.slice().reverse());

const SHAPED = [];
const SHAPELESS = [];
for (const r of RECIPES) {
  if (r.shaped) {
    SHAPED.push({ r, cells: r.cells });
    const m = mirror(r.cells);
    if (JSON.stringify(m) !== JSON.stringify(r.cells)) SHAPED.push({ r, cells: m });
  } else {
    SHAPELESS.push({ r, list: r.list.slice().sort().join(',') });
  }
}

// grid: array of 9 ids or null, row-major. Returns the recipe it makes, or null.
export function craft(grid) {
  let minX = 3, minY = 3, maxX = -1, maxY = -1;
  for (let i = 0; i < 9; i++) {
    if (grid[i]) {
      const x = i % 3, y = Math.floor(i / 3);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const sub = [];
  for (let y = minY; y <= maxY; y++) {
    const row = [];
    for (let x = minX; x <= maxX; x++) row.push(grid[y * 3 + x] || null);
    sub.push(row);
  }
  const sig = JSON.stringify(sub);
  for (const s of SHAPED) {
    if (s.cells.length === h && s.cells[0].length === w && JSON.stringify(s.cells) === sig) return s.r;
  }
  const list = grid.filter(Boolean).sort().join(',');
  for (const s of SHAPELESS) if (s.list === list) return s.r;
  return null;
}

// Colours the slots of a guess against the target recipe.
// result[i]: 'green' | 'yellow' | 'none' | null (empty slot)
export function feedback(target, grid) {
  const out = grid.map((g) => (g ? 'none' : null));
  const counts = {};
  if (target.shaped) {
    // try every position (and the mirror image) of the pattern, keep the best fit
    let best = null, bestGreens = -1;
    for (const cells of [target.cells, mirror(target.cells)]) {
      const h = cells.length, w = cells[0].length;
      for (let oy = 0; oy <= 3 - h; oy++) {
        for (let ox = 0; ox <= 3 - w; ox++) {
          const t = new Array(9).fill(null);
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) t[(oy + y) * 3 + ox + x] = cells[y][x];
          let g = 0;
          for (let i = 0; i < 9; i++) if (t[i] && grid[i] === t[i]) g++;
          if (g > bestGreens) { bestGreens = g; best = t; }
        }
      }
    }
    for (let i = 0; i < 9; i++) {
      if (best[i] && grid[i] === best[i]) out[i] = 'green';
      else if (best[i]) counts[best[i]] = (counts[best[i]] || 0) + 1;
    }
    for (let i = 0; i < 9; i++) {
      if (grid[i] && out[i] !== 'green' && counts[grid[i]] > 0) { out[i] = 'yellow'; counts[grid[i]]--; }
    }
  } else {
    for (const id of target.list) counts[id] = (counts[id] || 0) + 1;
    for (let i = 0; i < 9; i++) {
      if (grid[i] && counts[grid[i]] > 0) { out[i] = 'green'; counts[grid[i]]--; }
    }
  }
  return out;
}

export function ingredientCount(r) {
  const ids = r.shaped ? r.cells.flat().filter(Boolean) : r.list;
  return new Set(ids).size;
}

export const ALL_IDS = RECIPES.map((r) => r.id);
export const BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
