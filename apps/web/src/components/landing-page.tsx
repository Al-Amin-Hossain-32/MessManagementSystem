'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  ChevronDown,
  CircleDollarSign,
  HandCoins,
  Lock,
  Menu,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Utensils,
  Users,
  Wallet,
  X,
} from 'lucide-react';

const navItems = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const featureCards = [
  {
    icon: Users,
    title: 'Member management',
    text: 'Keep everyone organised with clear roles, permissions and shared access across the mess.',
    accent: 'from-emerald-500/15 to-emerald-500/0',
  },
  {
    icon: Utensils,
    title: 'Meal tracking',
    text: 'Track daily meals, guest meals, and meal patterns without manual calculation or confusion.',
    accent: 'from-amber-500/15 to-amber-500/0',
  },
  {
    icon: ReceiptText,
    title: 'Expense visibility',
    text: 'Capture purchases, categorise costs and keep every shared expense in one place.',
    accent: 'from-sky-500/15 to-sky-500/0',
  },
  {
    icon: Wallet,
    title: 'Payments & funds',
    text: 'Monitor mess funds, member payments and account balances with a cleaner overview.',
    accent: 'from-violet-500/15 to-violet-500/0',
  },
  {
    icon: BarChart3,
    title: 'Reports & analytics',
    text: 'Review trends, balances and financial movement so decisions are easier and faster.',
    accent: 'from-rose-500/15 to-rose-500/0',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based access',
    text: 'Give owners, managers and members the visibility they need while keeping data organised.',
    accent: 'from-brand/15 to-brand/0',
  },
];

const steps = [
  { number: '01', title: 'Create your mess', text: 'Set up your mess profile and invite the people who manage it.' },
  { number: '02', title: 'Add members', text: 'Organise roles, responsibilities and member access in one simple place.' },
  { number: '03', title: 'Track meals & spending', text: 'Log meals, expenses and all shared costs without manual spreadsheet work.' },
  { number: '04', title: 'Review finances', text: 'Stay on top of balances, records and monthly mess health from a single dashboard.' },
];

const benefits = [
  { icon: Sparkles, title: 'Less manual work', text: 'Reduce repetitive calculation and keep daily operations cleaner.' },
  { icon: BadgeCheck, title: 'Better transparency', text: 'Everyone sees the live status of meals, costs and balances.' },
  { icon: HandCoins, title: 'Cleaner records', text: 'Monthly operations stay structured and easier to review.' },
  { icon: Lock, title: 'Secure collaboration', text: 'Role-based access keeps the right people involved without clutter.' },
];

const pricingPlans = [
  {
    name: 'Free',
    price: '৳0',
    note: 'For smaller messes getting started',
    features: ['Members', 'Meals', 'Expenses', 'Basic mess management'],
    cta: 'Get started',
    highlight: false,
    href: '/register',
  },
  {
    name: 'Pro',
    price: 'Coming soon',
    note: 'Advanced reporting & automation',
    features: ['Advanced reports', 'Automation tools', 'Deeper analytics', 'Priority onboarding'],
    cta: 'Request access',
    highlight: true,
    href: '/register',
  },
  {
    name: 'Business',
    price: 'Coming soon',
    note: 'For larger or multi-site operations',
    features: ['Expanded access', 'Portfolio management', 'Group reporting', 'Custom workflows'],
    cta: 'Talk to us',
    highlight: false,
    href: '/register',
  },
];

const faqs = [
  { question: 'What is MessManagement?', answer: 'MessManagement is a shared living management platform designed to help messes manage members, meals, expenses and financial records in one place.' },
  { question: 'Who is it for?', answer: 'It is built for hostel messes, shared housing communities, student dormitories, and any group managing recurring shared meals and expenses.' },
  { question: 'Can multiple people manage one mess?', answer: 'Yes. The product supports role-based access so owners, managers and members can collaborate with the correct level of visibility.' },
  { question: 'Can I track meals and expenses?', answer: 'Yes. MessManagement includes meal tracking, guest meal handling, expense logging and financial reporting for day-to-day operations.' },
  { question: 'Is it free to get started?', answer: 'The core mess management experience is available for early use, while advanced plans are currently marked as coming soon.' },
];

