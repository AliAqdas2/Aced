import { Link } from 'wouter';

export function Footer() {
  return (
    <footer className="bg-[#0F1A3C] text-white py-12 md:py-16 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-1">
            <h3 className="font-serif text-2xl font-bold mb-4">Aced</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-xs">
              Learn. Achieve. Ace. The premium UK marketplace for top university students to sell tutoring sessions and digital study materials.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-4 text-gray-200">Discover</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><Link href="/search" className="hover:text-white transition-colors">Search Listings</Link></li>
              <li><Link href="/universities/oxford" className="hover:text-white transition-colors">Oxford Tutors</Link></li>
              <li><Link href="/universities/cambridge" className="hover:text-white transition-colors">Cambridge Tutors</Link></li>
              <li><Link href="/universities/ucl" className="hover:text-white transition-colors">UCL Tutors</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-4 text-gray-200">Platform</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><Link href="/how-it-works" className="hover:text-white transition-colors">How it Works</Link></li>
              <li><Link href="/become-a-creator" className="hover:text-white transition-colors">Become a Creator</Link></li>
              <li><Link href="/trust" className="hover:text-white transition-colors">Trust & Integrity</Link></li>
              <li><Link href="/faqs" className="hover:text-white transition-colors">FAQs</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-4 text-gray-200">Legal</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Aced Marketplace. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-white transition-colors">Twitter</span>
            <span className="cursor-pointer hover:text-white transition-colors">LinkedIn</span>
            <span className="cursor-pointer hover:text-white transition-colors">Instagram</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
