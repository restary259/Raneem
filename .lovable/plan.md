

# Seed Test Data for Full E2E Flow

## What We'll Create

1. **A new lead** named "Ahmad Test Student" linked to the existing influencer (`056066ad-...`)
2. **A new case** assigned to the team member (`9995bfbb-...`) with status `new`

This gives us a fresh case starting at status `new` so the team member can walk through: **New -> Contacted -> Schedule Appointment -> Complete Profile -> Submit -> Admin Mark Paid -> Verify Earnings**

## Technical Steps

### Step 1: Insert a test lead
```sql
INSERT INTO leads (full_name, phone, passport_type, english_units, math_units, city, education_level, german_level, source_type, source_id, status, eligibility_score, eligibility_reason)
VALUES ('Ahmad Test Student', '0509876543', 'israeli_blue', 5, 5, 'Haifa', 'bagrut', 'intermediate', 'influencer', '056066ad-daee-475f-bb1b-532d3caffaff', 'new', 90, 'High eligibility');
```

### Step 2: Create a case assigned to the team member
```sql
INSERT INTO student_cases (lead_id, assigned_lawyer_id, case_status, assigned_at)
VALUES (<new_lead_id>, '9995bfbb-dc63-4cbb-b696-9852240dd72e', 'new', now());
```

### Step 3: Update lead status to "assigned"
```sql
UPDATE leads SET status = 'assigned' WHERE id = <new_lead_id>;
```

## No Code Changes Required
This is purely a data seeding operation. The existing Team Dashboard code will pick up the new case via real-time subscriptions.

## E2E Test Flow After Seeding

Once the data is seeded, log in as team@gmail.com on /team-dashboard and:

1. See the new case under "New" filter
2. Click "Mark Contacted" to move it to contacted
3. Click "Schedule Appointment" -- the inline dialog opens on the same tab
4. Complete the profile with all required fields + enable Translation Service
5. Submit the case
6. Switch to Admin to mark the case as paid (set translation_fee > 0 first)
7. Verify translation reward appears in the team member's Earnings tab in real-time

