import { v2 as cloudinary } from "cloudinary";

let configured = false;

const clean = (value) => {
  if (value == null) return "";
  return String(value).trim().replace(/^['\"]|['\"]$/g, "");
};

const getConfig = () => ({
  cloud_name: clean(process.env.CLOUDINARY_CLOUD_NAME),
  api_key: clean(process.env.CLOUDINARY_API_KEY),
  api_secret: clean(process.env.CLOUDINARY_API_SECRET),
});

export const isCloudinaryConfigured = () => {
  const cfg = getConfig();
  if (cfg.cloud_name === "your_cloud_name_here") return false;
  return Boolean(cfg.cloud_name && cfg.api_key && cfg.api_secret);
};

export const ensureCloudinary = () => {
  if (configured) return cloudinary;
  if (!isCloudinaryConfigured()) return null;

  // Avoid stale CLOUDINARY_URL values overriding explicit credentials.
  delete process.env.CLOUDINARY_URL;
  cloudinary.config(getConfig());
  configured = true;
  return cloudinary;
};

export const uploadImagePath = async (filePath, options = {}) => {
  const instance = ensureCloudinary();
  if (!instance) {
    throw new Error("Cloudinary is not configured");
  }

  return instance.uploader.upload(filePath, {
    resource_type: "image",
    ...options,
  });
};

export const uploadImageBuffer = async (buffer, options = {}) => {
  const instance = ensureCloudinary();
  if (!instance) {
    throw new Error("Cloudinary is not configured");
  }

  return new Promise((resolve, reject) => {
    const stream = instance.uploader.upload_stream(
      {
        resource_type: "image",
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    stream.end(buffer);
  });
};
