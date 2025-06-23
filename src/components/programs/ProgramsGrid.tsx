
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, Filter, Grid, List, MapPin, Calendar, Star, DollarSign } from 'lucide-react';
import FilterModal from './FilterModal';

interface Program {
  id: string;
  title: string;
  university: string;
  location: string;
  duration: string;
  rating: number;
  price: string;
  tags: string[];
  scholarship?: boolean;
  image?: string;
}

const samplePrograms: Program[] = [
  {
    id: '1',
    title: 'Computer Science',
    university: 'University of Toronto',
    location: 'Canada',
    duration: '4 years',
    rating: 4.8,
    price: '$45,000/year',
    tags: ['CS', 'Canada', 'Bachelor'],
    scholarship: true
  },
  {
    id: '2',
    title: 'Medicine',
    university: 'Oxford University',
    location: 'UK',
    duration: '6 years',
    rating: 4.9,
    price: '$55,000/year',
    tags: ['Medicine', 'UK', 'Bachelor']
  }
];

const ProgramsGrid = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilter, setShowFilter] = useState(false);
  const [programs] = useState<Program[]>(samplePrograms);

  const filteredPrograms = programs.filter(program =>
    program.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    program.university.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Study Programs</h1>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search programs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Dialog open={showFilter} onOpenChange={setShowFilter}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Filter Content</DialogTitle>
              </DialogHeader>
              <FilterModal onClose={() => setShowFilter(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          {filteredPrograms.length} programs found
        </div>
      </div>

      {/* Programs Grid/List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className={`grid gap-6 ${
          viewMode === 'grid' 
            ? 'grid-cols-1 lg:grid-cols-2' 
            : 'grid-cols-1'
        }`}>
          {filteredPrograms.map((program) => (
            <Card key={program.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                    <MapPin className="h-8 w-8 text-gray-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {program.title} - {program.university}
                        </h3>
                        <p className="text-sm text-gray-600">{program.university}</p>
                      </div>
                      {program.scholarship && (
                        <Badge className="bg-green-100 text-green-800">
                          Scholarship
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {program.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {program.duration}
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {program.rating}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {program.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{program.price}</div>
                        <Button size="sm" className="mt-2">
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgramsGrid;
