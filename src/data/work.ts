// Portfolio content for the home page Projects section (PortfolioSection).

export interface FeaturedProperty {
  kind: string;
  title: string;
  url: string;
}

export interface FeaturedClient {
  name: string;
  tagline: string;
  summary: string;
  properties: FeaturedProperty[];
}

export interface Project {
  id: number;
  title: string;
  category: string;
  description: string;
  url: string;
  /** Background of the hover preview plate */
  gradient: string;
}

// Featured client: every property we've built for the Healthspan Collective
export const featured: FeaturedClient = {
  name: 'Healthspan Collective',
  tagline: 'Where evidence-based longevity meets community & culture.',
  summary:
    'One longevity brand, five sites: its flagship home, an online academy, a community, and two live events.',
  properties: [
    { kind: 'Flagship Site', title: 'Healthspan Collective', url: 'https://healthspancollective.com' },
    { kind: 'Summit', title: 'Healthspan Summit', url: 'https://hssummit.com' },
    { kind: 'Conference', title: 'Longevity Leadership Conference', url: 'https://longevityleadershipconference.com' },
    { kind: 'Academy', title: 'Healthspan Academy', url: 'https://academy.healthspancollective.com' },
    { kind: 'Community', title: 'Healthspan Community', url: 'https://healthspan.community' },
  ],
};

// Project Data
export const projects: Project[] = [
  {
    id: 1,
    title: 'AthleteXperience',
    category: 'Feature Rich Mobile App',
    description: 'Coming Soon - A premium mobile experience for athletes',
    url: 'https://theathletexperience.com',
    gradient: 'linear-gradient(135deg, #1a3a2a 0%, #0d1f15 100%)',
  },
  {
    id: 2,
    title: 'Emerald Grove Digital',
    category: 'AI Services Demo',
    description: 'Showcasing AI-powered digital solutions',
    url: 'https://emeraldgrovedigital.com',
    gradient: 'linear-gradient(135deg, #2a4a3a 0%, #152a1f 100%)',
  },
  {
    id: 3,
    title: 'Shapiro Works',
    category: 'Digital Freelance Agency',
    description: 'Professional digital services portfolio',
    url: 'https://shapiroworks.com',
    gradient: 'linear-gradient(135deg, #3a2a1a 0%, #1f150d 100%)',
  },
  {
    id: 4,
    title: 'UPrompt',
    category: 'AI Prompt Engineering',
    description: 'Tools for crafting perfect AI prompts',
    url: 'https://uprompt.me',
    gradient: 'linear-gradient(135deg, #2a2a3a 0%, #15151f 100%)',
  },
  {
    id: 5,
    title: 'AI Bitcoin Tutor',
    category: 'EdTech / Crypto',
    description: 'AI-powered cryptocurrency education',
    url: 'https://aibitcointutor.com',
    gradient: 'linear-gradient(135deg, #3a3a2a 0%, #1f1f15 100%)',
  },
  {
    id: 6,
    title: 'Crypto Apparel',
    category: 'E-Commerce',
    description: 'Premium cryptocurrency merchandise',
    url: 'https://cryptoapparel.net',
    gradient: 'linear-gradient(135deg, #2a3a3a 0%, #151f1f 100%)',
  },
  {
    id: 7,
    title: 'Luxury Vacation Rental',
    category: 'Rental Property Demo',
    description: 'Premium vacation rental booking experience',
    url: 'https://rental-property-booking-template.vercel.app',
    gradient: 'linear-gradient(135deg, #2a2a2a 0%, #151515 100%)',
  },
  {
    id: 8,
    title: 'Live Pura Vida',
    category: 'Travel Agency Demo',
    description: 'Costa Rica travel experiences',
    url: 'https://livepuravida.net',
    gradient: 'linear-gradient(135deg, #1a3a3a 0%, #0d1f1f 100%)',
  },
];
