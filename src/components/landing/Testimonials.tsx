
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  {
    quote: "Thanks to Darb, I got into a top university in Germany with no stress!",
    name: "Ahmed",
    location: "Germany",
    avatar: "https://i.pravatar.cc/150?img=1",
  },
  {
    quote: "The team was very supportive throughout the whole process. Highly recommended!",
    name: "Fatima",
    location: "Romania",
    avatar: "https://i.pravatar.cc/150?img=2",
  },
  {
    quote: "Their guidance for the visa application was invaluable. I couldn't have done it without them.",
    name: "Yousef",
    location: "Jordan",
    avatar: "https://i.pravatar.cc/150?img=3",
  },
];

const Testimonials = () => {
  return (
    <section id="testimonials" className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Success Stories</h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground italic">“{testimonial.quote}”</p>
                <div className="mt-4 flex items-center">
                  <img src={testimonial.avatar} alt={testimonial.name} className="h-12 w-12 rounded-full mr-4" />
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
