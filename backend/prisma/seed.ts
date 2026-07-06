import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MatchDay AI Database...');

  // 1. Clean existing records
  await prisma.translationCache.deleteMany();
  await prisma.chatQuery.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.densityReading.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();

  const venueId = '00000000-0000-0000-0000-000000000000';
  const staffUserId = '00000000-0000-0000-0000-000000000100';

  // 2. Create mock staff user
  const staff = await prisma.user.create({
    data: {
      id: staffUserId,
      role: 'staff',
      preferredLanguage: 'en',
    },
  });
  console.log('Created Staff User:', staff.id);

  // 3. Create Venue
  const venue = await prisma.venue.create({
    data: {
      id: venueId,
      name: 'Estadio Azteca (MatchDay Arena)',
      city: 'Mexico City',
      capacity: 87523,
    },
  });
  console.log('Created Venue:', venue.name);

  // 4. Create Zones
  const zonesToCreate = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      venueId,
      name: 'Gate A Concourse',
      zoneType: 'gate',
      maxCapacity: 5000,
      geoCoordinates: { x: 100, y: 150 },
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      venueId,
      name: 'Gate B Transit',
      zoneType: 'transit',
      maxCapacity: 3000,
      geoCoordinates: { x: 300, y: 150 },
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      venueId,
      name: 'North Transit Link',
      zoneType: 'exit',
      maxCapacity: 4000,
      geoCoordinates: { x: 200, y: 50 },
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      venueId,
      name: 'Concourse North',
      zoneType: 'concourse',
      maxCapacity: 8000,
      geoCoordinates: { x: 200, y: 220 },
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      venueId,
      name: 'Concourse South',
      zoneType: 'concourse',
      maxCapacity: 8000,
      geoCoordinates: { x: 200, y: 350 },
    },
    {
      id: '00000000-0000-0000-0000-000000000006',
      venueId,
      name: 'Concourse Restrooms',
      zoneType: 'restroom',
      maxCapacity: 200,
      geoCoordinates: { x: 80, y: 280 },
    },
    {
      id: '00000000-0000-0000-0000-000000000007',
      venueId,
      name: 'Food Concessions',
      zoneType: 'concession',
      maxCapacity: 600,
      geoCoordinates: { x: 320, y: 280 },
    },
  ];

  for (const zoneData of zonesToCreate) {
    await prisma.zone.create({
      data: zoneData as any,
    });
  }
  console.log('Created Stadium Zones.');

  // 5. Create Initial Density Readings (low/medium capacity levels)
  await prisma.densityReading.create({
    data: {
      zoneId: '00000000-0000-0000-0000-000000000001', // Gate A
      estimatedCount: 600, // 12%
      densityPct: 0.12,
    },
  });

  await prisma.densityReading.create({
    data: {
      zoneId: '00000000-0000-0000-0000-000000000002', // Gate B
      estimatedCount: 1950, // 65%
      densityPct: 0.65,
    },
  });

  await prisma.densityReading.create({
    data: {
      zoneId: '00000000-0000-0000-0000-000000000006', // Restrooms
      estimatedCount: 184, // 92%
      densityPct: 0.92,
    },
  });

  // Create an initial active alert for restrooms since capacity is 92%
  await prisma.alert.create({
    data: {
      zoneId: '00000000-0000-0000-0000-000000000006',
      severity: 'critical',
      aiRecommendation: 'Redirect fans to Concourse North restroom clusters. Deploy volunteer squad delta to assist directing foot traffic.',
    },
  });
  console.log('Created Initial Density Readings and active restroom alert.');

  console.log('Seeding Complete! MatchDay AI is ready for local testing.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
