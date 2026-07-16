import { Card, CardContent } from '@/components/ui/card';

export function Trust() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="font-serif text-4xl font-bold mb-6">Academic Integrity & Trust</h1>
      <div className="prose prose-slate max-w-none">
        <p className="text-xl text-muted-foreground mb-8">
          Aced is built on the foundation of authentic academic achievement. We maintain strict standards to ensure the integrity of our platform and the educational institutions our users attend.
        </p>
        
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-primary mb-2">Our Zero-Tolerance Policy</h3>
            <p>
              Aced does not permit contract cheating, essay writing services, or any activity that violates university plagiarism guidelines. Our platform is for tutoring, revision aids, and learning support.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-4 font-serif">Creator Verification</h2>
            <p>
              Every creator on Aced must verify their academic credentials. When you see the "Verified Creator" badge, it means we have reviewed their transcripts or university documentation to confirm their grades and attendance.
            </p>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold mb-4 font-serif">Approved Content</h2>
            <p>We allow the sale of:</p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Revision notes and study guides created by the student</li>
              <li>Past essays (clearly marked as examples/reference only)</li>
              <li>1:1 tutoring and academic mentoring</li>
              <li>Interview preparation and personal statement reviews</li>
            </ul>
            
            <p>We strictly prohibit:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Writing assignments for another student</li>
              <li>Selling confidential university materials (e.g., unpublished exam papers)</li>
              <li>Completing online tests on behalf of someone else</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FAQs() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="font-serif text-4xl font-bold mb-8">Frequently Asked Questions</h1>
      
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold mb-2">Is Aced allowed by my university?</h3>
          <p className="text-muted-foreground">Yes. Using tutoring services and purchasing revision notes for study purposes is permitted by all UK universities. However, submitting purchased material as your own work is plagiarism and is strictly prohibited.</p>
        </div>
        
        <div>
          <h3 className="text-xl font-bold mb-2">How are creators verified?</h3>
          <p className="text-muted-foreground">Creators must submit official university transcripts or degree certificates during the application process. Our team manually reviews these documents before granting the 'Verified' status.</p>
        </div>
        
        <div>
          <h3 className="text-xl font-bold mb-2">What percentage does Aced take?</h3>
          <p className="text-muted-foreground">Aced takes a standard platform fee to cover payment processing, hosting, and platform maintenance. Creators keep the vast majority of their earnings. See our Creator Terms for specific tier details.</p>
        </div>
        
        <div>
          <h3 className="text-xl font-bold mb-2">Can I get a refund if a session doesn't happen?</h3>
          <p className="text-muted-foreground">Yes. If a creator fails to attend a scheduled session, you are entitled to a full refund. Please contact support within 24 hours of the missed session.</p>
        </div>
      </div>
    </div>
  );
}

export function Privacy() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="font-serif text-4xl font-bold mb-8">Privacy Policy</h1>
      <div className="prose prose-slate max-w-none text-muted-foreground">
        <p className="mb-4">Last updated: {new Date().toLocaleDateString('en-GB')}</p>
        <p className="mb-4">This Privacy Policy describes how Aced collects, uses, and shares your personal information.</p>
        <h3 className="text-xl font-bold text-foreground mt-8 mb-4">Information we collect</h3>
        <p className="mb-4">We collect information you provide directly to us, such as when you create an account, apply to be a creator, or contact support. This includes your name, email address, university affiliation, and academic records (for creators).</p>
        <h3 className="text-xl font-bold text-foreground mt-8 mb-4">How we use your information</h3>
        <p className="mb-4">We use the information we collect to operate, maintain, and improve our services, to process transactions, and to verify creator credentials to maintain platform trust.</p>
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="font-serif text-4xl font-bold mb-8">Terms of Service</h1>
      <div className="prose prose-slate max-w-none text-muted-foreground">
        <p className="mb-4">Welcome to Aced. By accessing or using our platform, you agree to be bound by these Terms of Service.</p>
        <h3 className="text-xl font-bold text-foreground mt-8 mb-4">1. Use of the Platform</h3>
        <p className="mb-4">Aced is a marketplace connecting students with academic tutors and resources. You agree to use the platform in compliance with our Academic Integrity Policy and all applicable university rules.</p>
        <h3 className="text-xl font-bold text-foreground mt-8 mb-4">2. Creator Obligations</h3>
        <p className="mb-4">Creators must provide accurate academic credentials. Creators retain intellectual property rights to their original content but grant Aced a license to host and facilitate the sale of that content.</p>
      </div>
    </div>
  );
}

export function Cookies() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="font-serif text-4xl font-bold mb-8">Cookie Policy</h1>
      <div className="prose prose-slate max-w-none text-muted-foreground">
        <p className="mb-4">Aced uses cookies to improve your experience on our platform.</p>
        <h3 className="text-xl font-bold text-foreground mt-8 mb-4">Essential Cookies</h3>
        <p className="mb-4">These cookies are necessary for the website to function properly. They enable core functionality such as security, network management, and authentication. You cannot disable these.</p>
        <h3 className="text-xl font-bold text-foreground mt-8 mb-4">Analytics Cookies</h3>
        <p className="mb-4">We use analytics cookies to help us understand how visitors interact with our website, helping us improve the user experience.</p>
      </div>
    </div>
  );
}
