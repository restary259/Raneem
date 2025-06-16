import { Resend } from "npm:resend@2.0.0";

Deno.serve(async (req) => {
  const { email, full_name } = await req.json();

  const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
  await resend.emails.send({
    from: "Darb Study <onboarding@resend.dev>",
    to: [email],
    subject: "Welcome to Darb Study!",
    html: `<h1>Welcome, ${full_name || 'Student'}!</h1><p>Your account was created successfully. We're excited to have you with us.</p>`,
    text: `Welcome, ${full_name || 'Student'}! Your account was created successfully. We're excited to have you with us.`
  });

  return new Response(JSON.stringify({ success: true }));
});
