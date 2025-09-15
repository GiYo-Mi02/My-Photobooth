import { useEffect, useMemo, useState } from 'react';
import { templateService } from '../../services/templates';
import { apiClient } from '../../lib/api';
import type { Template, PhotoSlot } from '../../types';
import toast from 'react-hot-toast';
import TemplateSlotEditor from '../../components/admin/TemplateSlotEditor';
import { useRef } from 'react';

const defaultSlots = (): PhotoSlot[] => {
  // Landscape canvas (user's template): 2000x1600 px, 1 large top + 3 small bottom
  const width = 2000;
  const height = 1600;
  const pad = 60;
  const gap = 30;
  const smallRowH = 300;
  const smallW = Math.floor((width - pad * 2 - gap * 2) / 3);
  const smallY = height - pad - smallRowH;

  const slots: PhotoSlot[] = [];
  // Large top slot
  slots.push({
    x: pad,
    y: pad,
    width: width - pad * 2,
    height: smallY - pad - gap,
    rotation: 0,
    borderRadius: 0,
  });
  // Three bottom slots
  for (let i = 0; i < 3; i++) {
    slots.push({
      x: pad + i * (smallW + gap),
      y: smallY,
      width: smallW,
      height: smallRowH,
      rotation: 0,
      borderRadius: 0,
    });
  }
  return slots;
};

