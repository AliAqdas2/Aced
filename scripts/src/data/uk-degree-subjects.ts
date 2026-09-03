/**
 * Common UK degree subjects, seeded against every university so applicants can
 * always pick a course after selecting their institution.
 *
 * Slugs are the lookup key within a university — changing one adds a duplicate
 * course rather than renaming the existing row.
 */
export interface UkDegreeSubject {
  name: string;
  slug: string;
  level: string;
}

const UNDERGRADUATE = "undergraduate";

export const UK_DEGREE_SUBJECTS: UkDegreeSubject[] = [
  { name: "Accounting and Finance", slug: "accounting-and-finance", level: UNDERGRADUATE },
  { name: "Anthropology", slug: "anthropology", level: UNDERGRADUATE },
  { name: "Archaeology", slug: "archaeology", level: UNDERGRADUATE },
  { name: "Architecture", slug: "architecture", level: UNDERGRADUATE },
  { name: "Art and Design", slug: "art-and-design", level: UNDERGRADUATE },
  { name: "Biochemistry", slug: "biochemistry", level: UNDERGRADUATE },
  { name: "Biological Sciences", slug: "biological-sciences", level: UNDERGRADUATE },
  { name: "Biomedical Science", slug: "biomedical-science", level: UNDERGRADUATE },
  { name: "Business and Management", slug: "business-and-management", level: UNDERGRADUATE },
  { name: "Chemical Engineering", slug: "chemical-engineering", level: UNDERGRADUATE },
  { name: "Chemistry", slug: "chemistry", level: UNDERGRADUATE },
  { name: "Civil Engineering", slug: "civil-engineering", level: UNDERGRADUATE },
  { name: "Classics", slug: "classics", level: UNDERGRADUATE },
  { name: "Computer Science", slug: "computer-science", level: UNDERGRADUATE },
  { name: "Criminology", slug: "criminology", level: UNDERGRADUATE },
  { name: "Dentistry", slug: "dentistry", level: UNDERGRADUATE },
  { name: "Drama and Theatre Studies", slug: "drama-and-theatre-studies", level: UNDERGRADUATE },
  { name: "Economics", slug: "economics", level: UNDERGRADUATE },
  { name: "Education", slug: "education", level: UNDERGRADUATE },
  { name: "Electrical and Electronic Engineering", slug: "electrical-and-electronic-engineering", level: UNDERGRADUATE },
  { name: "English Language", slug: "english-language", level: UNDERGRADUATE },
  { name: "English Literature", slug: "english-literature", level: UNDERGRADUATE },
  { name: "Environmental Science", slug: "environmental-science", level: UNDERGRADUATE },
  { name: "Film and Media Studies", slug: "film-and-media-studies", level: UNDERGRADUATE },
  { name: "Geography", slug: "geography", level: UNDERGRADUATE },
  { name: "Geology", slug: "geology", level: UNDERGRADUATE },
  { name: "History", slug: "history", level: UNDERGRADUATE },
  { name: "History of Art", slug: "history-of-art", level: UNDERGRADUATE },
  { name: "Hospitality and Tourism", slug: "hospitality-and-tourism", level: UNDERGRADUATE },
  { name: "International Relations", slug: "international-relations", level: UNDERGRADUATE },
  { name: "Journalism", slug: "journalism", level: UNDERGRADUATE },
  { name: "Law", slug: "law", level: UNDERGRADUATE },
  { name: "Linguistics", slug: "linguistics", level: UNDERGRADUATE },
  { name: "Marketing", slug: "marketing", level: UNDERGRADUATE },
  { name: "Mathematics", slug: "mathematics", level: UNDERGRADUATE },
  { name: "Mechanical Engineering", slug: "mechanical-engineering", level: UNDERGRADUATE },
  { name: "Medicine", slug: "medicine", level: UNDERGRADUATE },
  { name: "Midwifery", slug: "midwifery", level: UNDERGRADUATE },
  { name: "Modern Languages", slug: "modern-languages", level: UNDERGRADUATE },
  { name: "Music", slug: "music", level: UNDERGRADUATE },
  { name: "Nursing", slug: "nursing", level: UNDERGRADUATE },
  { name: "Pharmacy", slug: "pharmacy", level: UNDERGRADUATE },
  { name: "Philosophy", slug: "philosophy", level: UNDERGRADUATE },
  { name: "Physics", slug: "physics", level: UNDERGRADUATE },
  { name: "Physiotherapy", slug: "physiotherapy", level: UNDERGRADUATE },
  { name: "Politics", slug: "politics", level: UNDERGRADUATE },
  { name: "Psychology", slug: "psychology", level: UNDERGRADUATE },
  { name: "Social Work", slug: "social-work", level: UNDERGRADUATE },
  { name: "Sociology", slug: "sociology", level: UNDERGRADUATE },
  { name: "Software Engineering", slug: "software-engineering", level: UNDERGRADUATE },
  { name: "Sports Science", slug: "sports-science", level: UNDERGRADUATE },
  { name: "Statistics and Data Science", slug: "statistics-and-data-science", level: UNDERGRADUATE },
  { name: "Veterinary Medicine", slug: "veterinary-medicine", level: UNDERGRADUATE },
  { name: "Other", slug: "other", level: UNDERGRADUATE },
];
