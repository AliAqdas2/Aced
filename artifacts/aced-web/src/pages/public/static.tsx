import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { CreatorApplicationForm } from '@/pages/apply/apply';

export function HowItWorks() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6 text-center">How Aced Works</h1>
      <p className="text-xl text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
        Your pathway to academic excellence, guided by those who've already aced it.
      </p>

      <div className="grid gap-12 relative">
        <div className="hidden md:block absolute left-[50%] top-10 bottom-10 w-0.5 bg-border -translate-x-1/2"></div>

        {[
          {
            step: 1,
            title: "Find Your Expert",
            desc: "Search by university, degree, or specific module. Browse verified profiles of top-performing students and recent graduates."
          },
          {
            step: 2,
            title: "Choose Your Format",
            desc: "Need 1:1 guidance? Book a video session. Prefer self-study? Instantly download highly-rated revision notes and essays."
          },
          {
            step: 3,
            title: "Learn & Achieve",
            desc: "Connect securely through our platform. Get the precise insights, structure, and knowledge you need to secure top marks."
          }
        ].map((item, i) => (
          <div key={i} className={`flex flex-col md:flex-row gap-8 items-center ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
            <div className="flex-1 text-center md:text-right w-full">
              {i % 2 === 0 ? (
                <>
                  <h3 className="font-serif text-2xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </>
              ) : <div className="hidden md:block"></div>}
            </div>

            <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shrink-0 z-10 shadow-lg border-4 border-background">
              {item.step}
            </div>

            <div className="flex-1 text-center md:text-left w-full">
              {i % 2 === 1 ? (
                <>
                  <h3 className="font-serif text-2xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </>
              ) : <div className="hidden md:block"></div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BecomeATutor() {
  const { isAuthenticated, isCreator } = useAuth();

  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6 text-center">Become a Tutor</h1>
      <p className="text-xl text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
        Monetise your academic success without giving up learning. One account can tutor one course and still book help on others.
      </p>

      {/* Marketing cards */}
      <div className="grid md:grid-cols-2 gap-8 mb-16">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-8">
            <h3 className="font-serif text-2xl font-bold mb-4">Sell Digital Products</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-muted-foreground">
              {['Upload once, sell infinitely', 'Revision notes & summaries', 'First-class essay examples', 'Set your own prices'].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-secondary/5 border-secondary/20">
          <CardContent className="p-8">
            <h3 className="font-serif text-2xl font-bold mb-4">Offer 1:1 Services</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-muted-foreground">
              {['Set your own hourly rate', 'Manage availability seamlessly', 'Personal statement reviews', 'Interview preparation'].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Application section */}
      <div className="border-t pt-16">
        <div className="text-center mb-10">
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">Apply Now</h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Tell us about the subject you want to teach. Applications are reviewed within 48 hours — applying does not stop you booking help as a student.
          </p>
        </div>

        {isCreator ? (
          /* Approved tutor — still a learner on the same account */
          <Card className="border-primary/20 bg-primary/5 max-w-lg mx-auto">
            <CardContent className="p-10 text-center">
              <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="font-serif text-2xl font-bold mb-2">You're set up to teach</h3>
              <p className="text-muted-foreground mb-6">
                Manage listings, availability, and earnings in Tutor Studio. You can still explore the marketplace and book sessions as a student whenever you need help with another course.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="flex-1 h-12 font-bold">
                  <Link href="/studio">Go to Tutor Studio</Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 h-12 font-bold">
                  <Link href="/search">Keep learning</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !isAuthenticated ? (
          /* Not logged in */
          <Card className="border-border/60 max-w-lg mx-auto">
            <CardContent className="p-10 text-center">
              <h3 className="font-serif text-2xl font-bold mb-2">Create an account first</h3>
              <p className="text-muted-foreground mb-6">
                You need a free Aced account before applying as a tutor.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="flex-1 h-12 font-bold">
                  <Link href="/auth/register">Sign up free</Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 h-12 font-bold">
                  <Link href="/auth/login">Log in</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Logged in, not yet a creator — show the form */
          <CreatorApplicationForm />
        )}
      </div>
    </div>
  );
}

export function Trust() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-3xl">
      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6 text-center">Trust &amp; Safety</h1>
      <p className="text-xl text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
        How we keep Aced safe for every student.
      </p>
      <div className="prose prose-lg mx-auto text-muted-foreground">
        <p>Every tutor on Aced is manually verified before they can publish listings. We check academic credentials and university affiliation to ensure you're learning from someone who genuinely aced the same content.</p>
        <p>All payments are processed securely via Stripe. Aced never stores your card details.</p>
        <p>If something goes wrong with a booking or purchase, our support team reviews every dispute and offers refunds where appropriate.</p>
      </div>
    </div>
  );
}

export function FAQs() {
  const faqs = [
    { q: "Who can become a tutor?", a: "Any UK university student or recent graduate with strong academic results. We accept First Class and Upper Second (2:1) undergrads, and Distinction / Merit postgrads." },
    { q: "How do I get paid?", a: "Tutors are paid out via Stripe Connect. Once your account is verified, earnings are transferred weekly to your bank account." },
    { q: "What can I sell?", a: "Tutoring sessions (1:1 video calls), digital study notes, past paper solutions, essay examples, and group sessions." },
    { q: "Is my personal data safe?", a: "Yes. We never share your personal information with third parties. Payments are handled by Stripe — Aced never sees your card details." },
    { q: "Can I get a refund?", a: "For digital products, refunds are available within 24 hours of purchase if the file hasn't been downloaded. For sessions, cancellations made 24+ hours in advance receive a full refund." },
  ];

  return (
    <div className="container mx-auto px-4 py-20 max-w-3xl">
      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6 text-center">FAQs</h1>
      <p className="text-xl text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
        Common questions about Aced.
      </p>
      <div className="divide-y divide-border">
        {faqs.map((faq, i) => (
          <div key={i} className="py-6">
            <h3 className="font-bold text-lg mb-2">{faq.q}</h3>
            <p className="text-muted-foreground">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Privacy() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-3xl">
      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6 text-center">Privacy Policy</h1>
      <div className="prose prose-lg mx-auto text-muted-foreground space-y-6">
        <p>Aced collects only the information necessary to operate the marketplace: your name, email, university, and academic credentials for creators. We do not sell your data.</p>
        <p>Payment data is handled entirely by Stripe and is never stored on Aced servers.</p>
        <p>You may request deletion of your account and associated data at any time by contacting support.</p>
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-3xl">
      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6 text-center">Terms of Service</h1>
      <div className="prose prose-lg mx-auto text-muted-foreground space-y-6">
        <p>By using Aced you agree to these terms. Tutors must provide accurate academic information. Misrepresentation results in immediate removal.</p>
        <p>Aced takes a platform fee on each transaction. Current rates are available in your Tutor Studio under Earnings.</p>
        <p>Aced reserves the right to remove listings or users that violate community standards.</p>
      </div>
    </div>
  );
}

export function Cookies() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-3xl">
      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6 text-center">Cookie Policy</h1>
      <div className="prose prose-lg mx-auto text-muted-foreground space-y-6">
        <p>Aced uses essential cookies for session management and authentication. We do not use third-party tracking or advertising cookies.</p>
        <p>You can disable cookies in your browser settings, but this will prevent you from staying logged in.</p>
      </div>
    </div>
  );
}
