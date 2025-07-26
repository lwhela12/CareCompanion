import { useState, useEffect } from 'react';
import { FamilyMembers } from '@/components/FamilyMembers';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export function Family() {
  const [familyData, setFamilyData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFamilyData();
  }, []);

  const fetchFamilyData = async () => {
    try {
      const response = await api.get('/api/v1/families');
      if (response.data.families.length > 0) {
        // For now, use the first family
        setFamilyData(response.data.families[0]);
      }
    } catch (err) {
      setError('Failed to load family data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
        {error}
      </div>
    );
  }

  if (!familyData) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700">
        No family found. Please complete onboarding first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{familyData.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Managing care for {familyData.patient.firstName} {familyData.patient.lastName}
        </p>
      </div>

      <FamilyMembers 
        familyId={familyData.id} 
        currentUserRole={familyData.role}
      />
    </div>
  );
}