'use client';

import Layout from '@/components/layout/Layout';
import HeroSection from '@/components/home/HeroSection';
import PortfolioSection from '@/components/home/PortfolioSection';
import AboutSection from '@/components/home/AboutSection';
import ContactWizard from '@/components/contact/ContactWizard';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import PricingSection from '@/components/home/PricingSection';

import ServicesSection from '@/components/home/ServicesSection';
import RootStage from '@/components/home/RootStage';

export default function Home() {
  return (
    <Layout>
      <HeroSection />
      <RootStage>
        <PortfolioSection />
        <AboutSection />
        <ServicesSection />
        <PricingSection />
        <TestimonialsSection />
        <ContactWizard />
      </RootStage>
    </Layout>
  );
}
