'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Brain, Users, TrendingUp, Shield, Heart, Zap, ArrowRight } from 'lucide-react';

export default function SecondaryLanding() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Replace with your actual email collection service
    console.log({ email });
    setSubmitted(true);
    setTimeout(() => {
      setEmail('');
      setSubmitted(false);
    }, 3000);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Target className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-slate-900">SFG Secondary</span>
            </div>
            <a href="#signup" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl sm:text-7xl font-bold text-slate-900 mb-8 leading-tight">
              YOUR NEW
              <br />
              <span className="text-blue-600">SECONDARY LANDING</span>
            </h1>
            <p className="text-2xl text-slate-700 mb-12 max-w-3xl mx-auto">
              This is your secondary landing page. Tell me what specific content, positioning, or instructions you want here.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#signup" className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors">
                Get Started Now
              </a>
              <a href="#features" className="bg-slate-200 text-slate-900 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-slate-300 transition-colors">
                Learn More
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-slate-900">
            What Makes This Different?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Brain className="w-12 h-12" />}
              title="Custom Content"
              description="Tell me what specific content you want here. I'll customize it for your needs."
            />
            <FeatureCard
              icon={<Target className="w-12 h-12" />}
              title="New Positioning"
              description="Different angle, different audience, different value proposition."
            />
            <FeatureCard
              icon={<Users className="w-12 h-12" />}
              title="Secondary Audience"
              description="Reach a different segment or use case with this landing page."
            />
            <FeatureCard
              icon={<TrendingUp className="w-12 h-12" />}
              title="A/B Testing"
              description="Test different approaches and see what converts better."
            />
            <FeatureCard
              icon={<Shield className="w-12 h-12" />}
              title="Backup Strategy"
              description="Have multiple landing pages for different traffic sources."
            />
            <FeatureCard
              icon={<Heart className="w-12 h-12" />}
              title="Focused Message"
              description="One clear message, one clear call-to-action, one clear outcome."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="signup" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-center mb-8 text-slate-900">
              Ready to Get Started?
            </h2>
            <div className="bg-white rounded-2xl p-8 shadow-xl">
              {submitted ? (
                <div className="text-center py-8">
                  <div className="text-green-600 text-2xl font-bold mb-2">✓ Thank you!</div>
                  <p className="text-slate-600">We'll be in touch soon.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none text-slate-900"
                      placeholder="your@email.com"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    Get Started Now
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <p className="text-sm text-slate-600 text-center">
                    Join thousands who are already getting results.
                  </p>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Target className="w-8 h-8" />
              <span className="text-2xl font-bold">SFG Secondary</span>
            </div>
            <p className="text-slate-400">
              "Your secondary landing page for different audiences and use cases."
            </p>
            <div className="flex justify-center space-x-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="mailto:contact@sfg.ac" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-sm text-slate-500 pt-4">
              © 2025 SFG Secondary. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
    >
      <div className="text-blue-600 mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2 text-slate-900">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </motion.div>
  );
}

