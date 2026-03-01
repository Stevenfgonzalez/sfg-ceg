'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { track } from '@vercel/analytics';

// ── SKILL DATA ──
// Source: CEG Skill Cards V2.pptx
// Static content — no API, no auth, works on airplane mode.
// Each skill is a single scroll with 5-7 bullet steps.

interface Skill {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  category: string;
  emoji: string;
  whyItMatters: string;
  steps: string[];
  callNine11: string;
  difficulty: string;
  timeToLearn: string;
  refreshCycle: string;
}

const SKILLS: Skill[] = [
  {
    id: 'cpr',
    number: '01',
    title: 'Hands-Only CPR',
    subtitle: 'Adult, Layperson',
    category: 'Cardiac Emergency',
    emoji: '💔',
    whyItMatters: '#1 preventable cause of cardiac death is bystander inaction.',
    steps: [
      'Check the scene is safe before approaching.',
      'Tap shoulders and shout "Are you OK?" — check for response.',
      'Call 911 (or ask someone nearby to call) and get an AED if available.',
      'Place heel of one hand on center of chest, other hand on top. Interlock fingers.',
      'Push hard and fast — at least 2 inches deep, 100–120 compressions per minute.',
      'Use the beat of "Stayin\' Alive" to keep rhythm.',
      'Don\'t stop until help arrives or an AED is ready.',
    ],
    callNine11: 'Call 911 immediately for any unresponsive person who isn\'t breathing normally.',
    difficulty: 'Beginner',
    timeToLearn: '15 min',
    refreshCycle: '90 days',
  },
  {
    id: 'bleed',
    number: '02',
    title: 'Stop the Bleed',
    subtitle: 'Direct Pressure & Tourniquet',
    category: 'Traumatic Bleeding',
    emoji: '🩸',
    whyItMatters: 'Bleeding is the #1 preventable cause of death in trauma.',
    steps: [
      'Identify life-threatening bleeding — blood that is spurting, pooling, or soaking through clothing.',
      'Protect yourself — wear gloves if available. Your safety comes first.',
      'Apply direct pressure with both hands using a clean cloth or gauze. Press hard.',
      'If bleeding doesn\'t stop, apply a tourniquet 2-3 inches above the wound (on a limb only).',
      'Tighten until bleeding stops. Note the time of application.',
      'Once applied, do NOT remove the tourniquet. Wait for EMS.',
      'Call 911 and keep pressure on any wounds that can\'t be tourniqueted.',
    ],
    callNine11: 'Call 911 for any serious bleeding that won\'t stop with direct pressure.',
    difficulty: 'Beginner',
    timeToLearn: '20 min',
    refreshCycle: '90 days',
  },
  {
    id: 'fire',
    number: '03',
    title: 'Fire Extinguisher Use',
    subtitle: 'Decision-First, Not Hero Mode',
    category: 'Fire Response',
    emoji: '🔥',
    whyItMatters: 'Very poor real-world performance despite widespread training. Know when to fight vs. leave.',
    steps: [
      'DECIDE first: Is the fire small, contained, and between you and an exit? If not — evacuate.',
      'Pull the pin on the extinguisher.',
      'Aim the nozzle at the BASE of the fire, not the flames.',
      'Squeeze the handle to release the agent.',
      'Sweep side to side across the base of the fire.',
      'Keep your back toward an exit at all times. If the fire grows — leave immediately.',
      'Even if you put it out, call 911. Fires can reignite.',
    ],
    callNine11: 'Always call 911 for any fire, even if you think you extinguished it.',
    difficulty: 'Beginner',
    timeToLearn: '15 min',
    refreshCycle: '180 days',
  },
  {
    id: 'aed',
    number: '04',
    title: 'AED Familiarization',
    subtitle: 'Open It, Follow the Voice',
    category: 'Cardiac Response',
    emoji: '⚡',
    whyItMatters: 'AEDs only save lives if people are willing to touch them. It\'s a voice-guided tool, not medical equipment.',
    steps: [
      'Know where the nearest AED is — check hallways, lobbies, and gyms before you need one.',
      'Open the case and power on the AED. Most turn on automatically when opened.',
      'Expose the chest — remove clothing. If chest is wet, dry it first.',
      'Place pads exactly as shown in the diagram on the pads. One upper right, one lower left.',
      'Follow ALL voice prompts exactly. The AED will analyze the heart rhythm.',
      '"Clear!" — make sure nobody is touching the person before the AED delivers a shock.',
      'Resume CPR immediately after the shock. Continue until EMS arrives or AED gives new instructions.',
    ],
    callNine11: 'Call 911 before or while getting the AED. Both actions happen in parallel.',
    difficulty: 'Beginner',
    timeToLearn: '10 min',
    refreshCycle: '90 days',
  },
  {
    id: 'tra',
    number: '05',
    title: 'Finding a TRA & Safe Zone',
    subtitle: 'Temporary Refuge Area Identification',
    category: 'Evacuation & Shelter',
    emoji: '📍',
    whyItMatters: 'People die in evacuations when they don\'t know where to go.',
    steps: [
      'A TRA (Temporary Refuge Area) is not a shelter — it\'s a short-term safe spot with clearance from hazards.',
      'Identify pre-designated TRAs in your area: parking lots, wide intersections, sports fields.',
      'Evaluate: open ground, 30+ feet from structures, upwind from smoke, away from power lines.',
      'Know your egress routes — at least two ways out from your home or workplace.',
      'Decision point: Shelter in place if roads are blocked. Evacuate if ordered. TRA if caught between.',
      'Communicate your location and headcount to responders — use your phone or flag down a unit.',
    ],
    callNine11: 'Call 911 if you are trapped, surrounded by fire, or cannot reach a safe area.',
    difficulty: 'Beginner',
    timeToLearn: '15 min',
    refreshCycle: '90 days',
  },
];

