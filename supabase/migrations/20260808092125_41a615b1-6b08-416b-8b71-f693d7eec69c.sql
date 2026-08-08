UPDATE public.cases
SET assigned_to = 'ebe99acb-8f75-4d7e-a175-c0b5bccd8d97'
WHERE full_name IN ('Adam Khalil (DEMO)','Lina Mansour (DEMO)','Omar Haddad (DEMO)')
  AND assigned_to IS NULL;