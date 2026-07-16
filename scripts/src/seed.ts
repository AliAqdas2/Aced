/**
 * Aced seed script — realistic demo data for development
 * Run: pnpm --filter @workspace/scripts run seed
 */
import { db } from "@workspace/db";
import {
  usersTable,
  profilesTable,
  creatorProfilesTable,
  creatorExpertiseTable,
  storefrontsTable,
  listingsTable,
  serviceOffersTable,
  productsTable,
  priceRecordsTable,
  availabilityRulesTable,
  orderItemsTable,
  ordersTable,
  entitlementsTable,
  reviewsTable,
  commissionRulesTable,
  countriesTable,
  universitiesTable,
  coursesTable,
  modulesTable,
  bookingsTable,
  paymentsTable,
  ledgerEntriesTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding Aced database...");

  // --- Countries ---
  const [uk] = await db
    .insert(countriesTable)
    .values({ name: "United Kingdom", code: "GB" })
    .onConflictDoNothing()
    .returning();

  // --- Universities ---
  const uniData = [
    { name: "University of Warwick", slug: "warwick" },
    { name: "University of Oxford", slug: "oxford" },
    { name: "University of Cambridge", slug: "cambridge" },
    { name: "London School of Economics", slug: "lse" },
    { name: "University College London", slug: "ucl" },
    { name: "Durham University", slug: "durham" },
    { name: "University of Bristol", slug: "bristol" },
    { name: "University of Nottingham", slug: "nottingham" },
  ];

  const ukId = uk?.id ?? (await db.select().from(countriesTable).limit(1))[0].id;

  const universities: Record<string, string> = {};
  for (const u of uniData) {
    const [uni] = await db
      .insert(universitiesTable)
      .values({ countryId: ukId, name: u.name, slug: u.slug, status: "active" })
      .onConflictDoNothing()
      .returning();
    if (uni) universities[u.slug] = uni.id;
  }

  // Get existing universities if insert returned nothing (conflict)
  if (Object.keys(universities).length === 0) {
    const existing = await db.select().from(universitiesTable);
    for (const u of existing) universities[u.slug] = u.id;
  } else {
    const existing = await db.select().from(universitiesTable);
    for (const u of existing) {
      if (!universities[u.slug]) universities[u.slug] = u.id;
    }
  }

  // --- Courses ---
  const warwickId = universities["warwick"];
  const oxfordId = universities["oxford"];
  const cambridgeId = universities["cambridge"];
  const lseId = universities["lse"];

  const coursesData = [
    { universityId: warwickId, name: "Law LLB", slug: "law-llb", faculty: "School of Law", level: "undergraduate", durationYears: 3 },
    { universityId: oxfordId, name: "Jurisprudence (Law)", slug: "jurisprudence", faculty: "Faculty of Law", level: "undergraduate", durationYears: 3 },
    { universityId: cambridgeId, name: "Law LLB", slug: "law-llb", faculty: "Faculty of Law", level: "undergraduate", durationYears: 3 },
    { universityId: lseId, name: "Law LLB", slug: "law-llb", faculty: "Law Department", level: "undergraduate", durationYears: 3 },
  ];

  const courseMap: Record<string, string> = {};
  for (const c of coursesData) {
    if (!c.universityId) continue;
    const [course] = await db
      .insert(coursesTable)
      .values(c)
      .onConflictDoNothing()
      .returning();
    if (course) courseMap[`${c.universityId}-${c.slug}`] = course.id;
  }

  // Fill gaps
  const existingCourses = await db.select().from(coursesTable);
  for (const c of existingCourses) courseMap[`${c.universityId}-${c.slug}`] = c.id;

  const warwickLawId = Object.values(courseMap)[0];

  // --- Modules for Warwick Law ---
  const modulesData = [
    { name: "Contract Law", slug: "contract-law", code: "LA101" },
    { name: "Constitutional Law", slug: "constitutional-law", code: "LA102" },
    { name: "Tort Law", slug: "tort-law", code: "LA103" },
    { name: "Criminal Law", slug: "criminal-law", code: "LA104" },
    { name: "Land Law", slug: "land-law", code: "LA201" },
    { name: "Equity and Trusts", slug: "equity-trusts", code: "LA202" },
    { name: "EU Law", slug: "eu-law", code: "LA203" },
    { name: "Jurisprudence", slug: "jurisprudence", code: "LA301" },
  ];

  if (warwickLawId) {
    for (const m of modulesData) {
      await db
        .insert(modulesTable)
        .values({ courseId: warwickLawId, ...m })
        .onConflictDoNothing();
    }
  }

  // --- Commission rules ---
  await db
    .insert(commissionRulesTable)
    .values([
      {
        scope: "global",
        offerType: "service_offer",
        rateBasisPoints: 2000, // 20%
        isActive: true,
        description: "Global rate for live tutoring services",
      },
      {
        scope: "global",
        offerType: "digital_product",
        rateBasisPoints: 1500, // 15%
        isActive: true,
        description: "Global rate for digital products",
      },
    ])
    .onConflictDoNothing();

  // --- Admin user ---
  const adminPasswordHash = await bcrypt.hash("Admin@Aced2026!", 12);
  const [adminUser] = await db
    .insert(usersTable)
    .values({
      email: "admin@aced.co.uk",
      passwordHash: adminPasswordHash,
      emailVerified: true,
      role: "admin",
      status: "active",
    })
    .onConflictDoNothing()
    .returning();

  if (adminUser) {
    await db
      .insert(profilesTable)
      .values({ userId: adminUser.id, displayName: "Aced Admin" })
      .onConflictDoNothing();
  }

  // --- Creator accounts ---
  const creatorPassword = await bcrypt.hash("Creator@Aced2026!", 12);

  const creatorsData = [
    {
      email: "sarah.chen@example.com",
      displayName: "Sarah Chen",
      headline: "Warwick Law First Class — Contract & Tort specialist",
      university: "warwick",
      academicResult: "First Class Honours",
      graduationYear: 2024,
      storefrontSlug: "sarah-chen-law",
      services: [
        {
          title: "1-to-1 Contract Law Tutoring",
          description: "Struggling with offer, acceptance, consideration or terms? I'll break down contract law concepts clearly and help you ace your essays and exams. Having achieved a First from Warwick, I know exactly what markers look for.",
          type: "service_offer" as const,
          price: 4500, // £45
          durationMinutes: 60,
        },
        {
          title: "Comprehensive Contract Law Notes Pack",
          description: "65-page annotated revision notes covering the full Warwick Contract Law curriculum. Includes case summaries, statute analysis, essay frameworks and model answers. Updated for 2024/25.",
          type: "digital_product" as const,
          price: 1999, // £19.99
        },
      ],
    },
    {
      email: "james.okafor@example.com",
      displayName: "James Okafor",
      headline: "LSE Law — Constitutional & Administrative Law expert",
      university: "lse",
      academicResult: "First Class Honours",
      graduationYear: 2023,
      storefrontSlug: "james-okafor-law",
      services: [
        {
          title: "Constitutional Law 1-to-1 Session",
          description: "Comprehensive tutoring covering parliamentary sovereignty, separation of powers, judicial review and human rights. I secured a First at LSE and have helped 50+ students improve their grades.",
          type: "service_offer" as const,
          price: 5500, // £55
          durationMinutes: 60,
        },
      ],
    },
    {
      email: "priya.sharma@example.com",
      displayName: "Priya Sharma",
      headline: "Oxford Jurisprudence First — Law application coaching",
      university: "oxford",
      academicResult: "First Class Honours",
      graduationYear: 2024,
      storefrontSlug: "priya-sharma-law",
      services: [
        {
          title: "Oxford Law Application Coaching",
          description: "Expert coaching for Oxford Law (Jurisprudence) LNAT preparation, personal statement review and interview technique. I scored in the top 5% nationally on LNAT and secured my Oxford place.",
          type: "service_offer" as const,
          price: 7500, // £75
          durationMinutes: 90,
        },
        {
          title: "LNAT Preparation Guide",
          description: "Comprehensive 80-page LNAT preparation guide with timed practice essays, analytical framework and model answers. Developed from my own top 5% LNAT performance.",
          type: "digital_product" as const,
          price: 2499, // £24.99
        },
      ],
    },
    {
      email: "alex.williams@example.com",
      displayName: "Alex Williams",
      headline: "Cambridge Law — Criminal Law and Tort specialist",
      university: "cambridge",
      academicResult: "First Class (Distinction)",
      graduationYear: 2023,
      storefrontSlug: "alex-williams-law",
      services: [
        {
          title: "Criminal Law Intensive Tutoring",
          description: "Deep-dive sessions covering actus reus, mens rea, defences and specific offences. Perfect for exam preparation or coursework. Cambridge First with distinction.",
          type: "service_offer" as const,
          price: 6000, // £60
          durationMinutes: 60,
        },
        {
          title: "Tort Law Complete Revision Notes",
          description: "50-page comprehensive Tort Law revision notes. Covers negligence, duty of care, breach, causation, remoteness, occupiers' liability, defamation and nuisance. All major cases summarised.",
          type: "digital_product" as const,
          price: 1799, // £17.99
        },
      ],
    },
    {
      email: "emma.johnson@example.com",
      displayName: "Emma Johnson",
      headline: "Warwick Law First — Land Law and Equity specialist",
      university: "warwick",
      academicResult: "First Class Honours",
      graduationYear: 2025,
      storefrontSlug: "emma-johnson-law",
      services: [
        {
          title: "Land Law 1-to-1 Tutoring",
          description: "Expert help with registered vs unregistered land, easements, covenants, adverse possession and co-ownership. I scored 85% in my Land Law exam at Warwick.",
          type: "service_offer" as const,
          price: 4000, // £40
          durationMinutes: 60,
        },
        {
          title: "Equity & Trusts Complete Notes",
          description: "Detailed revision notes for the full Equity and Trusts module. Covers express, resulting and constructive trusts, equitable remedies, fiduciary duties and proprietary estoppel.",
          type: "digital_product" as const,
          price: 1499, // £14.99
        },
      ],
    },
  ];

  for (const creatorData of creatorsData) {
    // Create user
    const [user] = await db
      .insert(usersTable)
      .values({
        email: creatorData.email,
        passwordHash: creatorPassword,
        emailVerified: true,
        role: "creator",
        status: "active",
      })
      .onConflictDoNothing()
      .returning();

    if (!user) continue;

    await db
      .insert(profilesTable)
      .values({ userId: user.id, displayName: creatorData.displayName })
      .onConflictDoNothing();

    // Creator profile
    const [cp] = await db
      .insert(creatorProfilesTable)
      .values({
        userId: user.id,
        status: "approved",
        headline: creatorData.headline,
        stripeAccountStatus: "active",
        completedSessions: Math.floor(Math.random() * 50) + 10,
        totalSales: Math.floor(Math.random() * 30) + 5,
        averageRating: 45 + Math.floor(Math.random() * 5), // 4.5-5.0 stored as tenths
        reviewCount: Math.floor(Math.random() * 20) + 5,
        verifiedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    if (!cp) continue;

    // Expertise
    const uniId = universities[creatorData.university];
    if (uniId) {
      await db
        .insert(creatorExpertiseTable)
        .values({
          creatorId: cp.id,
          universityId: uniId,
          courseId: warwickLawId ?? undefined,
          graduationYear: creatorData.graduationYear,
          academicResult: creatorData.academicResult,
          isPrimary: true,
        })
        .onConflictDoNothing();
    }

    // Storefront
    const [storefront] = await db
      .insert(storefrontsTable)
      .values({
        creatorId: cp.id,
        slug: creatorData.storefrontSlug,
        displayName: creatorData.displayName,
        bio: creatorData.headline + ". I'm passionate about helping fellow law students achieve their best results. Book a session or grab my revision materials below.",
        isPublished: true,
        publishedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    if (!storefront) continue;

    // Availability rules (Mon-Fri 9am-6pm UTC, Sat 10am-4pm UTC)
    const dayRules = [
      { dayOfWeek: 1, start: "09:00", end: "18:00" },
      { dayOfWeek: 2, start: "09:00", end: "18:00" },
      { dayOfWeek: 3, start: "09:00", end: "18:00" },
      { dayOfWeek: 4, start: "09:00", end: "18:00" },
      { dayOfWeek: 5, start: "09:00", end: "18:00" },
      { dayOfWeek: 6, start: "10:00", end: "16:00" },
    ];
    for (const rule of dayRules) {
      await db
        .insert(availabilityRulesTable)
        .values({
          creatorId: cp.id,
          dayOfWeek: rule.dayOfWeek,
          startTimeUtc: rule.start,
          endTimeUtc: rule.end,
          isActive: true,
        })
        .onConflictDoNothing();
    }

    // Services / listings
    for (const service of creatorData.services) {
      const [listing] = await db
        .insert(listingsTable)
        .values({
          creatorId: cp.id,
          storefrontId: storefront.id,
          type: service.type,
          title: service.title,
          description: service.description,
          tags: ["law", "uk", creatorData.university],
          primaryUniversityId: uniId,
          primaryCourseId: warwickLawId ?? null,
          status: "published",
          publishedAt: new Date(),
          purchaseCount: Math.floor(Math.random() * 25) + 3,
          viewCount: Math.floor(Math.random() * 200) + 50,
          averageRating: 45 + Math.floor(Math.random() * 5),
          reviewCount: Math.floor(Math.random() * 15) + 2,
        })
        .onConflictDoNothing()
        .returning();

      if (!listing) continue;

      const [price] = await db
        .insert(priceRecordsTable)
        .values({
          listingId: listing.id,
          amountMinorUnits: service.price,
          currency: "GBP",
          isActive: true,
        })
        .onConflictDoNothing()
        .returning();

      if (service.type === "service_offer" && "durationMinutes" in service) {
        await db
          .insert(serviceOffersTable)
          .values({
            listingId: listing.id,
            durationMinutes: service.durationMinutes ?? 60,
            deliveryMode: "online",
            minNoticeHours: 24,
            bookingHorizonDays: 60,
            cancellationHoursNotice: 24,
            bufferMinutesAfter: 15,
          })
          .onConflictDoNothing();
      } else if (service.type === "digital_product") {
        await db
          .insert(productsTable)
          .values({
            listingId: listing.id,
            licenceType: "personal",
            downloadLimit: 5,
            version: "1.0",
          })
          .onConflictDoNothing();
      }
    }
  }

  // --- Learner user ---
  const learnerPasswordHash = await bcrypt.hash("Learner@Aced2026!", 12);
  const [learnerUser] = await db
    .insert(usersTable)
    .values({
      email: "learner@example.com",
      passwordHash: learnerPasswordHash,
      emailVerified: true,
      role: "learner",
      status: "active",
    })
    .onConflictDoNothing()
    .returning();

  if (learnerUser) {
    await db
      .insert(profilesTable)
      .values({ userId: learnerUser.id, displayName: "Demo Learner" })
      .onConflictDoNothing();
  }

  console.log("✅ Seed complete!");
  console.log("\n📋 Test accounts:");
  console.log("  Admin:   admin@aced.co.uk / Admin@Aced2026!");
  console.log("  Creator: sarah.chen@example.com / Creator@Aced2026!");
  console.log("  Creator: james.okafor@example.com / Creator@Aced2026!");
  console.log("  Creator: priya.sharma@example.com / Creator@Aced2026!");
  console.log("  Creator: alex.williams@example.com / Creator@Aced2026!");
  console.log("  Creator: emma.johnson@example.com / Creator@Aced2026!");
  console.log("  Learner: learner@example.com / Learner@Aced2026!");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
