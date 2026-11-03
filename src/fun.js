// Small touches that make the app friendlier: greetings, seasonal decorations,
// shopping cheers, the weekly recap and milestone badges. Pure logic only.
import { weekStart, parseDay, daysSince } from "./recipes/utils.js";

// ── Greeting ── "Good morning, Amy" / "Happy Sunday, Amy — planning day?"
export const greeting = (name, shopping = false, now = new Date()) => {
  const holiday = holidayOn(now);
  if (holiday?.greeting) return `${holiday.greeting}, ${name}`;
  if (shopping) return `Happy shopping, ${name}`;
  const h = now.getHours();
  const day = now.getDay(); // 0 = Sunday
  if (h >= 5 && h < 18) {
    if (day === 0) return `Happy Sunday, ${name} — planning day?`;
    if (day === 6) return `Happy Saturday, ${name}`;
    if (day === 5 && h >= 12) return `Happy Friday, ${name}`;
  }
  if (h < 5)  return `Up late, ${name}?`;
  if (h < 12) return `Good morning, ${name}`;
  if (h < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
};

// ── Seasonal decorations for the header ──
// Thanksgiving is the fourth Thursday of November.
const thanksgiving = (year) => {
  const d = new Date(year, 10, 1);
  d.setDate(1 + ((4 - d.getDay() + 7) % 7) + 21);
  return d;
};
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const holidayOn = (now) => {
  const m = now.getMonth(), d = now.getDate();
  if (sameDay(now, thanksgiving(now.getFullYear()))) return { greeting: "Happy Thanksgiving" };
  if (m === 11 && d === 25) return { greeting: "Merry Christmas" };
  if (m === 0 && d === 1)   return { greeting: "Happy New Year" };
  if (m === 6 && d === 4)   return { greeting: "Happy 4th of July" };
  if (m === 9 && d === 31)  return { greeting: "Happy Halloween" };
  return null;
};

export const seasonalDecor = (now = new Date()) => {
  const m = now.getMonth(), d = now.getDate();
  const tg = thanksgiving(now.getFullYear());
  const tgDays = Math.round((now - tg) / 86400000);
  if ((m === 11 && d >= 27) || (m === 0 && d <= 2)) return ["✨", "🎉", "❄️", "✨", "🥂"];
  if (m === 11)                  return ["❄️", "🎄", "❄️", "⛄", "❄️"];
  if (tgDays >= -7 && tgDays <= 3) return ["🦃", "🍂", "🥧", "🍁", "🍂"];
  if (m === 9 && d >= 20)        return ["🎃", "🍂", "🦇", "🍁", "🎃"];
  if (m >= 8 && m <= 10)         return ["🍂", "🍁", "🍂", "🍁", "🍂"];
  if (m === 1 && d >= 7 && d <= 14) return ["💕", "❄️", "💗", "❄️", "💕"];
  if (m <= 1)                    return ["❄️", "❄️", "☃️", "❄️", "❄️"];
  if (m === 2 && d >= 12 && d <= 17) return ["🍀", "🌷", "🍀", "🌱", "🍀"];
  if (m >= 2 && m <= 4)          return ["🌷", "🌸", "🐝", "🌼", "🌸"];
  if (m === 6 && d <= 5)         return ["🎆", "⭐", "🎇", "⭐", "🎆"];
  return ["☀️", "🍉", "🌻", "🍦", "🌻"];
};

// ── Shopping cheers, shown above the progress bar ──
export const cheer = (done, total) => {
  if (!total) return "";
  const left = total - done;
  if (left === 0) return "All done! 🎉";
  if (done === 0) return "Let's go! 🛒";
  if (left <= 3 && done / total >= 0.6) return `Almost done — ${left} to go`;
  if (done / total >= 0.5) return "Halfway there! 💪";
  return "Off to a good start";
};

// A short buzz on phones that allow it (Android; iPhones don't).
export const buzz = (pattern = 12) => {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
};

export const prefersLessMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

// ── Weeks in a row with something planned ──
// Counts back from next week (or this week, if next week isn't planned yet).
export const planStreak = (mealPlan, now = new Date()) => {
  const weeks = new Set(mealPlan.map((m) => m.week_start));
  let offset = weeks.has(weekStart(1, now)) ? 1 : weeks.has(weekStart(0, now)) ? 0 : -1;
  let streak = 0;
  while (weeks.has(weekStart(offset, now))) { streak++; offset--; }
  return streak;
};

// First week each recipe was ever planned.
const firstWeeks = (mealPlan) => {
  const first = {};
  mealPlan.forEach(({ recipe_id, week_start }) => {
    if (recipe_id && week_start && (!first[recipe_id] || week_start < first[recipe_id])) first[recipe_id] = week_start;
  });
  return first;
};

// ── Weekly recap, shown before New Week clears the list ──
export const weekRecap = ({ mealPlan, items, now = new Date() }) => {
  const week = weekStart(0, now);
  const meals = mealPlan.filter((m) => m.week_start === week);
  const first = firstWeeks(mealPlan);
  const selected = items.filter((i) => i.is_selected);
  return {
    meals: meals.length,
    newRecipes: new Set(meals.filter((m) => first[m.recipe_id] === week).map((m) => m.recipe_id)).size,
    bought: selected.filter((i) => i.is_checked).length,
    onList: selected.length,
    streak: planStreak(mealPlan, now),
  };
};

// ── Milestone badges ──
// Each badge is earned when `value` reaches `goal`.
export const milestones = ({ mealPlan, recipes, publicId, now = new Date() }) => {
  const byId = Object.fromEntries(recipes.map((r) => [r.id, r]));
  const tried = new Set(mealPlan.map((m) => m.recipe_id).filter((id) => byId[id]));
  const recentProteins = new Set(
    mealPlan
      .filter((m) => m.week_start && daysSince(m.week_start, now) <= 28 && parseDay(m.week_start) <= now)
      .map((m) => byId[m.recipe_id]?.protein)
      .filter((p) => p && p !== "other")
  );
  const borrowed = [...tried].filter((id) => byId[id].owner_id && byId[id].owner_id !== publicId).length;
  const rated = recipes.filter((r) => r.ratings?.[publicId]).length;
  const own = recipes.filter((r) => r.owner_id === publicId).length;
  const streak = planStreak(mealPlan, now);
  const meals = mealPlan.length;

  return [
    { key: "first",    icon: "🗓️", name: "First plan",      hint: "Plan your first meal",                 value: meals,               goal: 1 },
    { key: "club",     icon: "🍽️", name: "Dinner club",     hint: "Plan 25 meals",                        value: meals,               goal: 25 },
    { key: "century",  icon: "🏆", name: "Century",         hint: "Plan 100 meals",                       value: meals,               goal: 100 },
    { key: "roll",     icon: "🔥", name: "On a roll",       hint: "Plan 4 weeks in a row",                value: streak,              goal: 4 },
    { key: "explorer", icon: "🧭", name: "Explorer",        hint: "Try 10 different recipes",             value: tried.size,          goal: 10 },
    { key: "adventure",icon: "🗺️", name: "Adventurer",      hint: "Try 25 different recipes",             value: tried.size,          goal: 25 },
    { key: "rainbow",  icon: "🌈", name: "Protein rainbow", hint: "5 different proteins in 4 weeks",      value: recentProteins.size, goal: 5 },
    { key: "critic",   icon: "⭐", name: "Food critic",     hint: "Rate 10 recipes",                      value: rated,               goal: 10 },
    { key: "box",      icon: "📇", name: "Recipe box",      hint: "Add 10 recipes of your own",           value: own,                 goal: 10 },
    { key: "friends",  icon: "🤝", name: "Borrowed a cup",  hint: "Make 3 recipes from other households", value: borrowed,            goal: 3 },
  ].map((b) => ({ ...b, earned: b.value >= b.goal }));
};

// ── Household emoji and color ──
export const HOUSEHOLD_EMOJIS = [
  "🏠", "🏡", "🦊", "🐻", "🐼", "🐨", "🦉", "🐝", "🐢", "🐙", "🦋", "🐶",
  "🐱", "🌻", "🌵", "🍋", "🍓", "🥑", "🌮", "🍕", "🧁", "☕", "⭐", "🌈",
];

export const HOUSEHOLD_COLORS = [
  { key: "sand",     label: "Sand",     bg: "var(--bg-ede7da)" },
  { key: "coral",    label: "Coral",    bg: "var(--bg-ffdcd2)" },
  { key: "sun",      label: "Sun",      bg: "var(--bg-ffedb8)" },
  { key: "mint",     label: "Mint",     bg: "var(--bg-d8f0cc)" },
  { key: "sky",      label: "Sky",      bg: "var(--bg-d3e9f7)" },
  { key: "lavender", label: "Lavender", bg: "var(--bg-e4daf6)" },
  { key: "pink",     label: "Pink",     bg: "var(--bg-f8d9e8)" },
  { key: "teal",     label: "Teal",     bg: "var(--bg-cdece6)" },
];

// A household's look, from its public profile: { emoji, bg }.
export const householdLook = (profile) => ({
  emoji: profile?.emoji || "🏠",
  bg: (HOUSEHOLD_COLORS.find((c) => c.key === profile?.color) || HOUSEHOLD_COLORS[0]).bg,
});
