import type { AgentId } from "./mission-store";

export function mockDeliverable(agent: AgentId, mission: string) {
  const name = mission.replace(/^i want to (start|build|launch|open)\s+/i, "").replace(/^a\s+/i, "");
  const brand = name.split(" ").map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ") || "Your Business";

  switch (agent) {
    case "planner":
      return {
        title: `${brand} — Business Plan`,
        sections: {
          concept: `${brand} is a modern take on ${name}, designed for busy urban customers who value quality, convenience and a distinctive brand experience.`,
          brand: { name: brand, voice: "Warm, confident, quietly premium", palette: ["#5B4FE9", "#FDE68C", "#0F172A"] },
          market: "Primary: 25–45 y/o urban professionals. Secondary: local families. TAM ~$4.2B, SAM ~$180M in target metro.",
          edge: ["Signature product line", "Same-day local fulfillment", "Membership loyalty program", "Distinctive brand identity"],
          revenue: ["Direct retail", "Subscription boxes", "B2B wholesale", "Events & workshops"],
          roadmap: [
            { phase: "Foundation", weeks: "Weeks 1–4", actions: "Register entity, secure location, source suppliers, finalize brand" },
            { phase: "Build",      weeks: "Weeks 5–8", actions: "Fit-out, hire core team, build website, soft-launch to friends & family" },
            { phase: "Launch",     weeks: "Weeks 9–12", actions: "Grand opening, paid campaigns live, press outreach, loyalty program on" },
          ],
          metrics: ["MRR $18k by month 3", "40% repeat customer rate", "CAC < $22", "NPS > 55"],
        },
      };
    case "marketing":
      return {
        title: `${brand} — Launch Campaign`,
        voice: "Warm, playful, quietly confident. Never salesy. Short sentences. Sensory language.",
        strategy: "3-week teaser → launch week → community activation. Instagram + TikTok primary; email drip in parallel.",
        posts: [
          { headline: "Something's coming.", body: `We've been quietly building ${brand}. In two weeks, we open the doors.`, tags: ["#comingsoon", "#local", "#craft"], time: "Tue 9:00 AM" },
          { headline: "Meet the team.", body: `The people behind ${brand} — and why we're doing this.`, tags: ["#foundersstory", "#local"], time: "Thu 6:00 PM" },
          { headline: "First taste.", body: `A behind-the-scenes look at what we're making. Save this — you'll want it.`, tags: ["#bts", "#firstlook"], time: "Sat 11:00 AM" },
          { headline: "Doors open Friday.", body: `Grand opening this Friday, 8 AM. First 50 guests get a founding-member card.`, tags: ["#grandopening", "#local"], time: "Mon 8:00 AM" },
          { headline: "You showed up.", body: `Thank you for a launch weekend we won't forget. Here's what's next.`, tags: ["#gratitude", "#community"], time: "Sun 7:00 PM" },
          { headline: "Become a founding member.", body: `A limited number of founding memberships are now live. Perks inside.`, tags: ["#members", "#local"], time: "Wed 12:00 PM" },
        ],
      };
    case "finance":
      return {
        title: `${brand} — Financial Model`,
        stats: { investment: 145000, monthlyBurn: 22400, breakevenMonth: 7 },
        monthly: Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const revenue = Math.round(3200 * Math.pow(1.35, i));
          const expenses = 18000 + Math.round(revenue * 0.42);
          return { month: `M${m}`, revenue, expenses };
        }),
        costs: [
          { name: "Buildout",  value: 62000 },
          { name: "Equipment", value: 28000 },
          { name: "Inventory", value: 18000 },
          { name: "Marketing", value: 14000 },
          { name: "Legal",     value: 6000 },
          { name: "Reserve",   value: 17000 },
        ],
      };
    case "operations":
      return {
        title: `${brand} — Operations Playbook`,
        suppliers: [
          "Primary ingredient supplier — weekly delivery",
          "Packaging & branded goods — monthly restock",
          "POS + payments provider onboarded",
          "Cleaning & waste contract active",
          "Insurance + liability policy filed",
        ],
        sop: [
          "07:30 — Open, sanitize surfaces, calibrate equipment",
          "08:00 — Morning prep, staff briefing, day plan on board",
          "09:00 — Doors open, front-of-house handoff",
          "12:00 — Midday inventory + restock check",
          "17:00 — Evening changeover, log daily numbers",
          "20:30 — Close, deep clean, tomorrow's mise-en-place",
        ],
        quality: [
          "Temperature log every 2 hours",
          "Customer feedback triaged within 24h",
          "Weekly team retro every Monday 9 AM",
          "Monthly supplier quality review",
        ],
      };
    case "website":
      return {
        title: `${brand} — Landing Page`,
        brand,
        tagline: `A modern ${name}, thoughtfully made.`,
        sections: ["Hero", "Story", "Menu / Offering", "Community", "Visit us"],
      };
  }
}
