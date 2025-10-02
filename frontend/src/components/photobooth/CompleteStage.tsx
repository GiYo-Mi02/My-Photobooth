import { motion } from 'framer-motion';
import { FiDownload, FiRefreshCw, FiPrinter } from 'react-icons/fi';
import { usePhotoBoothStore } from '../../stores/photoBoothStore';
import { apiClient } from '../../lib/api';
import toast from 'react-hot-toast';
import SharePanel from '../SharePanel';

const CompleteStage = () => {
  const { resetSession, session } = usePhotoBoothStore();

  const handleNewSession = () => {
    resetSession();
  };

  const handleDownload = async () => {
    if (!session?.photostripPath) return;
    const url = apiClient.getFileUrl(session.photostripPath);
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error('Failed to fetch file');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
  a.download = 'gpix-photostrip.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      toast.error('Download failed. Please try again.');
    }
  };

  const handlePrint = () => {
    if (!session?.photostripPath) return;
    const imgUrl = apiClient.getFileUrl(session.photostripPath);
    // Hidden iframe approach for reliable printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      toast.error('Unable to open print preview.');
      return;
    }

    doc.open();
    doc.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print Photostrip - GPix</title>
          <style>
            /* Hint printers for 4x6 inch borderless (landscape). If template is 2000x1600, this remains a close ratio. */
            @page { size: 4in 6in; margin: 0; }
            html, body { height: 100%; }
            body { margin: 0; display: flex; align-items: center; justify-content: center; background: #fff; }
            img { width: 100%; height: 100%; object-fit: cover; }
          </style>
        </head>
        <body>
          <img id="strip" src="${imgUrl}" />
          <script>
            const img = document.getElementById('strip');
            img.onload = function () {
              setTimeout(function(){ window.focus(); window.print(); }, 100);
            };
            window.onafterprint = function(){ setTimeout(function(){ window.close(); }, 200); };
          <\/script>
        </body>
      </html>`);
    doc.close();

    // Cleanup in case onafterprint doesn't fire
    setTimeout(() => {
      if (document.body.contains(iframe)) iframe.remove();
    }, 5000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-4xl text-center"
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your Photostrip is Ready!
          </h1>
          <p className="text-gray-600">
            Download your amazing photostrip or start a new session
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          {session?.photostripPath ? (
            <div className="flex flex-col items-center">
              <img
                src={apiClient.getFileUrl(session.photostripPath)}
                alt="Photostrip"
                className="max-h-[28rem] w-auto rounded-lg shadow"
              />
              <div className="mt-6 w-full max-w-xl">
                <SharePanel url={apiClient.getFileUrl(session.photostripPath)} />
              </div>
            </div>
          ) : (
            <div className="bg-gray-200 rounded-lg h-96 flex items-center justify-center mb-6">
              <p className="text-gray-500">Photostrip preview will appear here</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          <button onClick={handleDownload} disabled={!session?.photostripPath} className="btn-primary inline-flex items-center justify-center disabled:opacity-60">
            <FiDownload className="mr-2 h-5 w-5" />
            Download Photostrip
          </button>
          <button
            onClick={handlePrint}
            disabled={!session?.photostripPath}
            className="btn-secondary inline-flex items-center justify-center disabled:opacity-60"
          >
            <FiPrinter className="mr-2 h-5 w-5" />
            Print Photostrip
          </button>
          <button 
            onClick={handleNewSession}
            className="btn-secondary inline-flex items-center justify-center"
          >
            <FiRefreshCw className="mr-2 h-5 w-5" />
            Start New Session
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CompleteStage;
