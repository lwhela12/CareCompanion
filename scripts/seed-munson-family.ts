import { PrismaClient } from '@prisma/client';
import { subDays, addDays, addWeeks, addMonths, format, startOfDay } from 'date-fns';

const prisma = new PrismaClient();

// Test account emails and Clerk IDs (get from Clerk dashboard or logs)
const TEST_ACCOUNTS = {
  nic: {
    email: 'nic@test.com',
    clerkId: 'user_30R4a6QgXh9KtRWxaJBcvuphcnQ' // From your login logs
  },
  michael: {
    email: 'michael@test.com',
    clerkId: null // Will be created with mock ID until real account is made
  },
  jay: {
    email: 'jay@test.com', 
    clerkId: null // Will be created with mock ID until real account is made
  }
};

async function findOrCreateUserByEmail(email: string, firstName: string, lastName: string, clerkId?: string) {
  // First try to find existing user by email
  let user = await prisma.user.findUnique({
    where: { email }
  });
  
  if (user) {
    console.log(`✅ Found existing user: ${user.firstName} ${user.lastName}`);
    return user;
  }
  
  // Try to find by clerkId if provided
  if (clerkId) {
    user = await prisma.user.findUnique({
      where: { clerkId }
    });
    
    if (user) {
      console.log(`✅ Found user by Clerk ID, updating email: ${user.firstName} ${user.lastName}`);
      // Update the user with the correct email
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email, firstName, lastName }
      });
      return user;
    }
  }
  
  // If no user found, create one (assumes Clerk account exists)
  console.log(`🔧 Creating CareCompanion user record for ${email}...`);
  
  // Generate a mock Clerk ID if not provided (for testing)
  const generatedClerkId = clerkId || `user_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    user = await prisma.user.create({
      data: {
        clerkId: generatedClerkId,
        email,
        firstName,
        lastName
      }
    });
    
    console.log(`✅ Created user: ${user.firstName} ${user.lastName}`);
    return user;
  } catch (error: any) {
    if (error.code === 'P2002') {
      // Unique constraint failed, try to find the conflicting user
      console.log(`⚠️  User creation failed due to unique constraint, searching for existing user...`);
      
      if (error.meta?.target?.includes('email')) {
        user = await prisma.user.findUnique({ where: { email } });
      } else if (error.meta?.target?.includes('clerk_id')) {
        user = await prisma.user.findUnique({ where: { clerkId: generatedClerkId } });
      }
      
      if (user) {
        console.log(`✅ Found conflicting user, using existing: ${user.firstName} ${user.lastName}`);
        return user;
      }
    }
    
    throw error;
  }
}

async function seedMunsonFamily() {
  console.log('🌱 Starting Munson Family seed...');

  try {
    // 1. Find or create CareCompanion user records
    console.log('📧 Looking up test accounts...');
    const nic = await findOrCreateUserByEmail(TEST_ACCOUNTS.nic.email, 'Nic', 'Munson', TEST_ACCOUNTS.nic.clerkId);
    const michael = await findOrCreateUserByEmail(TEST_ACCOUNTS.michael.email, 'Michael', 'McMillan', TEST_ACCOUNTS.michael.clerkId);
    const jay = await findOrCreateUserByEmail(TEST_ACCOUNTS.jay.email, 'Jay', 'Munson', TEST_ACCOUNTS.jay.clerkId);
    
    console.log(`✅ Users ready: ${nic.firstName}, ${michael.firstName}, ${jay.firstName}`);

    // 2. Create family
    console.log('👨‍👩‍👧‍👦 Creating Munson family...');
    const family = await prisma.family.create({
      data: {
        name: 'Munson Family',
        subscriptionTier: 'premium'
      }
    });

    // 3. Create patient (Sue Munson)
    console.log('👵 Creating patient Sue Munson...');
    const patient = await prisma.patient.create({
      data: {
        familyId: family.id,
        firstName: 'Sue',
        lastName: 'Munson',
        dateOfBirth: new Date('1949-03-15'), // 75 years old
        gender: 'female',
        medicalRecordNumber: 'MRN-001234'
      }
    });

    // 4. Create family members
    console.log('👥 Adding family members...');
    await prisma.familyMember.create({
      data: {
        userId: nic.id,
        familyId: family.id,
        role: 'primary_caregiver',
        relationship: 'daughter'
      }
    });

    await prisma.familyMember.create({
      data: {
        userId: michael.id,
        familyId: family.id,
        role: 'caregiver',
        relationship: 'partner of daughter'
      }
    });

    await prisma.familyMember.create({
      data: {
        userId: jay.id,
        familyId: family.id,
        role: 'family_member',
        relationship: 'son'
      }
    });

    // 5. Create medications
    console.log('💊 Creating medication regimen...');
    
    // Chronic medications
    const donepezil = await prisma.medication.create({
      data: {
        patientId: patient.id,
        name: 'Donepezil (Aricept)',
        dosage: '10mg',
        frequency: 'Once daily',
        scheduleTime: ['08:00'],
        instructions: 'Take with breakfast to reduce stomach upset',
        prescribedBy: 'Dr. Sarah Chen (Neurologist)',
        startDate: subDays(new Date(), 180),
        isActive: true,
        createdById: nic.id,
        currentSupply: 25,
        dosageAmount: 10,
        dosageUnit: 'mg',
        lastRefillDate: subDays(new Date(), 10),
        refillThreshold: 7
      }
    });

    const memantine = await prisma.medication.create({
      data: {
        patientId: patient.id,
        name: 'Memantine (Namenda)',
        dosage: '10mg',
        frequency: 'Twice daily',
        scheduleTime: ['08:00', '20:00'],
        instructions: 'Take with or without food',
        prescribedBy: 'Dr. Sarah Chen (Neurologist)',
        startDate: subDays(new Date(), 120),
        isActive: true,
        createdById: nic.id,
        currentSupply: 45,
        dosageAmount: 10,
        dosageUnit: 'mg',
        lastRefillDate: subDays(new Date(), 15),
        refillThreshold: 7
      }
    });

    const lisinopril = await prisma.medication.create({
      data: {
        patientId: patient.id,
        name: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        scheduleTime: ['08:00'],
        instructions: 'Take in the morning, monitor blood pressure',
        prescribedBy: 'Dr. James Martinez (Primary Care)',
        startDate: subDays(new Date(), 365),
        isActive: true,
        createdById: nic.id,
        currentSupply: 22,
        dosageAmount: 10,
        dosageUnit: 'mg',
        lastRefillDate: subDays(new Date(), 8),
        refillThreshold: 7
      }
    });

    const atorvastatin = await prisma.medication.create({
      data: {
        patientId: patient.id,
        name: 'Atorvastatin (Lipitor)',
        dosage: '20mg',
        frequency: 'Once daily',
        scheduleTime: ['20:00'],
        instructions: 'Take in the evening with dinner',
        prescribedBy: 'Dr. James Martinez (Primary Care)',
        startDate: subDays(new Date(), 200),
        isActive: true,
        createdById: nic.id,
        currentSupply: 18,
        dosageAmount: 20,
        dosageUnit: 'mg',
        lastRefillDate: subDays(new Date(), 12),
        refillThreshold: 7
      }
    });

    // Temporary UTI medication
    const nitrofurantoin = await prisma.medication.create({
      data: {
        patientId: patient.id,
        name: 'Nitrofurantoin',
        dosage: '100mg',
        frequency: 'Twice daily',
        scheduleTime: ['08:00', '20:00'],
        instructions: 'Take with meals for 7 days. Complete full course.',
        prescribedBy: 'Dr. James Martinez (Primary Care)',
        startDate: subDays(new Date(), 18),
        endDate: addDays(new Date(), 3), // Almost finished
        isActive: true,
        createdById: nic.id,
        currentSupply: 6,
        dosageAmount: 100,
        dosageUnit: 'mg',
        lastRefillDate: subDays(new Date(), 18),
        refillThreshold: 2
      }
    });

    // 6. Create medication logs (past 3 months)
    console.log('📝 Creating medication logs...');
    const medications = [donepezil, memantine, lisinopril, atorvastatin, nitrofurantoin];
    
    for (let dayOffset = 90; dayOffset >= 0; dayOffset--) {
      const logDate = subDays(new Date(), dayOffset);
      
      for (const medication of medications) {
        // Skip if medication wasn't active yet
        if (logDate < medication.startDate) continue;
        if (medication.endDate && logDate > medication.endDate) continue;
        
        for (const timeSlot of medication.scheduleTime) {
          const [hours, minutes] = timeSlot.split(':').map(Number);
          const scheduledTime = new Date(logDate);
          scheduledTime.setHours(hours, minutes, 0, 0);
          
          // Only create logs for past times
          if (scheduledTime > new Date()) continue;
          
          // Determine status based on various factors
          let status: 'GIVEN' | 'MISSED' | 'REFUSED' = 'GIVEN';
          let givenById = nic.id;
          let givenTime = scheduledTime;
          let notes = '';
          
          // Increased confusion and missed meds in last 3 weeks (UTI period)
          const isUTIPeriod = dayOffset <= 21;
          const isRecentMemoryWorse = dayOffset <= 14;
          
          // Random factors for realistic variation
          const random = Math.random();
          
          if (isRecentMemoryWorse && random < 0.15) {
            status = 'REFUSED';
            notes = 'Confused about why she needs to take this medication';
            givenTime = null;
            givenById = null;
          } else if (isUTIPeriod && random < 0.1) {
            status = 'MISSED';
            notes = 'Forgot due to confusion from UTI';
            givenTime = null;
            givenById = null;
          } else if (random < 0.05) {
            status = 'MISSED';
            notes = '';
            givenTime = null;
            givenById = null;
          } else {
            // Determine who gave the medication
            if (timeSlot === '20:00' && random < 0.4) {
              givenById = michael.id; // Michael often handles evening meds
            }
            
            // Add some delay for realism
            if (random < 0.3) {
              givenTime = new Date(scheduledTime.getTime() + (Math.random() * 60 * 60 * 1000)); // Up to 1 hour late
            }
          }
          
          await prisma.medicationLog.create({
            data: {
              medicationId: medication.id,
              scheduledTime,
              givenTime,
              givenById,
              status,
              notes
            }
          });
        }
      }
    }

    // 7. Create journal entries (past 3 months)
    console.log('📔 Creating journal entries...');
    
    const journalEntries = [
      // Recent entries (last 2 weeks) - UTI and severe memory issues
      {
        daysAgo: 1,
        authorId: nic.id,
        content: "Mom had a really rough day today. She asked me who I was three times within an hour. The UTI seems to be clearing up physically, but her memory is so much worse now. Dr. Martinez says this can happen but I'm scared it won't get better. She refused her evening Aricept again - said she doesn't need 'more pills.' Michael was great helping me stay calm.",
        sentiment: 'concerned' as const,
        isPrivate: false
      },
      {
        daysAgo: 3,
        authorId: michael.id,
        content: "Took Sue to her cardiology follow-up today. Dr. Peterson is happy with her blood pressure numbers on the current dose of Lisinopril. Sue was confused about why we were there and kept asking to go home, but the appointment went smoothly overall. Her cholesterol levels look good too.",
        sentiment: 'neutral' as const,
        isPrivate: false
      },
      {
        daysAgo: 5,
        authorId: nic.id,
        content: "I'm exhausted. Mom woke me up at 3 AM asking where Dad was (he passed 8 years ago). This is happening more frequently since the UTI. I know I need to be patient but I feel like I'm losing her more each day. I can't keep doing this alone. Maybe it's time to talk about more help.",
        sentiment: 'concerned' as const,
        isPrivate: true
      },
      {
        daysAgo: 7,
        authorId: jay.id,
        content: "Visited Mom yesterday. The difference since my last visit 3 weeks ago is dramatic. She didn't recognize me for the first 10 minutes. Nic looks exhausted and stressed. I need to figure out how to help more from here. Maybe I can drive up every other weekend instead of monthly.",
        sentiment: 'concerned' as const,
        isPrivate: false
      },
      {
        daysAgo: 10,
        authorId: nic.id,
        content: "Small victory - Mom took all her medications today without resistance! The antibiotic seems to be helping. She even remembered my name when I arrived this morning. Hoping this means she's turning a corner.",
        sentiment: 'positive' as const,
        isPrivate: false
      },
      {
        daysAgo: 12,
        authorId: michael.id,
        content: "Sue had another confused episode this evening. She thought she was late for work (she retired 10 years ago) and got quite agitated. Took about 20 minutes to calm her down. These episodes are definitely getting more frequent.",
        sentiment: 'concerned' as const,
        isPrivate: false
      },
      {
        daysAgo: 18,
        authorId: nic.id,
        content: "Emergency doctor visit today. Mom has a UTI which explains the sudden increase in confusion and agitation. Started on antibiotics. Dr. Martinez says UTIs can cause temporary cognitive decline in elderly patients, especially those with existing dementia. Hoping this helps.",
        sentiment: 'concerned' as const,
        isPrivate: false
      },
      
      // Mid-period entries (3-8 weeks ago) - Gradual decline
      {
        daysAgo: 25,
        authorId: nic.id,
        content: "Mom seems more confused lately. She keeps asking the same questions over and over. Yesterday she asked me 'when are we going home?' while sitting in her own living room. Dr. Chen wants to see her next month to discuss adjusting her Aricept dosage.",
        sentiment: 'concerned' as const,
        isPrivate: false
      },
      {
        daysAgo: 32,
        authorId: jay.id,
        content: "Good visit with Mom today. She was more like herself - we looked through old photo albums and she remembered lots of stories about when Nic and I were kids. These moments are precious. She did ask about Dad a few times though.",
        sentiment: 'positive' as const,
        isPrivate: false
      },
      {
        daysAgo: 38,
        authorId: michael.id,
        content: "Sue had a great day at physical therapy. Her balance is improving and she was chatty with the therapist. Small wins! Her evening meds went smoothly too.",
        sentiment: 'positive' as const,
        isPrivate: false
      },
      {
        daysAgo: 45,
        authorId: nic.id,
        content: "Feeling overwhelmed today. Mom got lost in her own house this morning - found her in the closet looking for the bathroom. I love her so much but this is getting harder. Grateful for Michael's support but I feel guilty putting this on him too.",
        sentiment: 'concerned' as const,
        isPrivate: true
      },
      {
        daysAgo: 52,
        authorId: nic.id,
        content: "Neurology appointment went well. Dr. Chen is pleased that Mom is tolerating the Memantine well. No major side effects and her mood seems stable. We discussed what to expect as the disease progresses. It's scary but good to be prepared.",
        sentiment: 'neutral' as const,
        isPrivate: false
      },
      
      // Earlier entries (2-3 months ago) - Better baseline
      {
        daysAgo: 65,
        authorId: jay.id,
        content: "Great weekend visit! Mom was sharp and we had wonderful conversations. She even beat me at Scrabble (again). Her medications seem to be working well. Nic is doing an amazing job taking care of her.",
        sentiment: 'positive' as const,
        isPrivate: false
      },
      {
        daysAgo: 72,
        authorId: michael.id,
        content: "Sue helped me make her famous chocolate chip cookies today. She remembered the recipe perfectly and was so proud. Moments like these remind us that she's still very much herself in many ways.",
        sentiment: 'positive' as const,
        isPrivate: false
      },
      {
        daysAgo: 80,
        authorId: nic.id,
        content: "Mom had her quarterly neurologist appointment. Dr. Chen says her cognitive scores are stable compared to 3 months ago. The Aricept and Memantine combination seems to be helping maintain her current level. Relieved.",
        sentiment: 'neutral' as const,
        isPrivate: false
      },
      {
        daysAgo: 85,
        authorId: nic.id,
        content: "Really good day with Mom. We went grocery shopping together and she helped me pick out ingredients for dinner. She was social with the cashier and seemed happy. These are the days I try to hold onto.",
        sentiment: 'positive' as const,
        isPrivate: false
      }
    ];

    for (const entry of journalEntries) {
      await prisma.journalEntry.create({
        data: {
          familyId: family.id,
          userId: entry.authorId,
          content: entry.content,
          sentiment: entry.sentiment,
          isPrivate: entry.isPrivate,
          createdAt: subDays(new Date(), entry.daysAgo),
          attachmentUrls: []
        }
      });
    }

    // 8. Create upcoming appointments (next 3 months)
    console.log('📅 Creating upcoming appointments...');
    
    const upcomingAppointments = [
      // This week
      {
        title: 'Primary Care Follow-up',
        description: '🏥 Follow-up for UTI treatment and general check-up\n📍 Valley Medical Center\nDr. James Martinez',
        daysFromNow: 3,
        assignedToId: nic.id,
        priority: 'HIGH' as const
      },
      {
        title: 'Physical Therapy Session',
        description: '🏥 Balance and mobility therapy\n📍 Rehab Solutions\nTherapist: Maria Santos',
        daysFromNow: 5,
        assignedToId: michael.id,
        priority: 'MEDIUM' as const
      },
      
      // Next week
      {
        title: 'Jay Weekend Visit',
        description: '👨‍👩‍👧‍👦 Jay visiting from out of town\nFamily time and support',
        daysFromNow: 10,
        assignedToId: jay.id,
        priority: 'MEDIUM' as const
      },
      {
        title: 'Physical Therapy Session',
        description: '🏥 Balance and mobility therapy\n📍 Rehab Solutions\nTherapist: Maria Santos',
        daysFromNow: 12,
        assignedToId: michael.id,
        priority: 'MEDIUM' as const
      },
      
      // Month 1
      {
        title: 'Neurology Appointment',
        description: '🧠 Regular follow-up with Dr. Chen\n📍 Northwest Neurology Center\nAssess medication effectiveness and cognitive status',
        daysFromNow: 18,
        assignedToId: nic.id,
        priority: 'HIGH' as const
      },
      {
        title: 'Cardiology Follow-up',
        description: '🏥 Blood pressure and heart health check\n📍 Heart & Vascular Clinic\nDr. Peterson',
        daysFromNow: 25,
        assignedToId: michael.id,
        priority: 'HIGH' as const
      },
      {
        title: 'Lab Work',
        description: '🔬 Quarterly blood work\n📍 Valley Medical Lab\nCholesterol, kidney function, liver enzymes',
        daysFromNow: 32,
        assignedToId: nic.id,
        priority: 'HIGH' as const
      },
      
      // Month 2
      {
        title: 'Eye Exam',
        description: '🏥 Annual eye examination\n📍 Vision Care Associates\nDr. Williams',
        daysFromNow: 45,
        assignedToId: nic.id,
        priority: 'MEDIUM' as const
      },
      {
        title: 'Neurology Follow-up',
        description: '🧠 3-month follow-up with Dr. Chen\n📍 Northwest Neurology Center\nMedication review and cognitive assessment',
        daysFromNow: 52,
        assignedToId: nic.id,
        priority: 'HIGH' as const
      },
      {
        title: 'Social Worker Visit',
        description: '👥 Monthly check-in with Sarah Kim\nResources and support planning',
        daysFromNow: 60,
        assignedToId: nic.id,
        priority: 'MEDIUM' as const
      },
      
      // Month 3
      {
        title: 'Primary Care Appointment',
        description: '🏥 Quarterly check-up\n📍 Valley Medical Center\nDr. James Martinez',
        daysFromNow: 75,
        assignedToId: nic.id,
        priority: 'HIGH' as const
      },
      {
        title: 'Physical Therapy Evaluation',
        description: '🏥 Quarterly assessment and plan update\n📍 Rehab Solutions\nTherapist: Maria Santos',
        daysFromNow: 82,
        assignedToId: michael.id,
        priority: 'MEDIUM' as const
      },
      {
        title: 'Family Care Planning Meeting',
        description: '👨‍👩‍👧‍👦 Family discussion about care needs\nJay visiting for planning session',
        daysFromNow: 85,
        assignedToId: nic.id,
        priority: 'HIGH' as const
      }
    ];

    for (const appointment of upcomingAppointments) {
      const dueDate = addDays(new Date(), appointment.daysFromNow);
      dueDate.setHours(appointment.title.includes('Visit') ? 10 : 14, 0, 0, 0); // 10 AM for visits, 2 PM for appointments
      
      await prisma.careTask.create({
        data: {
          familyId: family.id,
          title: appointment.title,
          description: appointment.description,
          dueDate,
          assignedToId: appointment.assignedToId,
          createdById: nic.id,
          priority: appointment.priority,
          status: 'PENDING'
        }
      });
    }

    // 9. Create some daily care tasks
    console.log('✅ Creating daily care tasks...');
    
    const dailyTasks = [
      {
        title: 'Morning Medication Check',
        description: 'Ensure all morning medications are taken with breakfast',
        assignedToId: nic.id,
        priority: 'HIGH' as const
      },
      {
        title: 'Evening Medication Reminder',
        description: 'Help with evening medications (Memantine, Atorvastatin, Nitrofurantoin)',
        assignedToId: michael.id,
        priority: 'HIGH' as const
      },
      {
        title: 'Blood Pressure Check',
        description: 'Weekly blood pressure monitoring',
        assignedToId: nic.id,
        priority: 'MEDIUM' as const
      }
    ];

    for (const task of dailyTasks) {
      // Create tasks for the next week
      for (let day = 1; day <= 7; day++) {
        const dueDate = addDays(new Date(), day);
        
        if (task.title.includes('Morning')) {
          dueDate.setHours(8, 30, 0, 0);
        } else if (task.title.includes('Evening')) {
          dueDate.setHours(20, 30, 0, 0);
        } else if (task.title.includes('Blood Pressure') && day % 7 !== 0) {
          continue; // Only weekly
        } else {
          dueDate.setHours(12, 0, 0, 0);
        }
        
        await prisma.careTask.create({
          data: {
            familyId: family.id,
            title: task.title,
            description: task.description,
            dueDate,
            assignedToId: task.assignedToId,
            createdById: nic.id,
            priority: task.priority,
            status: 'PENDING'
          }
        });
      }
    }

    console.log('✅ Munson family seed completed successfully!');
    console.log(`
📊 Summary:
   👨‍👩‍👧‍👦 Family: ${family.name}
   👵 Patient: Sue Munson (75 years old)
   👥 Caregivers: Nic (primary), Michael (partner), Jay (son)
   💊 Medications: 5 active (3 chronic, 2 UTI treatment)
   📔 Journal Entries: ${journalEntries.length} entries over 3 months
   📅 Appointments: ${upcomingAppointments.length} upcoming appointments
   ✅ Daily Tasks: Medication reminders and care tasks

🔐 Login with:
   - nic@test.com (Primary caregiver, full access)
   - michael@test.com (Partner, handles appointments)  
   - jay@test.com (Brother, mostly read-only, periodic visits)

💡 Note: If using accounts that haven't completed CareCompanion onboarding,
   CareCompanion user records were created automatically. You can now log in
   and the accounts will be linked to this family data.
    `);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedMunsonFamily();
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { seedMunsonFamily };