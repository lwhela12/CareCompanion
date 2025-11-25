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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Healthcare Providers</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage your healthcare team and contacts
            </p>
          </div>
          <button
            onClick={handleAddProvider}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Provider
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, specialty, or facility..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-400 py-2 pl-10 pr-3 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
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
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error loading providers</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="rounded-lg bg-white dark:bg-slate-800 p-12 text-center shadow-sm dark:shadow-slate-900/50">
            <User className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              {searchQuery || typeFilter ? 'No matching providers' : 'No providers yet'}
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery || typeFilter
                ? 'Try adjusting your search or filter.'
                : 'Get started by adding your healthcare providers.'}
            </p>
            {!searchQuery && !typeFilter && (
              <button
                onClick={handleAddProvider}
                className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600"
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
                className="relative rounded-lg bg-white dark:bg-slate-800 p-6 shadow-sm dark:shadow-slate-900/50 ring-1 ring-gray-200 dark:ring-slate-700 hover:shadow-md dark:hover:shadow-slate-900/70"
              >
                {/* Primary badge */}
                {provider.isPrimary && (
                  <div className="absolute right-4 top-4">
                    <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-400">
                      <Star className="mr-1 h-3 w-3 fill-current" />
                      Primary
                    </span>
                  </div>
                )}

                {/* Provider info */}
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{provider.name}</h3>
                  {provider.specialty && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{provider.specialty}</p>
                  )}
                  <div className="mt-1">
                    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-300">
                      {providerTypes.find(t => t.value === provider.type)?.label || provider.type}
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  {provider.phone && (
                    <div className="flex items-center">
                      <Phone className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <a href={`tel:${provider.phone}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                        {provider.phone}
                      </a>
                    </div>
                  )}
                  {provider.email && (
                    <div className="flex items-center">
                      <Mail className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <a href={`mailto:${provider.email}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                        {provider.email}
                      </a>
                    </div>
                  )}
                  {provider.facility && (
                    <div className="flex items-center">
                      <Building className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <span>{provider.facility}</span>
                    </div>
                  )}
                  {(provider.addressLine1 || provider.city) && (
                    <div className="flex items-start">
                      <MapPin className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
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
                  <div className="mt-4 flex items-center gap-4 border-t border-gray-200 dark:border-slate-700 pt-4 text-xs text-gray-500 dark:text-gray-400">
                    {provider._count.medications > 0 && (
                      <span>{provider._count.medications} medication{provider._count.medications !== 1 ? 's' : ''}</span>
                    )}
                    {provider._count.recommendations > 0 && (
                      <span>{provider._count.recommendations} recommendation{provider._count.recommendations !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2 border-t border-gray-200 dark:border-slate-700 pt-4">
                  {!provider.isPrimary && (
                    <button
                      onClick={() => handleSetPrimary(provider.id)}
                      className="flex-1 rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600"
                    >
                      Set as Primary
                    </button>
                  )}
                  <button
                    onClick={() => handleEditProvider(provider)}
                    className="rounded-md p-1.5 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id, provider.name)}
                    className="rounded-md p-1.5 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
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
