/* A short demo clip per move: YouTube ids, each checked to exist and to show
   that exact move (tools/exercise-videos.json). Played in the move picker's
   ▶ and the workout's demo button. */
export const VIDEOS = {};
export const videoEmbed = id => VIDEOS[id] ? `https://www.youtube-nocookie.com/embed/${VIDEOS[id]}?autoplay=1&playsinline=1&rel=0&modestbranding=1` : null;
export const videoSearch = name => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} form tutorial`)}`;
