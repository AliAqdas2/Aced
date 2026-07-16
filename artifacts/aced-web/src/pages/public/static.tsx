import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';

export function HowItWorks() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6 text-center">How Aced Works</h1>
      <p className="text-xl text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
        Your pathway to academic excellence, guided by those who've already aced it.
      </p>

      <div className="grid gap-12 relative">
        {/* Connecting line for desktop */}
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

export function BecomeACreator() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6 text-center">Join as an Ace</h1>
      <p className="text-xl text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
        Monetise your academic success. Join the UK's premium marketplace for top students.
      </p>

      <div className="grid md:grid-cols-2 gap-8 mb-16">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-8">
            <h3 className="font-serif text-2xl font-bold mb-4">Sell Digital Products</h3>
            <ul className="space-y-3 text-muted-foreground mb-6 list-disc pl-5">
              <li>Upload once, sell infinitely</li>
              <li>Revision notes & summaries</li>
              <li>First-class essay examples</li>
              <li>Set your own prices</li>
            </ul>
          </CardContent>
        </Card>
        
        <Card className="bg-secondary/5 border-secondary/20">
          <CardContent className="p-8">
            <h3 className="font-serif text-2xl font-bold mb-4">Offer 1:1 Services</h3>
            <ul className="space-y-3 text-muted-foreground mb-6 list-disc pl-5">
              <li>Set your own hourly rate</li>
              <li>Manage availability seamlessly</li>
              <li>Personal statement reviews</li>
              <li>Interview preparation</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
