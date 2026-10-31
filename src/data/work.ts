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
  // A non-breaking hyphen (‑), so "evidence-based" never splits across two lines
  tagline: 'Where evidence‑based longevity meets community & culture.',
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

// Further work, shown under the featured client
export const projects: Project[] = [
  {
    title: 'AthleteXperience',
    tags: ['Athlete Performance', 'Mobile App'],
    description:
      'A mobile platform for youth and amateur athletes to log training, share highlights and get discovered by recruiters.',
    url: 'https://theathletexperience.com',
    status: 'In development',
  },
  {
    title: 'Elias Arjan',
    tags: ['Personal Brand', 'Speaker'],
    description:
      'The home of longevity speaker and futurist Elias Arjan: his mission of 100 healthy years, his keynotes and ventures, and a way to book him for your stage.',
    url: 'https://eliasarjan.com',
  },
  {
    title: 'Casa Verde',
    tags: ['Vacation Rental', 'Booking Site'],
    description:
      'A booking site for a villa between the jungle and the ocean in Santa Teresa, Costa Rica: the property, a gallery, curated experiences and live availability.',
    url: 'https://rental-property-demo.vercel.app',
    status: 'Demo',
  },
  {
    title: 'UPrompt',
    tags: ['AI Tool', 'Web App'],
    description:
      'An AI prompt engineering app: write a rough idea, have it rebuilt into a sharp, effective prompt, then save it or refine it in a chat with your choice of model.',
    url: 'https://uprompt.vercel.app',
    status: 'Demo',
  },
];
