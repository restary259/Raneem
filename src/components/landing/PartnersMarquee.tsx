
import React from 'react';

const partners = [
    'Technical University of Munich', 
    'RWTH Aachen University', 
    'Karlsruhe Institute of Technology', 
    'TU Berlin',
    'TU Darmstadt',
    'University of Stuttgart',
    'Leibniz University Hannover',
    'TU Braunschweig',
    'Humboldt University of Berlin', 
    'University of Hamburg', 
    'University of Cologne', 
    'Goethe University Frankfurt', 
    'TU Dresden', 
    'University of Bucharest', 
    'Carol Davila University of Medicine and Pharmacy', 
    'Ovidius University', 
    'Yarmouk University', 
    'UMF Jordan', 
    'FU Academy of Languages', 
    'Kapito Academy of Languages'
];

const PartnersMarquee = () => {
    const extendedPartners = [...partners, ...partners];

    return (
        <section className="py-12 bg-secondary">
            <div className="container mx-auto text-center">
                 <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-8">
                    أفضل الجامعات العالمية
                </h2>
                <div className="relative w-full overflow-hidden mask-gradient">
                    <div 
                      className="flex animate-marquee whitespace-nowrap"
                      style={{ animationDuration: '20s' }}
                    >
                        {extendedPartners.map((partner, index) => (
                            <span key={index} className="mx-8 text-xl font-semibold text-muted-foreground">
                                {partner}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PartnersMarquee;
