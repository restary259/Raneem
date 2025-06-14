
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { MapPin, MessageCircle, Phone } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  whatsapp: z.string().min(10, { message: "Please enter a valid WhatsApp number." }),
  country: z.string({ required_error: "Please select a country." }),
});

const Contact = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", whatsapp: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    toast({
      title: "Form Submitted!",
      description: "We have received your request and will get back to you shortly.",
    });
    form.reset();
  }

  return (
    <section id="contact" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Contact & Booking</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Ready to start your journey? Book a free consultation or send us your questions.
          </p>
        </div>
        <div className="mt-12 grid md:grid-cols-2 gap-12 items-start">
          <div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input placeholder="Your Name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input placeholder="your.email@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="whatsapp" render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Number</FormLabel>
                    <FormControl><Input placeholder="+1234567890" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="country" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country of Interest</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a country" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="germany">Germany</SelectItem>
                        <SelectItem value="romania">Romania</SelectItem>
                        <SelectItem value="jordan">Jordan</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" size="lg">Book a Free Consultation</Button>
              </form>
            </Form>
          </div>
          <div className="space-y-6">
            <div className="bg-background p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Other Ways to Connect</h3>
              <div className="space-y-4">
                <a href="https://wa.me/1234567890" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-primary transition-colors">
                  <Phone className="h-6 w-6" />
                  <span>Chat on WhatsApp</span>
                </a>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MessageCircle className="h-6 w-6" />
                  <span>Live Chat (Coming Soon)</span>
                </div>
              </div>
            </div>
            <div className="bg-background p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Our Offices</h3>
              <div className="mt-4 h-48 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">Map Placeholder</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Contact;
