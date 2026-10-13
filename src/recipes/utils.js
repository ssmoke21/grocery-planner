// "YYYY-MM-DD" → local Date (avoids the UTC off-by-one-day problem).
export const parseDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const formatShortDate = (s) =>
  parseDay(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const timeBucket = (minutes) => {
  if (!minutes && minutes !== 0) return null;
  if (minutes <= 30) return "quick";
  if (minutes <= 60) return "medium";
  return "long";
};

export const currentSeason = (date = new Date()) => {
  const m = date.getMonth(); // 0 = Jan
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
};

// No seasons selected = year-round.
export const isInSeason = (recipe, season) =>
  !recipe.seasons?.length || recipe.seasons.includes(season);

// Build { [recipeId]: { count, last } } from meal_plan entries.
// `last` is the most recent week_start ("YYYY-MM-DD") or null.
export const buildUsage = (mealPlan) => {
  const usage = {};
  mealPlan.forEach(({ recipe_id, week_start }) => {
    if (!recipe_id || !week_start) return;
    const u = usage[recipe_id] || (usage[recipe_id] = { count: 0, last: null });
    u.count += 1;
    if (!u.last || week_start > u.last) u.last = week_start;
  });
  return usage;
};

export const usageLabel = (u) =>
  u?.count ? `Made ${u.count}× · last ${formatShortDate(u.last)}` : "Never made";

export const formatQty = (qty, unit) => [qty, unit].filter((v) => v || v === 0).join(" ");

// 45 → "45 min", 60 → "1 hr", 75 → "1 hr 15 min"
export const formatMinutes = (m) => {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), rest = m % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
};
