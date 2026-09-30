/* Shared game data: loaded by the browser (script tag) and by server.js (require). */
/* ============ GAME DATA (add regions, skills and actions here) ============ */
// Skill list. To add a fourth root skill, add it here, add a --color + .skill.<id> rule in CSS,
// then add an array of actions under that id in every region.
const SKILLS=[['combat','Combat'],['gathering','Gathering'],['crafting','Crafting']];

// Rule for opening the next region: every skill mastered in the previous one.
// (Change to `.some` to require only one mastered skill.)
const unlocksNext=(prev)=>SKILLS.every(([k])=>level(prev,k).l>=prev.max);

// Action helpers. lvl = level required, sec = duration, xp = skill xp gained.
const C=(name,lvl,sec,xp,drops,gold,rare)=>({name,lvl,sec,xp,drops,gold,rare});      // fight: drops + gold
const G=(name,lvl,sec,xp,drops,tool,rare)=>({name,lvl,sec,xp,drops,tool,rare});   // tool = minimum tier of equipped tool                 // gather: drops
const K=(name,lvl,sec,xp,cost,value)=>({name,lvl,sec,xp,cost,value});       // craft: cost -> 1 item named after the recipe

const REGIONS=[
{id:'greenhollow',hue:140,name:'Greenhollow',blurb:'Meadows and old woods. A gentle start.',max:10,scale:1,
 combat:[C('Wild Boar',1,4,6,{'Boar Hide':[1,2],'Boar Meat':[1,2]},[1,3]),C('Forest Wolf',4,5,14,{'Wolf Pelt':[1,1]},[2,6],['Alpha Pelt',0.04]),C('Bandit Scout',7,6,26,{'Iron Scrap':[1,2]},[4,9],['Bandit Signet',0.05]),C('Dire Stag',9,7,34,{'Boar Meat':[2,3],'Boar Hide':[1,1]},[6,12])],
 gathering:[G('Oak Logs',1,3,5,{'Oak Log':[1,2]},0,['Ancient Acorn',0.03]),G('Copper Seam',3,4,10,{'Copper Ore':[1,2]}),G('Moonpetal Patch',6,4,16,{'Moonpetal':[1,2]}),G('Ironvein',8,5,24,{'Iron Ore':[1,1]},1),G('Wild Berry Bush',2,3,7,{'Wild Berries':[2,3]})],
 crafting:[K('Oak Plank',1,3,6,{'Oak Log':2},3),K('Copper Ingot',3,4,12,{'Copper Ore':2},6),K('Hide Jerkin',5,5,20,{'Boar Hide':3,'Oak Plank':1},14),K('Iron Ingot',8,6,30,{'Iron Ore':2,'Copper Ingot':1},22),K('Copper Sword',6,5,24,{'Copper Ingot':3,'Oak Plank':1},30),K('Oak Mallet',2,4,8,{'Oak Plank':3,'Copper Ore':1},16),K('Copper Pickaxe',4,5,14,{'Copper Ingot':2,'Oak Plank':2},18),K('Moonpetal Charm',7,5,22,{'Moonpetal':4,'Copper Ingot':1},45),K('Reinforced Jerkin',7,6,28,{'Hide Jerkin':1,'Iron Scrap':3,'Copper Ingot':1},55),K('Iron Sword',9,7,36,{'Copper Sword':1,'Iron Ingot':2},80),K('Iron Pickaxe',9,7,36,{'Copper Pickaxe':1,'Iron Ingot':2},40),K('Iron Hammer',10,8,44,{'Oak Mallet':1,'Iron Ingot':2,'Oak Plank':1},70),K('Hearty Stew',3,4,12,{'Boar Meat':2,'Wild Berries':2},8),K('Moonpetal Tonic',6,4,18,{'Moonpetal':2,'Wild Berries':1},16),K('Quickhand Elixir',8,5,26,{'Moonpetal':3,'Copper Ingot':1},30)]},
{id:'ashen',hue:18,name:'Ashen Reach',blurb:'A scorched plain of vents and cinder.',max:10,scale:6,
 combat:[C('Cinder Hound',1,5,40,{'Ember Fang':[1,2]},[8,14]),C('Ash Wraith',5,6,80,{'Wraith Dust':[1,2]},[14,24]),C('Obsidian Golem',9,8,140,{'Obsidian Shard':[1,1]},[30,50],['Golem Core',0.04])],
 gathering:[G('Ashwood Stand',1,4,30,{'Ashwood':[1,2]}),G('Sulfur Vent',4,5,60,{'Sulfur':[1,2]},2),G('Emberglass Seam',8,6,110,{'Emberglass':[1,1]},2)],
 crafting:[K('Ashwood Plank',1,4,30,{'Ashwood':2},14),K('Sulfur Flask',4,5,60,{'Sulfur':2,'Ashwood Plank':1},40),K('Wraith Mantle',6,6,90,{'Wraith Dust':3,'Ashwood Plank':1,'Reinforced Jerkin':1},70),K('Cinder Hammer',7,6,100,{'Iron Hammer':1,'Sulfur':2,'Ashwood Plank':1},170),K('Emberglass Blade',8,7,120,{'Emberglass':2,'Iron Sword':1,'Ashwood Plank':2},120),K('Emberglass Pick',9,7,130,{'Iron Pickaxe':1,'Emberglass':2,'Ashwood Plank':1},150),K('Fang Broth',4,5,50,{'Ember Fang':2,'Wild Berries':2},45),K('Cinder Draught',5,5,60,{'Sulfur':2,'Wraith Dust':1},40)]}
];