const Templates = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('classic');
  const [isDefault, setIsDefault] = useState(false);
  const [slotsMode, setSlotsMode] = useState<'preset' | 'custom' | 'visual'>('visual');
  const [slotsJson, setSlotsJson] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const [slotsPx, setSlotsPx] = useState<PhotoSlot[] | null>(null);
  // Track whether the visual editor has been initialized from initial slots to avoid feedback resets
  const [visualInit, setVisualInit] = useState(false);

  // Reset visual init when file or mode changes
  useEffect(() => {
    setVisualInit(false);
  }, [file, slotsMode]);

  const photoSlots: PhotoSlot[] = useMemo(() => {
    if (slotsMode === 'visual' && slotsPx?.length) return slotsPx;
    if (slotsMode === 'preset') return defaultSlots();
    try {
      const parsed = JSON.parse(slotsJson);
      if (Array.isArray(parsed)) return parsed as PhotoSlot[];
      if (parsed && Array.isArray(parsed.frames)) {
        return (parsed.frames as any[]).map((f) => ({
          x: Math.round(f.x),
          y: Math.round(f.y),
          width: Math.round(f.width),
          height: Math.round(f.height),
          rotation: 0,
          borderRadius: 0,
        }));
      }
    } catch {}
    return defaultSlots();
  }, [slotsMode, slotsPx, slotsJson]);

  const handleImportJson = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      let frames: any[] | null = null;
      if (Array.isArray(data)) frames = data;
      else if (data && Array.isArray(data.frames)) frames = data.frames;
      if (!frames || frames.length === 0) {
        toast.error('No frames found in JSON');
        return;
      }
      const slots: PhotoSlot[] = frames.map((f) => ({
        x: Math.round(Number(f.x) || 0),
        y: Math.round(Number(f.y) || 0),
        width: Math.round(Number(f.width) || 0),
        height: Math.round(Number(f.height) || 0),
        rotation: 0,
        borderRadius: 0,
      }));
  setSlotsPx(slots);
  setSlotsMode('visual');
  setVisualInit(false); // seed editor from imported slots
      toast.success('Imported frames from JSON');
    } catch (e: any) {
      toast.error('Failed to import JSON');
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // simple retry 2x with small delay
      const attempt = async () => templateService.getTemplates();
      let res = await attempt();
      if (!res?.templates) {
        await new Promise(r => setTimeout(r, 400));
        res = await attempt();
      }
      setTemplates(res.templates);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please choose an image file');
      return;
    }
    if (!name.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (slotsMode === 'visual' && (!slotsPx || slotsPx.length === 0)) {
      toast.error('Add at least one photo slot in the visual editor');
      return;
    }
    try {
      setUploadProgress(0);
      // retry upload once on network failure
      const doUpload = () => templateService.uploadTemplate(file, {
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        photoSlots,
        ...(slotsMode === 'custom' && slotsJson ? { layoutJson: slotsJson } : {} as any),
        isDefault,
      }, (p) => setUploadProgress(p));
      try {
        await doUpload();
      } catch (err: any) {
        if (err?.message?.toLowerCase().includes('network')) {
          await new Promise(r => setTimeout(r, 500));
          await doUpload();
        } else {
          throw err;
        }
      }
      toast.success('Template uploaded');
      // Reset form
      setFile(null);
      setName('');
      setDescription('');
      setIsDefault(false);
      setUploadProgress(0);
      await loadTemplates();
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await templateService.deleteTemplate(id);
      toast.success('Template deleted');
      await loadTemplates();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Template Management</h1>
          <p className="text-gray-600 mt-2">Manage photostrip templates and upload new designs</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Form */}
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload New Template</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFile(f);
                    setSlotsPx(null);
                    setVisualInit(false);
                  }}
                  className="block w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Classic 4x Vertical" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-[80px]" placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                    <option value="classic">classic</option>
                    <option value="modern">modern</option>
                    <option value="fun">fun</option>
                    <option value="elegant">elegant</option>
                    <option value="holiday">holiday</option>
                    <option value="custom">custom</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center space-x-2">
                    <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                    <span>Set as default</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photo Slots</label>
                <div className="flex items-center space-x-3 mb-2">
                  <label className="inline-flex items-center space-x-2">
                    <input type="radio" checked={slotsMode === 'visual'} onChange={() => setSlotsMode('visual')} />
                    <span>Visual Editor</span>
                  </label>
                  <label className="inline-flex items-center space-x-2">
                    <input type="radio" checked={slotsMode === 'preset'} onChange={() => setSlotsMode('preset')} />
                    <span>Preset (Landscape 1 + 3)</span>
                  </label>
                  <label className="inline-flex items-center space-x-2">
                    <input type="radio" checked={slotsMode === 'custom'} onChange={() => setSlotsMode('custom')} />
                    <span>Custom JSON</span>
                  </label>
                </div>
                {slotsMode === 'visual' && (
                  <div className="mt-2">
                    <TemplateSlotEditor
                      imageFile={file}
                      initialSlots={!visualInit && slotsPx ? slotsPx : undefined}
                      onChange={(px) => {
                        setSlotsPx(px);
                        if (!visualInit) setVisualInit(true);
                      }}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImportJson(f);
                          e.currentTarget.value = '';
                        }}
                        ref={jsonFileInputRef}
                      />
                      <button type="button" className="btn-ghost" onClick={() => jsonFileInputRef.current?.click()}>Import JSON layout</button>
                    </div>
                  </div>
                )}
                {slotsMode === 'custom' && (
                  <textarea value={slotsJson} onChange={(e) => setSlotsJson(e.target.value)} className="input min-h-[120px] font-mono" placeholder='{"frames":[{"x":60,"y":90,"width":620,"height":400},{"x":60,"y":520,"width":200,"height":150}]}' />
                )}
                <div className="text-xs text-gray-500 mt-1">Slots must be absolute pixel positions within the uploaded template image.</div>
              </div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="w-full bg-cream-200 rounded h-2 overflow-hidden">
                  <div className="bg-primary-600 h-2" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
              <button type="submit" className="btn-primary w-full">Upload</button>
            </form>
          </div>

          {/* List */}
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Templates</h2>
              <button onClick={loadTemplates} className="btn-ghost">Refresh</button>
            </div>
            {loading ? (
              <div className="text-center py-16 text-gray-500">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-16 text-gray-500">No templates yet. Upload one to get started.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {templates.map(t => (
                  <div key={t._id} className="template-card">
                    <img src={t.thumbnailPath ? apiClient.getFileUrl(t.thumbnailPath) : apiClient.getFileUrl(t.path)} alt={t.name} className="w-full aspect-[3/4] object-cover" />
                    <div className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="font-semibold text-gray-900 truncate" title={t.name}>{t.name}</div>
                        {t.isDefault && <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Default</span>}
                      </div>
                      <div className="text-sm text-gray-500 truncate">{t.category}</div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-xs text-gray-500">{t.photoSlots.length} slots</div>
                        <button onClick={() => handleDelete(t._id)} className="text-red-600 text-sm hover:underline">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Templates;
