# Aldermere

A browser idle game inspired by WoW and FFXIV. Regions share the same skills but with their own level ranges; master every skill in a region to open the next.

## Run locally
    npm start        # http://localhost:3000

## Deploy
- **GitHub:** push this folder as a repo.
- **Railway:** New Project > Deploy from GitHub repo. It detects `package.json` and runs `npm start`. No config needed.

## Where things live
All content is data at the top of `public/index.html` (`SKILLS`, `REGIONS`, `unlocksNext`).
- **New region:** add an object to `REGIONS` with `max`, `scale` (xp cost multiplier) and an action array per skill.
- **New skill:** add to `SKILLS`, add a colour + `.skill.<id>` CSS rule, add an action array in every region.
- Saves use `localStorage` key `aldermere.save.v1` (bump the version if the save shape changes).

## Roadmap
1. Gear: crafted items equippable for combat/gathering bonuses
2. Real combat: enemy HP, player stats, food, deaths
3. Fourth root skill
4. More regions, region bosses
5. Split `index.html` into JS/CSS modules once it grows
6. Optional: Railway backend for accounts and cloud saves

## Multiplayer (v0.3)
`server.js` hosts the game and a WebSocket endpoint on the same port, so one Railway service does both. Run `npm install` once locally, then `npm start`. Open two browser tabs to test a dungeon party alone.
- Dungeons are defined in `DUNGEONS` in `server.js`; clients read them from the server.
- Known limit: the server trusts the power value each client reports. Move combat/gear maths server-side before any competitive features.
- Parties and chat live in server memory and reset on redeploy. Saves stay in each player's browser.

## Accounts and cloud saves (v0.4)
- Players register or log in on the title screen. Progress is saved to the server every 10 seconds. "Play offline" still works with a browser-only save and no multiplayer.
- Accounts live in `db.json` inside `DATA_DIR` (default `./data`). **On Railway, add a Volume mounted at `/data` and set the variable `DATA_DIR=/data`, otherwise accounts vanish on every deploy.**
- Passwords are hashed with scrypt. Sessions last 30 days. Login and register are rate limited per IP.
- Game content now lives in `public/data.js`, shared by the browser and the server. Edit regions, items and recipes there.
- Validation: every upload is rebuilt from known fields and rejected if it has unknown items, locked regions, or xp/wealth gained faster than the best in-game action allows. Dungeon rewards are credited server-side. Dungeon power and region access come from the stored save, not from the client.
- This is a plausibility check, not a full server simulation. The next step up is running the task loop on the server.
- Not built yet: password reset, account deletion, moving an offline save into an account.
