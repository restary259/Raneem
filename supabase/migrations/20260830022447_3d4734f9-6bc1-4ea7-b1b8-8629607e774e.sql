DELETE FROM auth.identities i WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = i.user_id);
DELETE FROM auth.sessions s WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);
DELETE FROM auth.refresh_tokens r WHERE r.session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = r.session_id);
DELETE FROM auth.mfa_factors f WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = f.user_id);
DELETE FROM auth.one_time_tokens t WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id);