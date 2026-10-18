# Lessons

Patterns from user corrections, reviewed at the start of each session (see CLAUDE.md, "Self-Improvement Loop").

## Visible results, in the game (2026-10-17)

**What happened:** asked to "redraw everything", I drew the new art but only as preview images and stopped
for approval before putting anything in the game. The hub and Chapter 1 previews were also the same
grass-island-on-water map with the same tiles. The user opened the game, saw nothing new, and called it
out: "are you sure you changed anything? … I'm expecting a full ass change".

**Rules:**
- A visual overhaul ships in the game. Review real in-game screenshots, not side images; no preview-only stops.
- "Change everything" means each place gets its own structure and identity, not the same layout recoloured.
  Before showing work, compare areas side by side: if two of them read as the same map, it isn't done.
- When the request is an overhaul, aim for the dramatic version; scale back only if the user asks.

## Inspired by, not a copy of (2026-10-18)

**What happened:** asked to redo the game "like the old Pokémon games on Game Boy… same starting story", I
reproduced Gold/Silver/Crystal 1:1: the look, the Game Boy frame, the Gen 1 opening beat for beat (Prof stops
you in the grass, three balls on a table, the rival grabs the counter-type) and a routes → gyms → League plan.
The user liked it but found it "a bit too much like Pokémon", wanted a newer-generation UI and a shorter,
more straightforward opening.

**Rules:**
- "Like X" means X's feel and mechanics, not X's signature story beats, look and structure copied 1:1.
  Before building, name what would be a direct copy and propose a version with the project's own identity.
- Keep openings short: get the player to the first real interaction (here: coding and a battle) fast.
- Ask which generation/era a "retro" request means when the UI matters; later eras read as "better".

## Never leave the player at a dead end (2026-10-18)

**What happened:** M1b ended at the tower's hall with a guard blocking the stairs ("les étages sont en
préparation"), because the new floors were scheduled for the next milestone. The 94 floors of the previous
version still existed in the code, but nothing led to them. The user tried to go up, got stuck, and read it as
broken: "I can't access the tour du code floors… im stuck out of it wtf". The final message mentioned it, but
only as a side note.

**Rules:**
- A milestone must never take away something the player could do before. If the new version of a feature isn't
  ready, keep the old one reachable through a temporary bridge, and replace it later.
- Never block the obvious next step with a "coming soon" wall. If a stop is truly needed, say so at the top of the
  hand-off message, plainly, not in a list of notes.
- Before handing off, play the build the way the user will: walk to the obvious next place and check it works.
