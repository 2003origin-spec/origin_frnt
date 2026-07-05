export interface BadgeMeta {
  name: string;
  points: number;
  image: string;
  description: string;
  theme: string;
}

export const BADGE_TIERS: BadgeMeta[] = [
  { name: 'Novice',       points: 0,       image: '/badges/novice.png',       description: 'Begin your journey',          theme: 'from-amber-800 to-yellow-700'   },
  { name: 'Beginner',     points: 100,     image: '/badges/beginner.png',     description: 'First steps taken',           theme: 'from-slate-500 to-slate-400'    },
  { name: 'Apprentice',   points: 300,     image: '/badges/apprentice.png',   description: 'Knowledge is growing',        theme: 'from-yellow-600 to-amber-500'   },
  { name: 'Intermediate', points: 600,     image: '/badges/intermediate.png', description: 'Finding your footing',        theme: 'from-teal-700 to-emerald-500'   },
  { name: 'Advanced',     points: 1000,    image: '/badges/advanced.png',     description: 'Pushing limits',              theme: 'from-blue-700 to-blue-500'      },
  { name: 'Elite',        points: 1500,    image: '/badges/elite.png',        description: 'Rising above the rest',       theme: 'from-purple-700 to-violet-500'  },
  { name: 'Expert',       points: 2200,    image: '/badges/expert.png',       description: 'Commanding your domain',      theme: 'from-red-700 to-rose-500'       },
  { name: 'Veteran',      points: 3200,    image: '/badges/veteran.png',      description: 'Battle-tested and proven',    theme: 'from-pink-700 to-rose-400'      },
  { name: 'Master',       points: 4500,    image: '/badges/master.png',       description: 'Near the top',                theme: 'from-violet-700 to-purple-500'  },
  { name: 'Grandmaster',  points: 6000,    image: '/badges/grandmaster.png',  description: 'A force to be reckoned',      theme: 'from-yellow-500 to-amber-400'   },
  { name: 'Legend',       points: 8000,    image: '/badges/legend.png',       description: 'Stories are told of you',     theme: 'from-red-600 to-orange-400'     },
  { name: 'Mythic',       points: 12000,   image: '/badges/mythic.png',       description: 'Beyond mortal limits',        theme: 'from-purple-600 to-indigo-400'  },
  { name: 'Immortal',     points: 18000,   image: '/badges/immortal.png',     description: 'Defying all boundaries',      theme: 'from-blue-600 to-sky-400'       },
  { name: 'Eternal',      points: 25000,   image: '/badges/eternal.png',      description: 'Time holds no power here',    theme: 'from-blue-700 to-cyan-400'      },
  { name: 'Prime',        points: 40000,   image: '/badges/prime.png',        description: 'The peak of excellence',      theme: 'from-green-700 to-emerald-400'  },
  { name: 'Celestial',    points: 60000,   image: '/badges/celestial.png',    description: 'Among the stars',             theme: 'from-blue-800 to-indigo-500'    },
  { name: 'Ascendant',    points: 90000,   image: '/badges/ascendant.png',    description: 'Rising beyond all limits',    theme: 'from-violet-800 to-purple-400'  },
  { name: 'Divine',       points: 130000,  image: '/badges/divine.png',       description: 'Blessed with mastery',        theme: 'from-yellow-600 to-orange-400'  },
  { name: 'Omniscient',   points: 200000,  image: '/badges/omniscient.png',   description: 'All-knowing',                 theme: 'from-red-700 to-pink-400'       },
  { name: 'Origin',       points: 300000,  image: '/badges/origin.png',       description: 'The source of all knowledge', theme: 'from-sky-600 to-blue-300'       },
];

export function getBadgeForTier(tierName: string): BadgeMeta | undefined {
  return BADGE_TIERS.find((b) => b.name === tierName);
}

export function getUnlockedBadges(totalPoints: number): BadgeMeta[] {
  return BADGE_TIERS.filter((b) => totalPoints >= b.points);
}

export function getLockedBadges(totalPoints: number): BadgeMeta[] {
  return BADGE_TIERS.filter((b) => totalPoints < b.points);
}