// name: [category, colour, tier, sell value, stats(gear only, in %)]
const ITEMS={
'Oak Log':['wood','#8a6238',1,2],'Oak Plank':['plank','#b98a52',1,3],'Copper Ore':['ore','#d9813f',1,2],'Copper Ingot':['ingot','#d98a4e',1,6],
'Iron Ore':['ore','#b4bbd0',2,4],'Iron Ingot':['ingot','#aab0c6',2,22],'Iron Scrap':['ore','#7d8296',1,3],'Boar Hide':['hide','#a9775a',1,3],
'Wolf Pelt':['hide','#8d939e',2,5],'Moonpetal':['herb','#b9a7ff',2,5],'Ember Fang':['fang','#e9d6b0',3,14],'Wraith Dust':['dust','#9f8cd6',3,10],
'Obsidian Shard':['gem','#46456e',4,40],'Ashwood':['wood','#5d5857',3,10],'Ashwood Plank':['plank','#85797a',3,14],'Sulfur':['dust','#e3d45a',3,12],
'Emberglass':['gem','#ff7a3c',4,36],
'Hide Jerkin':['armor','#a9775a',1,14,{might:4}],'Wraith Mantle':['armor','#9f8cd6',3,70,{might:8,haste:3}],
'Copper Sword':['weapon','#d98a4e',2,30,{might:6}],'Emberglass Blade':['weapon','#ff7a3c',4,120,{might:14,fortune:4}],
'Iron Pickaxe':['tool','#aab0c6',2,40,{haste:9,fortune:4}],'Sulfur Flask':['charm','#e3d45a',3,40,{fortune:6}],
'Reinforced Jerkin':['armor','#b98a6a',2,55,{might:8}],'Iron Sword':['weapon','#c5cbe0',2,80,{might:11}],'Copper Pickaxe':['tool','#d98a4e',1,18,{haste:4}],
'Emberglass Pick':['tool','#ff7a3c',4,150,{haste:15,fortune:8}],'Oak Mallet':['hammer','#b98a52',1,16,{haste:5}],'Iron Hammer':['hammer','#aab0c6',2,70,{haste:10,fortune:4}],
'Cinder Hammer':['hammer','#e0703a',4,170,{haste:18,fortune:9}],'Moonpetal Charm':['charm','#b9a7ff',2,45,{fortune:4,haste:2}],
'Boar Meat':['meat','#c4574e',1,2],'Wild Berries':['herb','#d9486b',1,1],'Ancient Acorn':['herb','#7aa84a',3,45],'Alpha Pelt':['hide','#dfe6f0',3,60],
'Bandit Signet':['ingot','#d6a84a',3,50],'Golem Core':['gem','#ff9a4a',4,140],
'Hearty Stew':['potion','#c98a4a',1,8,{for:'combat',might:10,secs:600}],'Moonpetal Tonic':['potion','#b9a7ff',2,16,{for:'gathering',haste:10,secs:600}],
'Quickhand Elixir':['potion','#6dd6b0',2,30,{for:'crafting',haste:12,secs:600}],'Fang Broth':['potion','#e9d6b0',3,45,{for:'combat',might:14,haste:4,secs:600}],
'Cinder Draught':['potion','#ff8a3c',3,40,{for:'all',fortune:10,secs:600}],
'Crypt Token':['gem','#4fd1c5',3,25],'Forge Heart':['gem','#ff5a2a',4,80],
'Warden Charm':['charm','#4fd1c5',4,150,{might:5,haste:5,fortune:8}],'Forgelord Plate':['armor','#ff5a2a',4,400,{might:18,haste:6}]};

// Mastery perks: [level in a region, bonus]. Each region applies them separately.
const PERKS={combat:[[5,{might:4}],[10,{might:6,haste:2}]],gathering:[[5,{haste:4}],[10,{fortune:5}]],crafting:[[5,{haste:4}],[10,{fortune:5}]]};
const SLOTS=['weapon','armor','tool','hammer','charm'],SLOT_SKILL={weapon:'combat',armor:'combat',tool:'gathering',hammer:'crafting',charm:null};
if(typeof module!=='undefined')module.exports={SKILLS,REGIONS,ITEMS,SLOTS,SLOT_SKILL,PERKS};
