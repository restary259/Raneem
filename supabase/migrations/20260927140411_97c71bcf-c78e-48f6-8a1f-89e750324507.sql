REVOKE EXECUTE ON FUNCTION public.is_active_team_member(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_office_team_member() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_office_routing_member() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_office_booking_configuration() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.deactivate_office_membership_when_team_role_removed() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.deactivate_office_membership_on_profile_deactivation() FROM authenticated;
