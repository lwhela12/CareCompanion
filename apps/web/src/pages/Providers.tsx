import { useState, useEffect } from 'react';
import {
  User,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Building,
  Loader2,
  AlertTriangle,
  Star,
  Edit2,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { providersApi } from '@/lib/api';
import { ProviderModal } from '@/components/ProviderModal';

interface Provider {
  id: string;
  name: string;
  type: string;
  specialty?: string;
  phone?: string;
  email?: string;
  fax?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  facility?: string;
  department?: string;
  isPrimary: boolean;
  isActive: boolean;
  notes?: string;
  _count?: {
    medications: number;
    recommendations: number;
    journalEntries: number;
  };
}

const providerTypes = [
  { value: '', label: 'All Types' },
  { value: 'PHYSICIAN', label: 'Physician' },
  { value: 'SPECIALIST', label: 'Specialist' },
  { value: 'THERAPIST', label: 'Therapist' },
  { value: 'PHARMACIST', label: 'Pharmacist' },
  { value: 'FACILITY', label: 'Facility' },
  { value: 'OTHER', label: 'Other' },
];

export function Providers() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    filterProviders();
  }, [providers, searchQuery, typeFilter]);

  const fetchProviders = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await providersApi.getAll({ isActive: true });
      setProviders(response.data.providers);
    } catch (err: any) {
      console.error('Failed to fetch providers:', err);
      setError(err.response?.data?.error?.message || 'Failed to load providers');
      toast.error('Failed to load providers');
    } finally {
      setIsLoading(false);
    }
  };

  const filterProviders = () => {
    let filtered = providers;

    // Filter by type
    if (typeFilter) {
      filtered = filtered.filter(p => p.type === typeFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(query) ||
          p.specialty?.toLowerCase().includes(query) ||
          p.facility?.toLowerCase().includes(query)
      );
    }

    setFilteredProviders(filtered);
  };

  const handleAddProvider = () => {
    setSelectedProvider(null);
    setShowModal(true);
  };

  const handleEditProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedProvider(null);
  };

  const handleModalSave = () => {
    setShowModal(false);
    setSelectedProvider(null);
    fetchProviders();
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await providersApi.setPrimary(id);
      toast.success('Primary provider updated');
      fetchProviders();
    } catch (err: any) {
      console.error('Failed to set primary provider:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to update primary provider');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from your providers?`)) {
      return;
    }

    try {
      await providersApi.delete(id);
      toast.success('Provider removed');
      fetchProviders();
    } catch (err: any) {
      console.error('Failed to delete provider:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to remove provider');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Healthcare Providers</h1>
            <p className="mt-2 text-gray-600">
              Manage your healthcare team and contacts
            </p>
          </div>
          <button
            onClick={handleAddProvider}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Provider
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, specialty, or facility..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
            {providerTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading providers</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow-sm">
            <User className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {searchQuery || typeFilter ? 'No matching providers' : 'No providers yet'}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {searchQuery || typeFilter
                ? 'Try adjusting your search or filter.'
                : 'Get started by adding your healthcare providers.'}
            </p>
            {!searchQuery && !typeFilter && (
              <button
                onClick={handleAddProvider}
                className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="mr-2 h-5 w-5" />
                Add First Provider
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProviders.map((provider) => (
              <div
                key={provider.id}
                className="relative rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 hover:shadow-md"
              >
                {/* Primary badge */}
                {provider.isPrimary && (
                  <div className="absolute right-4 top-4">
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                      <Star className="mr-1 h-3 w-3 fill-current" />
                      Primary
                    </span>
                  </div>
                )}

                {/* Provider info */}
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900">{provider.name}</h3>
                  {provider.specialty && (
                    <p className="text-sm text-gray-600">{provider.specialty}</p>
                  )}
                  <div className="mt-1">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                      {providerTypes.find(t => t.value === provider.type)?.label || provider.type}
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-2 text-sm text-gray-600">
                  {provider.phone && (
                    <div className="flex items-center">
                      <Phone className="mr-2 h-4 w-4 text-gray-400" />
                      <a href={`tel:${provider.phone}`} className="hover:text-indigo-600">
                        {provider.phone}
                      </a>
                    </div>
                  )}
                  {provider.email && (
                    <div className="flex items-center">
                      <Mail className="mr-2 h-4 w-4 text-gray-400" />
                      <a href={`mailto:${provider.email}`} className="hover:text-indigo-600">
                        {provider.email}
                      </a>
                    </div>
                  )}
                  {provider.facility && (
                    <div className="flex items-center">
                      <Building className="mr-2 h-4 w-4 text-gray-400" />
                      <span>{provider.facility}</span>
                    </div>
                  )}
                  {(provider.addressLine1 || provider.city) && (
                    <div className="flex items-start">
                      <MapPin className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span>
                        {provider.addressLine1 && <div>{provider.addressLine1}</div>}
                        {provider.addressLine2 && <div>{provider.addressLine2}</div>}
                        {provider.city && (
                          <div>
                            {provider.city}
                            {provider.state && `, ${provider.state}`}
                            {provider.zipCode && ` ${provider.zipCode}`}
                          </div>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                {provider._count && (
                  <div className="mt-4 flex items-center gap-4 border-t border-gray-200 pt-4 text-xs text-gray-500">
                    {provider._count.medications > 0 && (
                      <span>{provider._count.medications} medication{provider._count.medications !== 1 ? 's' : ''}</span>
                    )}
                    {provider._count.recommendations > 0 && (
                      <span>{provider._count.recommendations} recommendation{provider._count.recommendations !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-4">
                  {!provider.isPrimary && (
                    <button
                      onClick={() => handleSetPrimary(provider.id)}
                      className="flex-1 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Set as Primary
                    </button>
                  )}
                  <button
                    onClick={() => handleEditProvider(provider)}
                    className="rounded-md p-1.5 text-gray-700 hover:bg-gray-100"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id, provider.name)}
                    className="rounded-md p-1.5 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <ProviderModal
          provider={selectedProvider}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