const trustItems = ['Members', 'Meals', 'Expenses', 'Funds', 'Reports'];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number>(0);

  return (
    <div className="landing-page min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-50 border-b border-line/80 bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-xl px-1 py-1.5 transition-transform hover:scale-[1.01]" aria-label="MessManagement home">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-ink shadow-sm ring-1 ring-brand/10">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-head text-xl font-bold tracking-tight">MessManagement</span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Main navigation">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-medium text-muted transition-colors hover:text-brand">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-brand-soft hover:text-brand">
              Login
            </Link>
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-brand/90 active:translate-y-0">
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink transition-colors hover:border-brand/40 hover:text-brand md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-line/80 bg-surface md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:px-6" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-base font-medium text-ink transition-colors hover:bg-brand-soft hover:text-brand">
                  {item.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 pt-2">
                <Link href="/login" onClick={() => setMenuOpen(false)} className="rounded-xl border border-line px-3 py-2.5 text-center text-sm font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand">
                  Login
                </Link>
                <Link href="/register" onClick={() => setMenuOpen(false)} className="rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-semibold text-brand-ink transition-colors hover:bg-brand/90">
                  Get Started
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,90,72,0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(146,201,184,0.16),_transparent_28%)]" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pb-28 lg:pt-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand-soft px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Built for shared living
              </span>

              <h1 className="mt-6 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                Manage your mess. <span className="text-brand">Without the mess.</span>
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
                Manage members, meals, expenses and shared finances from one simple platform built for real mess life.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-base font-semibold text-brand-ink transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-brand/90 active:translate-y-0">
                  Get Started
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a href="#features" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 py-3 text-base font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand">
                  Explore Features
                </a>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-muted sm:gap-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
                  Secure access
                </div>
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-brand" aria-hidden />
                  Shared finance clarity
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-8 top-8 h-32 w-32 rounded-full bg-brand/10 blur-3xl" aria-hidden />
              <div className="absolute -right-4 bottom-6 h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl" aria-hidden />

              <div className="landing-dashboard relative overflow-hidden rounded-2xl border border-line/80 bg-surface p-4 shadow-[0_10px_34px_rgb(29_43_38/0.08)] sm:p-5">
                <div className="flex items-center justify-between border-b border-line/80 pb-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Mess overview</p>
                    <h2 className="mt-1 font-head text-2xl font-bold text-ink">Oxygen Mess</h2>
                  </div>
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">Active</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-line/80 bg-paper p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted">Monthly fund</p>
                    <p className="mt-2 font-head text-3xl font-bold text-ink">৳ 67,500</p>
                    <p className="mt-1 text-xs text-emerald-600">+ ৳ 4,800 this month</p>
                  </div>
                  <div className="rounded-2xl border border-line/80 bg-paper p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted">Expenses</p>
                    <p className="mt-2 font-head text-3xl font-bold text-ink">৳ 42,680</p>
                    <p className="mt-1 text-xs text-morich">- ৳ 1,240 from last week</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1.25fr_0.75fr]">
                  <div className="rounded-2xl border border-line/80 bg-paper p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.08em] text-muted">Meal summary</p>
                      <span className="text-xs font-semibold text-brand">This week</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        { name: 'Breakfast', value: '92%', color: 'bg-brand' },
                        { name: 'Lunch', value: '88%', color: 'bg-emerald-400' },
                        { name: 'Dinner', value: '79%', color: 'bg-amber-400' },
                      ].map((item) => (
                        <div key={item.name}>
                          <div className="mb-1 flex items-center justify-between text-xs text-muted">
                            <span>{item.name}</span>
                            <span>{item.value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-line">
                            <div className={`h-2 rounded-full ${item.color}`} style={{ width: item.value }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line/80 bg-paper p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted">Members</p>
                    <div className="mt-4 flex items-end justify-between">
                      <span className="font-head text-5xl font-bold text-ink">46</span>
                      <span className="rounded-full bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand">+3 new</span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-muted">
                      <div className="flex items-center justify-between"><span>Managers</span><span className="font-semibold text-ink">4</span></div>
                      <div className="flex items-center justify-between"><span>Boarders</span><span className="font-semibold text-ink">42</span></div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-line/80 bg-paper p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted">Recent activity</p>
                    <span className="text-xs font-semibold text-brand">Live</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {[
                      ['Groceries', '৳ 4,200', 'Today'],
                      ['Rice supply', '৳ 8,500', 'Yesterday'],
                      ['Meal settlement', '৳ 2,300', '2 days ago'],
                    ].map(([label, amount, date]) => (
                      <div key={label} className="flex items-center justify-between rounded-xl border border-line/80 bg-surface px-3 py-2">
                        <div>
                          <p className="font-medium text-ink">{label}</p>
                          <p className="text-xs text-muted">{date}</p>
                        </div>
                        <span className="font-head text-base font-bold text-ink">{amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line/80 bg-white/70">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-center gap-3 text-center md:flex-row md:flex-wrap md:gap-6">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Everything your mess needs</p>
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-ink">
                {trustItems.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5">
                    <BadgeCheck className="h-3.5 w-3.5 text-brand" aria-hidden />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Features</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">A complete mess operating system.</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              From daily meals to monthly fund reviews, every part of shared living is designed to stay organized and transparent.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map(({ icon: Icon, title, text, accent }) => (
              <article key={title} className="group relative overflow-hidden rounded-[24px] border border-line/80 bg-surface p-5 shadow-[0_18px_45px_rgb(29_43_38/0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgb(29_43_38/0.08)]">
                <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accent}`} aria-hidden />
                <div className="relative">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="text-xl font-bold text-ink">{title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-muted">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="bg-[#f3f7f3] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">How it works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Built for everyday operations.</h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {steps.map((step, index) => (
                <div key={step.number} className="relative">
                  {index < steps.length - 1 && <div className="absolute right-[-18px] top-8 hidden h-px w-8 bg-brand/20 xl:block" aria-hidden />}
                  <div className="rounded-[24px] border border-line/80 bg-surface p-5 shadow-[0_18px_45px_rgb(29_43_38/0.04)]">
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">{step.number}</p>
                    <h3 className="mt-4 text-xl font-bold text-ink">{step.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-muted">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Why MessManagement?</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Clearer operations. Less confusion.</h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
                Shared living works best when everyone has the same information. MessManagement gives you a cleaner, calmer way to run the essentials.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {benefits.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-[22px] border border-line/80 bg-surface p-5 shadow-[0_18px_45px_rgb(29_43_38/0.04)]">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="text-lg font-bold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-[#0d2e29] py-20 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-200">Pricing</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Simple pricing for growing messes.</h2>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {pricingPlans.map((plan) => (
                <div key={plan.name} className={`rounded-[26px] border p-6 ${plan.highlight ? 'border-emerald-400/60 bg-white/8 shadow-[0_22px_60px_rgba(16,85,68,0.28)]' : 'border-white/10 bg-white/[0.04]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-bold">{plan.name}</p>
                      <p className="mt-3 text-3xl font-head font-bold">{plan.price}</p>
                    </div>
                    {plan.highlight && <span className="rounded-full bg-emerald-300/15 px-2.5 py-1 text-xs font-semibold text-emerald-100">Popular</span>}
                  </div>
                  <p className="mt-3 text-sm text-white/70">{plan.note}</p>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-white/75">
                        <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-300" aria-hidden />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href} className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition-colors ${plan.highlight ? 'bg-white text-[#0b2a25] hover:bg-emerald-50' : 'border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]'}`}>
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Common questions.</h2>
          </div>

          <div className="mt-10 space-y-3">
            {faqs.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={item.question} className="overflow-hidden rounded-[20px] border border-line/80 bg-surface shadow-[0_12px_35px_rgb(29_43_38/0.04)]">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                  >
                    <span className="text-base font-semibold text-ink sm:text-lg">{item.question}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                  {isOpen && (
                    <div className="border-t border-line/80 px-5 py-4 text-sm leading-relaxed text-muted sm:px-6">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl rounded-[32px] bg-gradient-to-r from-brand via-[#0f6b57] to-[#133e35] px-6 py-12 text-center text-white shadow-[0_30px_90px_rgb(13_62_53/0.28)] sm:px-10 lg:px-14">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-100">Ready to get started?</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Bring members, meals and expenses together in one simple platform.</h2>
            <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-[#0d2e29] shadow-[0_18px_30px_rgba(255,255,255,0.14)] transition-transform hover:-translate-y-0.5">
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/80 bg-surface/80">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-ink">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              <span className="font-head text-xl font-bold text-ink">MessManagement</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              A smarter way to manage shared mess life, from daily operations to money movement.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">Product</p>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li><a href="#features" className="hover:text-brand">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-brand">How it works</a></li>
              <li><a href="#pricing" className="hover:text-brand">Pricing</a></li>
              <li><a href="#faq" className="hover:text-brand">FAQ</a></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">Company</p>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li><Link href="/register" className="hover:text-brand">Get started</Link></li>
              <li><Link href="/login" className="hover:text-brand">Login</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">Legal</p>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li>Privacy</li>
              <li>Terms</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-line/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 text-sm text-muted sm:px-6 lg:px-8">
            <span>© 2026 MessManagement</span>
            <span>Built for better shared living.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
