
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface FilterModalProps {
  onClose: () => void;
}

const FilterModal: React.FC<FilterModalProps> = ({ onClose }) => {
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [studyFields, setStudyFields] = useState<string[]>([]);

  const contentTypeOptions = [
    'Scholarships',
    'Announcements', 
    'Programs',
    'Success Stories',
    'Events'
  ];

  const countryOptions = [
    'Canada',
    'USA',
    'UK',
    'Australia', 
    'Germany',
    'France'
  ];

  const studyFieldOptions = [
    'Computer Science',
    'Medicine',
    'Engineering',
    'Business',
    'Arts'
  ];

  const handleContentTypeChange = (type: string, checked: boolean) => {
    if (checked) {
      setContentTypes([...contentTypes, type]);
    } else {
      setContentTypes(contentTypes.filter(t => t !== type));
    }
  };

  const handleCountryChange = (country: string, checked: boolean) => {
    if (checked) {
      setCountries([...countries, country]);
    } else {
      setCountries(countries.filter(c => c !== country));
    }
  };

  const handleStudyFieldChange = (field: string, checked: boolean) => {
    if (checked) {
      setStudyFields([...studyFields, field]);
    } else {
      setStudyFields(studyFields.filter(f => f !== field));
    }
  };

  const clearAll = () => {
    setContentTypes([]);
    setCountries([]);
    setStudyFields([]);
  };

  const applyFilters = () => {
    // Apply filters logic here
    onClose();
  };

  return (
    <div className="space-y-6">
      {/* Content Type */}
      <div>
        <h3 className="font-semibold mb-3">Content Type</h3>
        <div className="space-y-3">
          {contentTypeOptions.map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={`content-${type}`}
                checked={contentTypes.includes(type)}
                onCheckedChange={(checked) => 
                  handleContentTypeChange(type, checked as boolean)
                }
              />
              <Label htmlFor={`content-${type}`} className="text-sm">
                {type}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Countries */}
      <div>
        <h3 className="font-semibold mb-3">Countries</h3>
        <div className="space-y-3">
          {countryOptions.map((country) => (
            <div key={country} className="flex items-center space-x-2">
              <Checkbox
                id={`country-${country}`}
                checked={countries.includes(country)}
                onCheckedChange={(checked) => 
                  handleCountryChange(country, checked as boolean)
                }
              />
              <Label htmlFor={`country-${country}`} className="text-sm">
                {country}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Study Fields */}
      <div>
        <h3 className="font-semibold mb-3">Study Fields</h3>
        <div className="space-y-3">
          {studyFieldOptions.map((field) => (
            <div key={field} className="flex items-center space-x-2">
              <Checkbox
                id={`field-${field}`}
                checked={studyFields.includes(field)}
                onCheckedChange={(checked) => 
                  handleStudyFieldChange(field, checked as boolean)
                }
              />
              <Label htmlFor={`field-${field}`} className="text-sm">
                {field}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={clearAll} className="flex-1">
          Clear All
        </Button>
        <Button onClick={applyFilters} className="flex-1">
          Apply Filters
        </Button>
      </div>
    </div>
  );
};

export default FilterModal;
