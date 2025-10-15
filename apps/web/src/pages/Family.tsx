import { useState, useEffect } from 'react';
import { FamilyMembers } from '@/components/FamilyMembers';
import { PatientPortalAccess } from '@/components/PatientPortalAccess';
import { api } from '@/lib/api';
import { Loader2, Heart } from 'lucide-react';

interface FamilyData {
  id: string;
  name: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
  };
  members: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    relationship: string;
    joinedAt: string;
  }>;
  currentUserRole: string;
}

export function Family() {
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFamilyData();
  }, []);

  const fetchFamilyData = async () => {
    try {
      // First get the user's families
      const familiesResponse = await api.get('/api/v1/families');
      if (familiesResponse.data.families.length > 0) {
        const familyId = familiesResponse.data.families[0].id;
        
        // Then get the detailed family data with members
        const detailsResponse = await api.get(`/api/v1/families/${familyId}`);
        setFamilyData(detailsResponse.data.family);
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

  const patientAge = familyData?.patient.dateOfBirth 
    ? Math.floor((new Date().getTime() - new Date(familyData.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{familyData.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Managing care coordination for your family
        </p>
      </div>

      {/* Care Recipient Card */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Heart className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Caring for</h2>
            <p className="text-2xl font-bold text-gray-900">
              {familyData.patient.firstName} {familyData.patient.lastName}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {patientAge} years old • {familyData.patient.gender === 'male' ? 'Male' : familyData.patient.gender === 'female' ? 'Female' : 'Other'}
            </p>
          </div>
        </div>
      </div>

      {/* Patient Portal Access */}
      <PatientPortalAccess
        familyId={familyData.id}
        patientId={familyData.patient.id}
        patientName={`${familyData.patient.firstName} ${familyData.patient.lastName}`}
      />

      <FamilyMembers
        familyId={familyData.id}
        currentUserRole={familyData.currentUserRole}
        members={familyData.members}
      />
    </div>
  );
}