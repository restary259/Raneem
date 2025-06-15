import { useTranslation } from "react-i18next";
import AnimatedCounter from "@/components/landing/AnimatedCounter";
const AboutCustom = () => {
  const {
    t
  } = useTranslation('landing');
  const stats = [{
    value: "1500",
    label: "طالب راض",
    suffix: "+"
  }, {
    value: "16",
    label: "شريك تعليمي",
    suffix: "+"
  }, {
    value: "8",
    label: "دول حول العالم",
    suffix: "+"
  }, {
    value: "98",
    label: "نسبة النجاح",
    suffix: "%"
  }];
  return;
};
export default AboutCustom;