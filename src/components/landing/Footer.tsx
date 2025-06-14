
import { Youtube, MessageCircle } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <p className="text-lg italic">
            "May all our students find success, safety, and purpose in every step of their journey abroad."
          </p>
          <p className="text-lg mt-2 font-serif">
            "نسأل الله أن يوفق جميع طلابنا وأن يكتب لهم النجاح والتوفيق في دراستهم وحياتهم الجديدة."
          </p>
        </div>
        <div className="flex justify-center items-center space-x-6 mb-8">
          <a href="#" className="hover:text-primary-foreground/80 transition-colors flex items-center gap-2"><Youtube /> يوتيوب</a>
          <a href="#" className="hover:text-primary-foreground/80 transition-colors flex items-center gap-2"><MessageCircle /> انستغرام</a>
        </div>
        <div className="text-center text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} درب للدراسة الدولية. جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
