You may have to change the pathing in "node_modules\expo\AppEntry.js" line 3 may need to be changed to "import App from '../../App/App';"
other than that you should only have to npm install and the app should work.

This is a DigiPet app, Like a tamagotchi but not because of copyright

Press on the dog to pat him and his happiness goes up, long press and it goes up even more, he has a toy that makes him even happier — once you use it, it comes back on a cooldown of about 10 minutes.
He will do a little jump when he is played with and bark too, even your phone will vibrate. Using an item from
the Inventory or buying something in the Shop triggers the same jump/bark/vibrate feedback, plus a little floating toast — for an item it shows
which stat changed (green if it's an improvement, red if not), and for a purchase it confirms what you bought. Nothing happens at all if the
action was a no-op (item not held, or can't afford the purchase).

## Stats, offline decay, points & shop

The pet now tracks three stats instead of one:

- **Happiness** (0–100, higher is better) — same as before: tap for +2, long-press for +15.
- **Hunger** (0–100, *lower* is better — it counts up toward "starving").
- **Energy** (0–100, higher is better) — interacting with the pet costs a little energy.

Time away from the app matters now. Every stat decays continuously (see
`DECAY_PER_MINUTE` in `game/petState.js`), and on launch the app computes how
much time passed since you last had it open and applies that decay in one
shot (capped at 12 hours so a long absence can't produce absurd numbers).
While the app is open, one tick every ~7 seconds re-applies the same decay
function and saves.

Petting and playing now earn **points** and **xp**, and xp levels the pet up
(`Level N`, shown next to its mood). Points can be spent in the new **Shop**
on Treats, a Ball, a Bone, and a Nap Mat — each restores different stats.
Affordability is enforced: you can't buy something you don't have the
points for, and points can never go negative.

All of this state — happiness, hunger, energy, points, xp, level, and
inventory — is persisted together under a single AsyncStorage key
(`digipet:state:v2`) and restored on next launch. If you have an older
install with only the legacy `happiness` key, it's automatically migrated
into the new schema the first time you open the updated app (the old key is
left in place, not deleted).

The game rules live in `game/petState.js`, a small dependency-free module
(no React, no React Native imports) so they can be reasoned about — and
tested — independently of the UI. Persistence lives in `game/petStorage.js`.
