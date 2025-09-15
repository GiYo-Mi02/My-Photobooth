import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePhotoBoothStore } from '../../stores/photoBoothStore';
import { templateService } from '../../services/templates';
import type { Template } from '../../types';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/api';

const TemplateStage = () => {
  const { nextStage, previousStage, currentTemplate, setTemplate, selectedPhotos } = usePhotoBoothStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await templateService.getTemplates();
        if (mounted) setTemplates(res.templates);
      } catch (e) {
        toast.error('Failed to load templates');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Auto-pick a template that can accommodate the selection
  useEffect(() => {
    if (loading) return;
    if (!templates.length) return;
    if (currentTemplate) return;
    const needed = selectedPhotos.length || 1;
    // Prefer templates with slots >= needed, otherwise pick the one with max slots
    const sorted = [...templates].sort((a, b) => (a.photoSlots.length - b.photoSlots.length));
    const fit = sorted.find(t => t.photoSlots.length >= needed) || sorted[sorted.length - 1];
    if (fit) {
      setTemplate(fit);
      if (fit.photoSlots.length < needed) {
        toast('Selected template has fewer slots than selected photos; extra photos will be ignored.', { icon: '⚠️' });
      }
    }
  }, [loading, templates, currentTemplate, selectedPhotos.length, setTemplate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-6xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Choose a Template
          </h1>
          <p className="text-gray-600">
            Select a photostrip template for your photos
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No templates available</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {templates.map(t => {
                const isSel = currentTemplate?._id === t._id;
                return (
                  <button
                    type="button"
                    key={t._id}
                    onClick={() => setTemplate(t)}
                    className={`template-card ${isSel ? 'template-card-selected' : ''}`}
                  >
                    <img
                      src={t.thumbnailPath ? apiClient.getFileUrl(t.thumbnailPath) : apiClient.getFileUrl(t.path)}
                      alt={t.name}
                      className="w-full aspect-[3/4] object-cover"
                    />
                    <div className="p-3 text-left">
                      <div className="font-semibold text-gray-900 truncate">{t.name}</div>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span className="truncate mr-2">{t.category}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-cream-200 text-gray-700">
                          Slots: {t.photoSlots.length}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-center space-x-4">
          <button onClick={previousStage} className="btn-secondary">
            Back to Review
          </button>
          <button onClick={nextStage} disabled={!currentTemplate} className="btn-primary disabled:opacity-60">
            Generate Photostrip
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default TemplateStage;
