import { useState, useRef } from 'react';
import {
  X,
  Upload,
  Camera,
  Loader2,
  Utensils,
  Clock,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { cn, formatLocalDateTime, toLocalISOString } from '@/lib/utils';
import { nutritionApi } from '@/lib/api';
import axios from 'axios';
import toast from 'react-hot-toast';
import heic2any from 'heic2any';

interface LogMealModalProps {
  patientId: string;
  templates: MealTemplate[];
  onClose: () => void;
  onLog: (mealData: any) => Promise<void>;
}

interface MealTemplate {
  id: string;
  name: string;
  mealType: string;
  nutritionData: any;
  photoUrl?: string;
}

const MEAL_TYPES = [
  { value: 'BREAKFAST', label: 'Breakfast' },
  { value: 'LUNCH', label: 'Lunch' },
  { value: 'DINNER', label: 'Dinner' },
  { value: 'SNACK', label: 'Snack' },
  { value: 'OTHER', label: 'Other' },
];

export function LogMealModal({ patientId, templates, onClose, onLog }: LogMealModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    mealType: 'LUNCH',
    consumedAt: formatLocalDateTime(), // YYYY-MM-DDTHH:MM format in local time
    notes: '',
    templateId: '',
    analyzeWithAI: true,
  });

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      updateFormData('templateId', templateId);
      updateFormData('mealType', template.mealType);
      if (template.photoUrl) {
        setUploadedPhotos([template.photoUrl]);
        setPhotoPreviews([template.photoUrl]);
      }
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Check total photos limit
    if (uploadedPhotos.length + files.length > 5) {
      toast.error('Maximum 5 photos allowed per meal');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image file`);
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} is too large (max 10MB)`);
        }

        // Convert HEIC to JPEG if needed
        let processedFile = file;
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          try {
            toast.loading('Converting iPhone photo format...', { id: 'heic-convert' });
            const convertedBlob = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.9,
            });
            // heic2any returns Blob or Blob[], handle both cases
            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            processedFile = new File(
              [blob],
              file.name.replace(/\.heic$/i, '.jpg'),
              { type: 'image/jpeg' }
            );
            toast.success('Photo converted successfully', { id: 'heic-convert' });
          } catch (conversionError) {
            console.error('HEIC conversion failed:', conversionError);
            toast.error('Failed to convert HEIC format. Please use JPG or PNG.', { id: 'heic-convert' });
            throw new Error('HEIC conversion failed');
          }
        }

        // Create preview
        const previewUrl = URL.createObjectURL(processedFile);
        setPhotoPreviews((prev) => [...prev, previewUrl]);

        // Get presigned URL from backend
        const { data } = await nutritionApi.getPhotoUploadUrl(processedFile.name, processedFile.type);

        // Upload to S3
        await axios.put(data.uploadUrl.url, processedFile, {
          headers: {
            'Content-Type': processedFile.type,
          },
        });

        // Extract the S3 URL (without query params)
        const s3Url = data.uploadUrl.url.split('?')[0];
        return s3Url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setUploadedPhotos((prev) => [...prev, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} photo(s) uploaded successfully`);
    } catch (err: any) {
      console.error('Photo upload error:', err);
      setError(err.message || 'Failed to upload photos');
      toast.error(err.message || 'Failed to upload photos');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => {
      // Revoke object URL to prevent memory leaks
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Validation
      if (!formData.mealType) {
        throw new Error('Please select a meal type');
      }

      // Prepare meal data
      const mealData = {
        patientId,
        mealType: formData.mealType,
        consumedAt: toLocalISOString(new Date(formData.consumedAt)),
        notes: formData.notes || undefined,
        photoUrls: uploadedPhotos,
        templateId: formData.templateId || undefined,
        analyzeWithAI: formData.analyzeWithAI && uploadedPhotos.length > 0,
      };

      await onLog(mealData);
    } catch (err: any) {
      console.error('Log meal error:', err);
      setError(err.message || 'Failed to log meal');
      toast.error(err.message || 'Failed to log meal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Utensils className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Log Meal</h2>
              <p className="text-sm text-gray-600">Track what was eaten</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Template Selection */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Select Template (Optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {templates.slice(0, 4).map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template.id)}
                    className={cn(
                      'p-3 border rounded-lg text-left transition-all',
                      formData.templateId === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <p className="text-sm font-medium text-gray-900">{template.name}</p>
                    <p className="text-xs text-gray-500">{template.mealType.toLowerCase()}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Meal Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meal Type *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MEAL_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateFormData('mealType', type.value)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    formData.mealType === type.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Consumed
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="datetime-local"
                value={formData.consumedAt}
                onChange={(e) => updateFormData('consumedAt', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos (Optional, up to 5)
            </label>

            {/* Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                isUploading
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />

              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-3" />
                  <p className="text-sm text-gray-600">Uploading photos...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Camera className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-900 font-medium mb-1">
                    Drag & drop photos or click to browse
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Up to 5 photos, max 10MB each
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Select Photos
                  </button>
                </div>
              )}
            </div>

            {/* Photo Previews */}
            {photoPreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-5 gap-2">
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-20 object-cover rounded border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Analysis Toggle */}
          {uploadedPhotos.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">AI Meal Analysis</p>
                  <p className="text-xs text-gray-600">
                    Automatically analyze nutrition, detect concerns, and check guidelines
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.analyzeWithAI}
                  onChange={(e) => updateFormData('analyzeWithAI', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateFormData('notes', e.target.value)}
              placeholder="Add any notes about the meal, concerns, or observations..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting || isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className={cn(
                'px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center space-x-2',
                isSubmitting || isUploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Logging...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Log Meal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
