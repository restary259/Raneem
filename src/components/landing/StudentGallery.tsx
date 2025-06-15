
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";

const StudentGallery = () => {
  const { t } = useTranslation('landing');
  // The 'as' keyword is used here for type assertion.
  const gallery = t('studentGallery', { returnObjects: true }) as { title: string; subtitle: string; students: { name: string; destination: string; image: string }[] };

  if (!gallery || !Array.isArray(gallery.students)) {
    return null;
  }
  
  return (
    <section id="student-gallery" className="py-12 md:py-24 bg-secondary/50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">{gallery.title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{gallery.subtitle}</p>
        </div>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {gallery.students.map((student, index) => (
            <Card 
              key={index} 
              className="group overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 opacity-0 animate-fade-in"
              style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'forwards' }}
            >
              <div className="relative bg-secondary">
                <img 
                  src={student.image} 
                  alt={`Student ${student.name}`}
                  className="w-full h-72 object-contain object-center group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute bottom-0 right-0 p-6 text-white text-right">
                  {student.name && <h3 className="text-xl font-bold">{student.name}</h3>}
                  <p className="text-base font-light">{student.destination}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StudentGallery;
