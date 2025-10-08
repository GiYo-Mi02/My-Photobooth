import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { FiShare2, FiLink } from 'react-icons/fi';

type Props = {
  url: string;
};

export const SharePanel: React.FC<Props> = ({ url }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, url, { width: 160, margin: 1 });
        }
      } catch {}
    })();
  }, [url]);

  const canWebShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const handleShare = async () => {
    if (!canWebShare) return;
    try {
      await (navigator as any).share({ title: 'GioPix Photostrip', text: 'Grab my photostrip from GioPix', url });
    } catch {}
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">Share</h3>
        {canWebShare && (
          <button onClick={handleShare} className="btn-secondary inline-flex items-center">
            <FiShare2 className="mr-2" /> Share
          </button>
        )}
      </div>
      <div className="flex items-center gap-4">
        <canvas ref={canvasRef} className="rounded-lg border border-cream-200" />
        <div className="space-y-2">
          <div className="text-sm text-gray-600 break-all max-w-[280px]">{url}</div>
          <button onClick={copyLink} className="btn-ghost inline-flex items-center">
            <FiLink className="mr-2" /> Copy link
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePanel;