export default function SkillsPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <SkillsPage />
    </Suspense>
  );
}

function SkillsPage() {
  const params = useSearchParams();
  const incidentParam = params.get('incident');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  // ── SKILL DETAIL VIEW ──
  if (selectedSkill) {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <button
            onClick={() => setSelectedSkill(null)}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-bold">{selectedSkill.emoji} {selectedSkill.title}</h1>
            <p className="text-xs text-slate-400">{selectedSkill.subtitle}</p>
          </div>
        </header>

        {/* Incident banner */}
        {incidentParam && (
          <div className="mx-4 mt-3 flex items-center gap-2 bg-amber-900/40 rounded-lg px-3 py-2 border border-amber-700">
            <span className="text-sm">⚠️</span>
            <span className="text-sm text-amber-200 font-medium">Active incident</span>
            <div className="flex-1" />
            <a href={`/help?incident=${incidentParam}`} className="text-xs text-amber-300 underline">Get Help</a>
          </div>
        )}

        <div className="px-4 pt-4 space-y-4">
          {/* Why it matters */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-sm text-slate-300 italic">{selectedSkill.whyItMatters}</p>
          </div>

          {/* Steps */}
          <div>
            <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-3">Steps</h3>
            <ol className="space-y-3">
              {selectedSkill.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-200 pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* When to call 911 */}
          <div className="bg-red-900/40 rounded-xl p-4 border border-red-800">
            <div className="flex items-center gap-2 mb-1">
              <span>📞</span>
              <span className="font-bold text-sm text-red-300">When to call 911</span>
            </div>
            <p className="text-sm text-red-200">{selectedSkill.callNine11}</p>
          </div>

          {/* Metadata */}
          <div className="flex gap-3 text-xs text-slate-400">
            <span className="bg-slate-800 px-2.5 py-1 rounded-lg">{selectedSkill.difficulty}</span>
            <span className="bg-slate-800 px-2.5 py-1 rounded-lg">{selectedSkill.timeToLearn}</span>
            <span className="bg-slate-800 px-2.5 py-1 rounded-lg">Refresh: {selectedSkill.refreshCycle}</span>
          </div>
        </div>

        <div className="h-8" />
      </main>
    );
  }

  // ── SKILL LIST VIEW ──
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <div>
          <h1 className="text-lg font-bold">Life-Saving Skills</h1>
          <p className="text-xs text-slate-400">CEG Core Modules</p>
        </div>
      </header>

      {/* Incident banner */}
      {incidentParam && (
        <div className="mx-4 mt-3 flex items-center gap-2 bg-amber-900/40 rounded-lg px-3 py-2 border border-amber-700">
          <span className="text-sm">⚠️</span>
          <span className="text-sm text-amber-200 font-medium">Active incident</span>
          <div className="flex-1" />
          <a href={`/checkin?incident=${incidentParam}`} className="text-xs text-amber-300 underline mr-2">Check In</a>
          <a href={`/help?incident=${incidentParam}`} className="text-xs text-amber-300 underline">Get Help</a>
        </div>
      )}

      <div className="px-4 pt-4 pb-2">
        <p className="text-sm text-slate-400">
          5 skills that save lives. Each takes 10-20 minutes to learn. No equipment required.
        </p>
      </div>

      <div className="px-4 pb-8 space-y-3">
        {SKILLS.map((skill) => (
          <button
            key={skill.id}
            onClick={() => { track('skill_selected', { skill: skill.id }); setSelectedSkill(skill); }}
            className="w-full flex items-center gap-4 bg-slate-800 rounded-xl px-4 py-4 border border-slate-700 active:bg-slate-700 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center text-2xl shrink-0">
              {skill.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500">{skill.number}</span>
                <span className="text-xs text-slate-500">{skill.category}</span>
              </div>
              <p className="font-bold text-base">{skill.title}</p>
              <p className="text-xs text-slate-400">{skill.subtitle} &middot; {skill.timeToLearn}</p>
            </div>
            <span className="text-slate-500 text-lg">›</span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <footer className="px-4 pb-8 text-center">
        <p className="text-xs text-slate-500">
          CEG &middot; Safety For Generations &middot;{' '}
          <a href="https://sfg.ac" className="underline">sfg.ac</a>
        </p>
      </footer>
    </main>
  );
}
