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
  title: string;
  /** Meta labels shown above the title, in order */
  tags: string[];
  description: string;
  url: string;
  /** Shown beside the domain, e.g. while the product is still being built */
  status?: string;
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

// Further work, shown under the featured client. Longevity and performance only.
export const projects: Project[] = [
  {
    title: 'AthleteXperience',
    tags: ['Athlete Performance', 'Mobile App'],
    description:
      'A mobile platform for youth and amateur athletes to log training, share highlights and get discovered by recruiters.',
    url: 'https://theathletexperience.com',
    status: 'In development',
  },
];
