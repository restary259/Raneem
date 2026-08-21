DELETE FROM auth.identities i
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = i.user_id);