# CareCompanion Seed Scripts

## Munson Family Test Data

This seed script creates realistic test data for the **Munson Family** scenario, perfect for testing and demonstrating CareCompanion's functionality.

### Prerequisites

Before running the seed script, you must create these test accounts in Clerk:

1. **nic@test.com** - Nic Munson (Primary caregiver, daughter)
2. **michael@test.com** - Michael McMillan (Partner, secondary caregiver)  
3. **jay@test.com** - Jay Munson (Brother, family member)

### Running the Seed

```bash
# Install dependencies if needed
npm install

# Run the seed script
npm run seed:munson
```

### What Gets Created

#### 👥 **Family Structure**
- **Sue Munson** (75 years old) - Patient with cognitive decline and recent UTI
- **Nic Munson** - Primary caregiver (daughter), stressed but dedicated
- **Michael McMillan** - Secondary caregiver (Nic's partner), handles appointments
- **Jay Munson** - Family member (son), visits from out of town

#### 💊 **Medications (5 total)**
- **Donepezil (Aricept) 10mg** - Morning, for cognitive decline
- **Memantine (Namenda) 10mg** - Twice daily, for dementia
- **Lisinopril 10mg** - Morning, for blood pressure
- **Atorvastatin (Lipitor) 20mg** - Evening, for cholesterol
- **Nitrofurantoin 100mg** - Twice daily, for UTI (temporary)

#### 📔 **Journal Entries (3 months)**
- **Recent entries** show increased confusion due to UTI
- **Nic's entries** reflect stress and caregiving challenges
- **Michael's entries** focus on appointments and support
- **Jay's entries** show concern from distance and visit updates
- Mix of **private** (Nic's personal struggles) and **shared** entries

#### 📅 **Appointments (3 months ahead)**
- **Regular neurology** appointments (monthly/quarterly)
- **Primary care** follow-ups for UTI and general health
- **Cardiology** appointments for blood pressure/cholesterol
- **Physical therapy** sessions for mobility
- **Family visits** and care planning meetings
- **Lab work** and specialist appointments

#### 📊 **Medication Logs (3 months back)**
- Realistic adherence patterns with some missed doses
- **Increased confusion** during UTI period (last 3 weeks)
- **Different caregivers** logging different medications
- **Notes** explaining missed doses or refusals

### Test Scenarios

#### **Nic's Login (nic@test.com)**
- Full access to all family data
- Most journal entries and medication management
- High stress level reflected in private journal entries
- Primary responsibility for medical appointments

#### **Michael's Login (michael@test.com)**
- Secondary caregiver perspective
- Handles evening medications and some appointments
- Supportive journal entries with different tone
- Focus on practical care tasks

#### **Jay's Login (jay@test.com)**
- Family member with limited hands-on care
- Periodic visit entries and check-ins
- Concerned but distant perspective
- Read-only for most activities

### Realistic Elements

- **Progressive cognitive decline** reflected in journal timeline
- **UTI-related confusion spike** in recent weeks
- **Medication compliance challenges** with memory loss
- **Family stress and coordination** across multiple caregivers
- **Mixed appointment types** (medical, therapy, family)
- **Authentic medication regimen** for 75-year-old with dementia
- **Emotional journaling** with privacy controls

### Cleaning Up

To reset and re-run the seed:

```bash
# This will clear all data and re-run migrations
npm run db:reset

# Then re-run the seed
npm run seed:munson
```

### Adding More Families

To create additional test families, copy `seed-munson-family.ts` and modify:
1. Change the `TEST_ACCOUNTS` emails
2. Update family member names and relationships
3. Adjust medical conditions and medications
4. Modify journal content and appointment types

This approach lets you test different family scenarios and user roles within the same application.