
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSavedPrograms } from '@/hooks/useSavedPrograms';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MapPin, Calendar, Trash2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SavedProgramsPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { savedPrograms, loading, removeProgram } = useSavedPrograms();
  const { toast } = useToast();

  const handleRemoveProgram = async (programId: string) => {
    const success = await removeProgram(programId);
    if (success) {
      toast({
        title: "Program removed",
        description: "Program has been removed from your saved list",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove program",
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Heart className="h-8 w-8 text-red-500" />
            Saved Programs
          </h1>
          <p className="text-gray-600 mt-2">
            Programs you've saved for later review
          </p>
        </div>
        
        {savedPrograms.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Heart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No saved programs yet</h3>
              <p className="text-gray-500 mb-4">
                Start exploring programs and save the ones that interest you
              </p>
              <Button asChild>
                <a href="/educational-programs">
                  Browse Programs
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedPrograms.map((saved) => {
              const program = saved.program_data;
              return (
                <Card key={saved.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{program.name || program.title}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProgram(saved.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {program.institution && (
                        <p className="text-sm text-gray-600 font-medium">
                          {program.institution}
                        </p>
                      )}
                      
                      {program.location && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <MapPin className="h-4 w-4" />
                          {program.location}
                        </div>
                      )}
                      
                      {program.duration && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="h-4 w-4" />
                          {program.duration}
                        </div>
                      )}
                      
                      {program.level && (
                        <Badge variant="secondary">{program.level}</Badge>
                      )}
                      
                      {program.description && (
                        <p className="text-sm text-gray-600 line-clamp-3">
                          {program.description}
                        </p>
                      )}
                      
                      <div className="pt-2">
                        <p className="text-xs text-gray-400">
                          Saved on {new Date(saved.saved_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <Button variant="outline" className="w-full mt-3">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedProgramsPage;
