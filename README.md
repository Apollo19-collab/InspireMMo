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
