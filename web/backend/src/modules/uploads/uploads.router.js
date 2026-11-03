// src/modules/uploads/uploads.router.js
// ============================================================
//  Image upload endpoint — POST /api/uploads/product-image
//  Requires: authenticate (staff or customer with valid JWT)
//  Returns:  { url, filename, size }
// ============================================================
const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../../common/middleware/auth');
const R        = require('../../common/utils/response');

const router = express.Router();

// ─── Ensure upload directory exists ──────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ─── Multer config ───────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `prod_${uuidv4().replace(/-/g, '')}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files are allowed (JPEG, PNG, WEBP, GIF)'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
    files:    1,
  },
});

// ─── POST /api/uploads/product-image ─────────────────────────
// Access: sales, admin, manager, warehouse (internal staff only)
router.post(
  '/product-image',
  authenticate,
  authorize('admin', 'manager', 'sales', 'warehouse'),
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return R.badRequest(res, 'File quá lớn. Tối đa 5MB.');
        }
        return R.badRequest(res, `Upload error: ${err.message}`);
      }
      if (err) return R.badRequest(res, err.message);
      next();
    });
  },
  (req, res) => {
    if (!req.file) return R.badRequest(res, 'Không có file nào được upload.');

    // Build public URL — served via express.static('uploads')
    const baseUrl  = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const fileUrl  = `${baseUrl}/uploads/products/${req.file.filename}`;

    return R.created(res, {
      url:      fileUrl,
      filename: req.file.filename,
      size:     req.file.size,
      mimetype: req.file.mimetype,
    }, 'Ảnh đã được tải lên thành công.');
  }
);

// ─── DELETE /api/uploads/product-image/:filename ─────────────
// Cleanup old image when product image is replaced
router.delete(
  '/product-image/:filename',
  authenticate,
  authorize('admin', 'manager'),
  (req, res) => {
    const { filename } = req.params;
    // Sanitize: only allow safe filenames (no path traversal)
    if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      return R.badRequest(res, 'Invalid filename.');
    }
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) return R.notFound(res, 'File not found.');
    fs.unlink(filePath, (err) => {
      if (err) return R.serverError(res, err);
      return R.ok(res, { deleted: filename });
    });
  }
);

module.exports = router;
